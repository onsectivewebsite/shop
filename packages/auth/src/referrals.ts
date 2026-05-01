import { randomBytes } from 'node:crypto';
import { prisma } from '@onsective/db';

// Crockford-base32 minus 0/O/1/I/L. 28 letters, ~4.8 bits per char, 8 chars
// → ~38 bits of entropy. With unique-index retry the collision risk is
// vanishing at any user count we care about.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const REFERRAL_COOKIE_NAME = 'onsective_ref';
export const REFERRAL_COOKIE_TTL_DAYS = 30;

function randomCode(): string {
  // 8 bytes of randomness sliced into 8 chars by indexing the alphabet.
  const buf = randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i += 1) {
    out += ALPHABET.charAt(buf[i]! % ALPHABET.length);
  }
  return out;
}

/**
 * Returns the user's existing referral code, or mints + persists a new one.
 * Retries on the (very rare) unique-index collision so callers don't have
 * to handle P2002 themselves.
 */
export async function getOrMintReferralCode(userId: string): Promise<string> {
  const existing = await prisma.referralCode.findUnique({ where: { userId } });
  if (existing) return existing.code;

  let attempts = 0;
  while (attempts < 5) {
    const code = randomCode();
    try {
      const created = await prisma.referralCode.create({
        data: { userId, code },
      });
      return created.code;
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'P2002') {
        attempts += 1;
        continue;
      }
      throw err;
    }
  }
  throw new Error('Could not mint a unique referral code after 5 attempts.');
}

export type ReferralStats = {
  code: string | null;
  signups: number;
  qualifyingOrders: number;
  earnedMinor: number;
  pendingPayoutMinor: number;
  paidPayoutMinor: number;
  currency: string | null;
};

/**
 * Aggregate counters for /account/referrals. We don't bucket by date here
 * — the page only needs the totals. Returning `null`/zero for everyone
 * who hasn't minted a code yet keeps the page useful on first visit.
 */
export async function getReferralStats(userId: string): Promise<ReferralStats> {
  const code = await prisma.referralCode.findUnique({ where: { userId } });
  if (!code) {
    return {
      code: null,
      signups: 0,
      qualifyingOrders: 0,
      earnedMinor: 0,
      pendingPayoutMinor: 0,
      paidPayoutMinor: 0,
      currency: null,
    };
  }

  const attributions = await prisma.referralAttribution.findMany({
    where: { codeId: code.id },
    select: {
      firstOrderId: true,
      payoutMinor: true,
      payoutCurrency: true,
      paidAt: true,
    },
  });

  let qualifyingOrders = 0;
  let earnedMinor = 0;
  let pendingPayoutMinor = 0;
  let paidPayoutMinor = 0;
  let currency: string | null = null;

  for (const a of attributions) {
    if (!a.firstOrderId) continue;
    qualifyingOrders += 1;
    const minor = a.payoutMinor ?? 0;
    earnedMinor += minor;
    if (a.paidAt) paidPayoutMinor += minor;
    else pendingPayoutMinor += minor;
    if (!currency && a.payoutCurrency) currency = a.payoutCurrency;
  }

  return {
    code: code.code,
    signups: attributions.length,
    qualifyingOrders,
    earnedMinor,
    pendingPayoutMinor,
    paidPayoutMinor,
    currency,
  };
}

// Default referrer payout when an attributed user places their first paid
// order. Override via `REFERRAL_PAYOUT_MINOR` env (e.g. `750` = $7.50).
const DEFAULT_PAYOUT_MINOR = Number(process.env.REFERRAL_PAYOUT_MINOR ?? 500);

/**
 * Awards the referrer when a buyer's first order lands. Idempotent — uses
 * `updateMany` with a `firstOrderId: null` predicate so a webhook replay
 * (or a same-buyer second order) doesn't double-credit.
 *
 * Returns the number of attributions actually awarded (0 or 1) so the
 * caller can log the outcome without an extra read.
 */
export async function awardReferralOnFirstOrder(args: {
  buyerId: string;
  orderId: string;
  currency: string;
  payoutMinor?: number;
}): Promise<number> {
  const result = await prisma.referralAttribution.updateMany({
    where: { referredUserId: args.buyerId, firstOrderId: null },
    data: {
      firstOrderId: args.orderId,
      payoutMinor: args.payoutMinor ?? DEFAULT_PAYOUT_MINOR,
      payoutCurrency: args.currency,
    },
  });
  return result.count;
}

/**
 * Records that a newly-signed-up user came in via a referral code. Caller
 * resolves the code from the cookie (or wherever) and passes both ids in.
 *
 * Self-referral is silently dropped — return value tells the caller
 * whether anything actually got written.
 */
export async function recordAttribution(args: {
  code: string;
  referredUserId: string;
}): Promise<boolean> {
  const codeRow = await prisma.referralCode.findUnique({
    where: { code: args.code },
    select: { id: true, userId: true },
  });
  if (!codeRow) return false;
  if (codeRow.userId === args.referredUserId) return false;
  try {
    await prisma.referralAttribution.create({
      data: { codeId: codeRow.id, referredUserId: args.referredUserId },
    });
    return true;
  } catch (err: unknown) {
    // P2002 = referredUserId already attributed. Idempotent: don't error.
    const code = (err as { code?: string }).code;
    if (code === 'P2002') return false;
    throw err;
  }
}
