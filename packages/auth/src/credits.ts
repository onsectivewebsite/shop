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
 * Reverse a redemption — used when an order is cancelled before payment
 * captures. Idempotent on the same source pair as the original REDEEM.
 */
export async function refundCredit(args: {
  userId: string;
  orderId: string;
  currency: string;
}): Promise<{ refundedMinor: number }> {
  const redeem = await prisma.userCreditTransaction.findUnique({
    where: {
      sourceType_sourceId_type: {
        sourceType: 'order',
        sourceId: args.orderId,
        type: 'REDEEM',
      },
    },
    select: { amountMinor: true, currency: true, userId: true },
  });
  if (!redeem || redeem.userId !== args.userId) return { refundedMinor: 0 };
  const amount = Math.abs(redeem.amountMinor);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.userCreditTransaction.create({
        data: {
          userId: args.userId,
          type: 'REFUND',
          amountMinor: amount,
          currency: redeem.currency,
          sourceType: 'order',
          sourceId: args.orderId,
        },
      });
      await tx.userCreditBalance.upsert({
        where: {
          userId_currency: { userId: args.userId, currency: redeem.currency },
        },
        create: {
          userId: args.userId,
          currency: redeem.currency,
          amountMinor: amount,
        },
        update: { amountMinor: { increment: amount } },
      });
    });
    return { refundedMinor: amount };
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') return { refundedMinor: 0 };
    throw err;
  }
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
