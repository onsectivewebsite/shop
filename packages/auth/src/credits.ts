import { prisma } from '@onsective/db';

/**
 * User credit balance + ledger. The denorm balance row lives on
 * `UserCreditBalance` (per user × currency); the source of truth is the
 * append-only `UserCreditTransaction` ledger. Every helper here updates
 * both in the same transaction.
 *
 * Idempotency is on (sourceType, sourceId, type) — a unique constraint on
 * the ledger swallows duplicate writes (P2002) without erroring, so callers
 * can retry safely on failures or webhook replays.
 *
 * Currency-strict: balances are never auto-converted. A USD order can only
 * spend USD credit; an INR award only credits INR. Cross-currency would
 * need an FX rate from somewhere we trust.
 */

type AwardArgs = {
  userId: string;
  amountMinor: number;
  currency: string;
  sourceType: string;
  sourceId: string;
  note?: string;
};

export async function awardCredit(args: AwardArgs): Promise<{ awarded: boolean }> {
  if (args.amountMinor <= 0) return { awarded: false };
  try {
    await prisma.$transaction(async (tx) => {
      await tx.userCreditTransaction.create({
        data: {
          userId: args.userId,
          type: 'AWARD',
          amountMinor: args.amountMinor,
          currency: args.currency,
          sourceType: args.sourceType,
          sourceId: args.sourceId,
          note: args.note,
        },
      });
      await tx.userCreditBalance.upsert({
        where: { userId_currency: { userId: args.userId, currency: args.currency } },
        create: {
          userId: args.userId,
          currency: args.currency,
          amountMinor: args.amountMinor,
        },
        update: { amountMinor: { increment: args.amountMinor } },
      });
    });
    return { awarded: true };
  } catch (err: unknown) {
    // P2002 = the (sourceType, sourceId, AWARD) row already exists. The
    // balance was already incremented on the original write; this replay
    // is a no-op by design.
    if ((err as { code?: string }).code === 'P2002') return { awarded: false };
    throw err;
  }
}

/**
 * Spend credit at order placement. Returns the amount actually applied
 * (≤ requested, ≤ balance). Idempotent on the order id + currency, so a
 * retried checkout call doesn't double-spend.
 */
export async function redeemCredit(args: {
  userId: string;
  amountMinor: number;
  currency: string;
  orderId: string;
  note?: string;
}): Promise<{ appliedMinor: number }> {
  if (args.amountMinor <= 0) return { appliedMinor: 0 };

  const balance = await prisma.userCreditBalance.findUnique({
    where: { userId_currency: { userId: args.userId, currency: args.currency } },
  });
  const available = balance?.amountMinor ?? 0;
  if (available <= 0) return { appliedMinor: 0 };

  const applied = Math.min(available, args.amountMinor);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.userCreditTransaction.create({
        data: {
          userId: args.userId,
          type: 'REDEEM',
          amountMinor: -applied,
          currency: args.currency,
          sourceType: 'order',
          sourceId: args.orderId,
          note: args.note,
        },
      });
      // Decrement using a guarded update so we don't go negative if two
      // checkouts race for the same balance — the second one's WHERE clause
      // misses and the transaction rolls back.
      const decremented = await tx.userCreditBalance.updateMany({
        where: {
          userId: args.userId,
          currency: args.currency,
          amountMinor: { gte: applied },
        },
        data: { amountMinor: { decrement: applied } },
      });
      if (decremented.count === 0) {
        throw new Error('Concurrent credit redemption — balance changed.');
      }
    });
    return { appliedMinor: applied };
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') {
      // This order already redeemed against this balance — surface the prior
      // applied amount by reading the existing ledger row.
      const prior = await prisma.userCreditTransaction.findUnique({
        where: {
          sourceType_sourceId_type: {
            sourceType: 'order',
            sourceId: args.orderId,
            type: 'REDEEM',
          },
        },
        select: { amountMinor: true },
      });
      return { appliedMinor: prior ? Math.abs(prior.amountMinor) : 0 };
    }
    throw err;
  }
}

/**
 * Reverse all credit redemptions tied to an order — used when payment fails
 * and we need to make the buyer whole. Walks both source types written by
 * checkout: 'order' (same-currency REDEEM) and 'order_fx' (cross-currency
 * REDEEM with FX columns set). Each leg is its own ledger row, refunded into
 * its own currency balance.
 *
 * Idempotent per leg on (sourceType, sourceId, REFUND), so a webhook replay
 * re-runs cleanly without double-crediting.
 */
export async function refundCredit(args: {
  userId: string;
  orderId: string;
  currency: string;
}): Promise<{ refundedMinor: number; refundedCurrency: string | null }> {
  const redeems = await prisma.userCreditTransaction.findMany({
    where: {
      sourceType: { in: ['order', 'order_fx'] },
      sourceId: args.orderId,
      type: 'REDEEM',
      userId: args.userId,
    },
    select: {
      amountMinor: true,
      currency: true,
      sourceType: true,
      fxRate: true,
      fxFromCurrency: true,
      fxFromAmountMinor: true,
    },
  });
  if (redeems.length === 0) return { refundedMinor: 0, refundedCurrency: null };

  // Aggregated return value mirrors the legacy single-leg shape — callers
  // only use it for logging. Caller-of-record currency is whichever leg had
  // the most refunded; FX leg amounts are tallied in their own currency, so
  // we pick the order currency as the "primary" surface for the response.
  let primaryRefunded = 0;
  let primaryCurrency: string | null = null;

  for (const redeem of redeems) {
    // Cross-currency leg ('order_fx'): return the source-currency amount
    // that was actually decremented, at the rate that was active when the
    // user redeemed. Same-currency leg ('order'): straightforward unwind.
    const refundCurrency = redeem.fxFromCurrency ?? redeem.currency;
    const refundAmount = redeem.fxFromCurrency
      ? redeem.fxFromAmountMinor ?? 0
      : Math.abs(redeem.amountMinor);
    if (refundAmount <= 0) continue;

    try {
      await prisma.$transaction(async (tx) => {
        await tx.userCreditTransaction.create({
          data: {
            userId: args.userId,
            type: 'REFUND',
            amountMinor: refundAmount,
            currency: refundCurrency,
            sourceType: redeem.sourceType,
            sourceId: args.orderId,
            // Mirror FX details so the audit log can pair REDEEM/REFUND by
            // the same fxRate even after the rate has moved on Stripe.
            fxRate: redeem.fxRate,
            fxFromCurrency: redeem.fxFromCurrency,
            fxFromAmountMinor: redeem.fxFromAmountMinor,
          },
        });
        await tx.userCreditBalance.upsert({
          where: {
            userId_currency: { userId: args.userId, currency: refundCurrency },
          },
          create: {
            userId: args.userId,
            currency: refundCurrency,
            amountMinor: refundAmount,
          },
          update: { amountMinor: { increment: refundAmount } },
        });
      });
      if (refundCurrency === args.currency) {
        primaryRefunded += refundAmount;
        primaryCurrency = refundCurrency;
      } else if (primaryCurrency === null) {
        primaryRefunded = refundAmount;
        primaryCurrency = refundCurrency;
      }
    } catch (err: unknown) {
      // P2002 = REFUND for this (sourceType, sourceId) already written by an
      // earlier webhook attempt. No-op; the balance is already restored.
      if ((err as { code?: string }).code === 'P2002') continue;
      throw err;
    }
  }

  return { refundedMinor: primaryRefunded, refundedCurrency: primaryCurrency };
}

export async function getCreditBalances(userId: string): Promise<
  Array<{ currency: string; amountMinor: number }>
> {
  const rows = await prisma.userCreditBalance.findMany({
    where: { userId, amountMinor: { gt: 0 } },
    select: { currency: true, amountMinor: true },
    orderBy: { currency: 'asc' },
  });
  return rows;
}

export async function getCreditBalance(
  userId: string,
  currency: string,
): Promise<number> {
  const row = await prisma.userCreditBalance.findUnique({
    where: { userId_currency: { userId, currency } },
    select: { amountMinor: true },
  });
  return row?.amountMinor ?? 0;
}
