import { prisma } from '../db';
import { getStripe } from '../stripe';
import { refreshAccountStatus } from '../connect';
import type { PayoutStatus } from '@onsective/db';

/**
 * Hourly seller payout sweep.
 *
 * Flow per (seller, currency) bucket:
 *   1. Re-attempt any PENDING Payout we previously created but didn't transfer.
 *   2. Find SELLER_PAYABLE ledger entries older than RETURN_WINDOW_DAYS that
 *      aren't yet linked to a Payout. Sum them.
 *   3. Inside one DB tx: create a PENDING Payout, link the entries, write
 *      reverse double-entry rows (DR SELLER_PAYABLE, CR SELLER_PAID).
 *   4. Outside the tx: call stripe.transfers.create with idempotency_key
 *      `payout:{sellerId}:{periodEnd}`. Mark Payout IN_TRANSIT on success or
 *      FAILED on rejection.
 *
 * This function is safe to re-run: if step 4 crashes, the next run sees the
 * PENDING Payout in step 1 and retries with the same idempotency key.
 */

export const RETURN_WINDOW_DAYS = 7;

export type PayoutsBatchResult = {
  sellersConsidered: number;
  retried: number;
  created: number;
  inTransit: number;
  failed: number;
  skipped: number;
};

export async function runPayoutsBatch(opts: {
  now?: Date;
  log?: (msg: string) => void;
} = {}): Promise<PayoutsBatchResult> {
  const now = opts.now ?? new Date();
  const log = opts.log ?? (() => {});
  const cutoff = new Date(now.getTime() - RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const sellers = await prisma.seller.findMany({
    where: {
      stripePayoutsEnabled: true,
      stripeAccountId: { not: null },
      status: { not: 'SUSPENDED' },
    },
    select: { id: true, stripeAccountId: true },
  });

  const result: PayoutsBatchResult = {
    sellersConsidered: sellers.length,
    retried: 0,
    created: 0,
    inTransit: 0,
    failed: 0,
    skipped: 0,
  };

  for (const seller of sellers) {
    if (!seller.stripeAccountId) continue;

    // Step 1: retry any prior PENDING Payouts.
    const pending = await prisma.payout.findMany({
      where: { sellerId: seller.id, status: 'PENDING' },
    });
    for (const p of pending) {
      result.retried++;
      const outcome = await executeTransfer({
        payoutId: p.id,
        sellerId: seller.id,
        stripeAccountId: seller.stripeAccountId,
        amount: p.amount,
        currency: p.currency,
        periodEnd: p.periodEnd,
        log,
      });
      result[outcome]++;
    }

    // Step 2 + 3: allocate fresh entries by currency.
    const groups = await prisma.ledgerEntry.groupBy({
      by: ['currency'],
      where: {
        sellerId: seller.id,
        account: 'SELLER_PAYABLE',
        direction: 'CREDIT',
        payoutId: null,
        createdAt: { lt: cutoff },
      },
      _sum: { amount: true },
      _min: { createdAt: true },
      _max: { createdAt: true },
    });

    for (const g of groups) {
      const amount = g._sum.amount ?? 0;
      if (amount <= 0 || !g._min.createdAt || !g._max.createdAt) {
        result.skipped++;
        continue;
      }

      const payout = await prisma.$transaction(async (tx) => {
        const entries = await tx.ledgerEntry.findMany({
          where: {
            sellerId: seller.id,
            account: 'SELLER_PAYABLE',
            direction: 'CREDIT',
            payoutId: null,
            currency: g.currency,
            createdAt: { lt: cutoff },
          },
          select: { id: true, amount: true, currency: true },
        });
        if (entries.length === 0) return null;

        const total = entries.reduce((acc, e) => acc + e.amount, 0);
        if (total <= 0) return null;

        const created = await tx.payout.create({
          data: {
            sellerId: seller.id,
            amount: total,
            currency: g.currency,
            status: 'PENDING',
            gateway: 'stripe',
            periodStart: g._min.createdAt!,
            periodEnd: g._max.createdAt!,
            scheduledFor: now,
          },
        });

        await tx.ledgerEntry.updateMany({
          where: { id: { in: entries.map((e) => e.id) } },
          data: { payoutId: created.id },
        });

        // Reverse double-entry: DR SELLER_PAYABLE, CR SELLER_PAID, both linked
        // to the new payout. This zeros the SELLER_PAYABLE balance against the
        // amount we're about to wire and records what was paid out.
        await tx.ledgerEntry.createMany({
          data: [
            {
              account: 'SELLER_PAYABLE',
              direction: 'DEBIT',
              amount: total,
              currency: g.currency,
              sellerId: seller.id,
              payoutId: created.id,
              refType: 'payout',
              refId: created.id,
              description: `payout ${created.id} reverse SELLER_PAYABLE`,
            },
            {
              account: 'SELLER_PAID',
              direction: 'CREDIT',
              amount: total,
              currency: g.currency,
              sellerId: seller.id,
              payoutId: created.id,
              refType: 'payout',
              refId: created.id,
              description: `payout ${created.id} SELLER_PAID`,
            },
          ],
        });

        return created;
      });

      if (!payout) {
        result.skipped++;
        continue;
      }
      result.created++;

      const outcome = await executeTransfer({
        payoutId: payout.id,
        sellerId: seller.id,
        stripeAccountId: seller.stripeAccountId,
        amount: payout.amount,
        currency: payout.currency,
        periodEnd: payout.periodEnd,
        log,
      });
      result[outcome]++;
    }
  }

  return result;
}

type TransferOutcome = 'inTransit' | 'failed';

async function executeTransfer(args: {
  payoutId: string;
  sellerId: string;
  stripeAccountId: string;
  amount: number;
  currency: string;
  periodEnd: Date;
  log: (msg: string) => void;
}): Promise<TransferOutcome> {
  // Re-check payout-enabled flag right before transferring. A seller can be
  // suspended between sweeps; we don't want to wire money in that window.
  try {
    const status = await refreshAccountStatus(args.sellerId);
    if (!status.payoutsEnabled) {
      await markFailed(args.payoutId, 'payouts disabled at transfer time');
      args.log(
        `[payouts] seller=${args.sellerId} payouts disabled — payout=${args.payoutId} marked FAILED`,
      );
      return 'failed';
    }
  } catch (err) {
    await markFailed(
      args.payoutId,
      err instanceof Error ? `account refresh: ${err.message}` : 'account refresh failed',
    );
    return 'failed';
  }

  const idempotencyKey = `payout:${args.sellerId}:${args.periodEnd.toISOString()}`;
  try {
    const stripe = getStripe();
    const transfer = await stripe.transfers.create(
      {
        amount: args.amount,
        currency: args.currency.toLowerCase(),
        destination: args.stripeAccountId,
        metadata: { payoutId: args.payoutId, sellerId: args.sellerId },
      },
      { idempotencyKey },
    );

    await prisma.payout.update({
      where: { id: args.payoutId },
      data: {
        status: 'IN_TRANSIT' satisfies PayoutStatus,
        gatewayRef: transfer.id,
      },
    });
    args.log(
      `[payouts] payout=${args.payoutId} → transfer=${transfer.id} amount=${args.amount} ${args.currency}`,
    );
    return 'inTransit';
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'transfer failed';
    await markFailed(args.payoutId, reason);
    args.log(`[payouts] payout=${args.payoutId} FAILED: ${reason}`);
    return 'failed';
  }
}

async function markFailed(payoutId: string, reason: string): Promise<void> {
  await prisma.payout.update({
    where: { id: payoutId },
    data: {
      status: 'FAILED' satisfies PayoutStatus,
      failureReason: reason.slice(0, 500),
    },
  });
}
