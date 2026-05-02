/* eslint-disable no-console */
import { prisma } from '../src/server/db';
import { sendLowStockDigestEmail } from '../src/server/notifications';

/**
 * Weekly low-stock digest. Surfaces variants that have hit their reorder
 * point so the seller can replenish before listings go dormant.
 *
 *   pnpm --filter @onsective/web cron:low-stock
 *
 * Eligibility per variant:
 *   - isActive = true
 *   - product.status = ACTIVE
 *   - reorderPoint > 0 (zero means seller hasn't set one — opt out)
 *   - (stockQty - reservedQty) <= reorderPoint
 *   - lowStockEmailedAt IS NULL OR > 7 days ago
 *
 * Variants are bucketed per seller so each seller gets a single digest
 * (one email per week per seller, regardless of how many SKUs are low).
 *
 * Idempotency: lowStockEmailedAt is bumped per-variant only after a
 * successful send. A flaky SMTP keeps the variants re-tryable on the next
 * day's run; once the seller restocks, the where-clause naturally excludes
 * them on the following run.
 *
 * Transactional: not gated on emailMarketingOptIn — sellers always need to
 * know about inventory state.
 */

const WEEKLY_THROTTLE_MS = 7 * 24 * 60 * 60 * 1000;

async function main() {
  const cutoff = new Date(Date.now() - WEEKLY_THROTTLE_MS);

  // Prisma can't compare two columns directly in `where`, and the cron
  // is fine being a bit chatty: pull all candidates with a generous filter
  // and trim in JS. Cheap because reorder-point is small relative to the
  // total catalog and most catalogs aren't 100k SKUs.
  const candidates = await prisma.variant.findMany({
    where: {
      isActive: true,
      reorderPoint: { gt: 0 },
      product: { status: 'ACTIVE' },
      OR: [{ lowStockEmailedAt: null }, { lowStockEmailedAt: { lt: cutoff } }],
    },
    select: {
      id: true,
      sku: true,
      title: true,
      stockQty: true,
      reservedQty: true,
      reorderPoint: true,
      product: {
        select: {
          title: true,
          slug: true,
          sellerId: true,
          seller: {
            select: {
              displayName: true,
              user: { select: { email: true, status: true } },
            },
          },
        },
      },
    },
    take: 5000,
  });

  type Row = {
    productTitle: string;
    variantLabel: string | null;
    sku: string;
    available: number;
    reorderPoint: number;
    productSlug: string;
    variantId: string;
  };

  type Bucket = {
    sellerName: string;
    email: string;
    rows: Row[];
  };

  const buckets = new Map<string, Bucket>();

  for (const v of candidates) {
    const available = v.stockQty - v.reservedQty;
    if (available > v.reorderPoint) continue;
    if (v.product.seller.user.status !== 'ACTIVE') continue;
    if (
      !v.product.seller.user.email ||
      v.product.seller.user.email.endsWith('@onsective.invalid')
    ) {
      continue;
    }

    let bucket = buckets.get(v.product.sellerId);
    if (!bucket) {
      bucket = {
        sellerName: v.product.seller.displayName,
        email: v.product.seller.user.email,
        rows: [],
      };
      buckets.set(v.product.sellerId, bucket);
    }
    bucket.rows.push({
      productTitle: v.product.title,
      variantLabel: v.title,
      sku: v.sku,
      available,
      reorderPoint: v.reorderPoint,
      productSlug: v.product.slug,
      variantId: v.id,
    });
  }

  if (buckets.size === 0) {
    console.log('[low-stock] no sellers need a digest this run');
    return;
  }

  let sentSellers = 0;
  let stampedVariants = 0;
  for (const bucket of buckets.values()) {
    try {
      await sendLowStockDigestEmail(bucket.email, {
        sellerName: bucket.sellerName,
        rows: bucket.rows,
      });
      const variantIds = bucket.rows.map((r) => r.variantId);
      const updated = await prisma.variant.updateMany({
        where: { id: { in: variantIds } },
        data: { lowStockEmailedAt: new Date() },
      });
      sentSellers += 1;
      stampedVariants += updated.count;
    } catch (err) {
      console.error(`[low-stock] send failed for ${bucket.email}:`, err);
    }
  }

  console.log(
    `[low-stock] sent ${sentSellers} digest(s) covering ${stampedVariants} variant(s)`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[low-stock] fatal:', err);
    process.exit(1);
  });
