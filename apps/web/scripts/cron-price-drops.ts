/* eslint-disable no-console */
import { prisma } from '../src/server/db';
import { sendPriceDropDigestEmail } from '../src/server/notifications';

/**
 * Daily wishlist price-drop digest.
 *
 *   pnpm --filter @onsective/web cron:price-drops
 *
 * Eligibility per WishlistItem:
 *   - priceAtSaveMinor IS NOT NULL (we have a baseline to compare against)
 *   - product.status = ACTIVE (don't surface dead listings)
 *   - product has at least one active variant
 *   - cheapest active variant.priceAmount <= floor(priceAtSaveMinor * 0.9)
 *     (≥10% drop — small wiggles aren't worth notifying)
 *   - dropEmailedAt IS NULL OR > 30 days ago (cooldown so a chronically
 *     discounted item doesn't keep ringing)
 *   - user.status = ACTIVE + emailMarketingOptIn = true
 *
 * After a successful send we re-baseline `priceAtSaveMinor` to the new
 * (lower) price so the *next* drop is measured from there — captures
 * continuing slides naturally without re-notifying within the cooldown.
 *
 * Items grouped per buyer so each buyer gets one digest per run regardless
 * of how many wishlisted items dropped.
 */

const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
const DROP_THRESHOLD = 0.9; // 10% off baseline

async function main() {
  const cutoff = new Date(Date.now() - COOLDOWN_MS);

  const candidates = await prisma.wishlistItem.findMany({
    where: {
      priceAtSaveMinor: { not: null },
      OR: [{ dropEmailedAt: null }, { dropEmailedAt: { lt: cutoff } }],
      user: { status: 'ACTIVE', emailMarketingOptIn: true },
      product: { status: 'ACTIVE' },
    },
    select: {
      id: true,
      priceAtSaveMinor: true,
      priceCurrency: true,
      user: { select: { id: true, email: true } },
      product: {
        select: {
          title: true,
          slug: true,
          variants: {
            where: { isActive: true },
            orderBy: { priceAmount: 'asc' },
            take: 1,
            select: { priceAmount: true, currency: true },
          },
        },
      },
    },
    take: 5000,
  });

  type Row = {
    wishlistItemId: string;
    productTitle: string;
    productSlug: string;
    wasMinor: number;
    nowMinor: number;
    currency: string;
  };
  type Bucket = { email: string; rows: Row[] };

  const buckets = new Map<string, Bucket>();

  for (const item of candidates) {
    const baseline = item.priceAtSaveMinor;
    if (baseline === null || !item.user.email) continue;
    const cheapest = item.product.variants[0];
    if (!cheapest) continue;
    // Currency-strict: a baseline in USD shouldn't compare to an INR price.
    // Skip mismatches (rare — variants don't change currency).
    if (item.priceCurrency && cheapest.currency !== item.priceCurrency) continue;

    const threshold = Math.floor(baseline * DROP_THRESHOLD);
    if (cheapest.priceAmount > threshold) continue;

    let bucket = buckets.get(item.user.id);
    if (!bucket) {
      bucket = { email: item.user.email, rows: [] };
      buckets.set(item.user.id, bucket);
    }
    bucket.rows.push({
      wishlistItemId: item.id,
      productTitle: item.product.title,
      productSlug: item.product.slug,
      wasMinor: baseline,
      nowMinor: cheapest.priceAmount,
      currency: cheapest.currency,
    });
  }

  if (buckets.size === 0) {
    console.log('[price-drops] no buyers need a digest this run');
    return;
  }

  let sentBuyers = 0;
  let stampedItems = 0;
  for (const bucket of buckets.values()) {
    try {
      await sendPriceDropDigestEmail(bucket.email, { rows: bucket.rows });
      // Re-baseline to the new price + stamp the cooldown. Done in one
      // updateMany since each item gets its own (now, nowMinor) tuple —
      // but we'd need a per-row update for that. Use a $transaction of
      // per-row updates instead.
      const stamp = new Date();
      await prisma.$transaction(
        bucket.rows.map((r) =>
          prisma.wishlistItem.update({
            where: { id: r.wishlistItemId },
            data: {
              priceAtSaveMinor: r.nowMinor,
              priceCurrency: r.currency,
              dropEmailedAt: stamp,
            },
          }),
        ),
      );
      sentBuyers += 1;
      stampedItems += bucket.rows.length;
    } catch (err) {
      console.error(`[price-drops] send failed for ${bucket.email}:`, err);
    }
  }

  console.log(
    `[price-drops] sent ${sentBuyers} digest(s) covering ${stampedItems} item(s)`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[price-drops] fatal:', err);
    process.exit(1);
  });
