import { prisma } from '@onsective/db';

/**
 * FX-rate lookup + minor-unit conversion. The FxRate table stores daily
 * snapshots; this module reads the latest one for a (base, quote) pair and
 * does the math. All conversions happen on the server — the client never
 * sees rates other than the converted result for display.
 */

const STALE_AFTER_DAYS = 7;
const STALE_AFTER_MS = STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;

export type FxLookup = {
  rate: number;
  fetchedAt: Date;
  source: string;
};

/**
 * Latest non-stale rate for (base → quote). Returns null when:
 *   - the pair has never been fetched (cron hasn't run for these
 *     currencies yet, or they're not in the source's coverage), or
 *   - the latest rate is older than STALE_AFTER_DAYS — we'd rather refuse
 *     a conversion than use a week-old rate during volatile periods.
 *
 * Same-currency identity (USD→USD) returns 1.0 instantly, no DB hit.
 */
export async function getLatestRate(
  base: string,
  quote: string,
): Promise<FxLookup | null> {
  if (base === quote) {
    return { rate: 1, fetchedAt: new Date(), source: 'identity' };
  }
  const row = await prisma.fxRate.findFirst({
    where: { base, quote },
    orderBy: { fetchedAt: 'desc' },
    select: { rate: true, fetchedAt: true, source: true },
  });
  if (!row) return null;
  if (row.fetchedAt.getTime() < Date.now() - STALE_AFTER_MS) return null;
  return {
    rate: Number(row.rate),
    fetchedAt: row.fetchedAt,
    source: row.source,
  };
}

/**
 * Convert minor-unit `amount` from `base` to `quote` using the supplied
 * rate. Rounds half-down (toward zero) so the platform never grants the
 * buyer a fraction of a cent extra — this is the same conservative bias
 * Stripe uses for marketplace splits.
 */
export function convertMinor(amountMinor: number, rate: number): number {
  if (amountMinor === 0) return 0;
  // Math.floor matches "round toward zero" for non-negative inputs and
  // "round away from zero" for negatives, which is what we want for credit:
  // positive credits round down (platform-favourable) and negative
  // refunds round down in absolute value (also platform-favourable).
  return Math.floor((amountMinor * rate * 100) / 100) | 0;
}

/**
 * One-shot helper for the common case: caller has a source-currency amount
 * and wants to know how much it's worth in the target currency right now.
 * Returns null when no fresh rate is available — caller falls back to
 * same-currency-only UX.
 */
export async function quoteCrossCurrency(args: {
  amountMinor: number;
  fromCurrency: string;
  toCurrency: string;
}): Promise<{ amountMinor: number; rate: number; fetchedAt: Date } | null> {
  const lookup = await getLatestRate(args.fromCurrency, args.toCurrency);
  if (!lookup) return null;
  return {
    amountMinor: convertMinor(args.amountMinor, lookup.rate),
    rate: lookup.rate,
    fetchedAt: lookup.fetchedAt,
  };
}
