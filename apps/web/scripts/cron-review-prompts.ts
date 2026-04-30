/* eslint-disable no-console */
import { prisma } from '../src/server/db';
import { sendReviewPromptEmail } from '../src/server/notifications';

/**
 * Daily sweep: email buyers whose orders have been delivered for at least 7
 * days and who haven't reviewed (or been prompted on) yet.
 *
 *   pnpm --filter @onsective/web cron:review-prompts
 *
 * Idempotent across runs because we stamp `reviewPromptSentAt` on every item
 * we email about. Items without reviews still won't re-prompt — by design,
 * one nudge per item is enough.
 *
 * Items are grouped by buyer so a 5-item order produces a single email, and
 * the stamp is applied per-item only after the email actually goes out — if
 * SMTP fails the items stay re-tryable on the next run.
 */

const REVIEW_GRACE_DAYS = 7;
const REVIEW_GRACE_MS = REVIEW_GRACE_DAYS * 24 * 60 * 60 * 1000;
// Don't keep nudging on ancient orders — buyers have moved on. The cron
// only revisits items delivered in the last 60 days.
const REVIEW_NUDGE_LOOKBACK_MS = 60 * 24 * 60 * 60 * 1000;

async function main() {
  const now = new Date();
  const cutoff = new Date(now.getTime() - REVIEW_GRACE_MS);
  const lookbackFloor = new Date(now.getTime() - REVIEW_NUDGE_LOOKBACK_MS);

  const eligible = await prisma.orderItem.findMany({
    where: {
      status: { in: ['DELIVERED', 'COMPLETED'] },
      updatedAt: { lte: cutoff, gte: lookbackFloor },
      reviewPromptSentAt: null,
      reviews: { none: {} },
      // Only ping the live buyer email — DELETED accounts have email scrubbed
      // to an `@onsective.invalid` placeholder which would bounce.
      order: { buyer: { status: 'ACTIVE' } },
    },
    select: {
      id: true,
      productTitle: true,
      order: {
        select: {
          orderNumber: true,
          buyerId: true,
          buyer: { select: { email: true } },
        },
      },
      variant: { select: { product: { select: { slug: true } } } },
    },
  });

  if (eligible.length === 0) {
    console.log('[review-prompts] nothing to send');
    return;
  }

  type Bucket = {
    email: string;
    items: Array<{ id: string; orderNumber: string; productTitle: string; productSlug: string }>;
  };
  const byBuyer = new Map<string, Bucket>();
  for (const it of eligible) {
    const buyerId = it.order.buyerId;
    let bucket = byBuyer.get(buyerId);
    if (!bucket) {
      bucket = { email: it.order.buyer.email, items: [] };
      byBuyer.set(buyerId, bucket);
    }
    bucket.items.push({
      id: it.id,
      orderNumber: it.order.orderNumber,
      productTitle: it.productTitle,
      productSlug: it.variant.product.slug,
    });
  }

  let sentBuyers = 0;
  let sentItems = 0;
  let failed = 0;

  for (const [, bucket] of byBuyer) {
    try {
      await sendReviewPromptEmail(bucket.email, {
        items: bucket.items.map((it) => ({
          orderNumber: it.orderNumber,
          productTitle: it.productTitle,
          productSlug: it.productSlug,
        })),
      });
      // Stamp only after the email actually flew, so SMTP failure leaves the
      // items eligible for the next run.
      await prisma.orderItem.updateMany({
        where: { id: { in: bucket.items.map((it) => it.id) } },
        data: { reviewPromptSentAt: now },
      });
      sentBuyers += 1;
      sentItems += bucket.items.length;
    } catch (err) {
      failed += 1;
      console.error(`[review-prompts] email to ${bucket.email} failed:`, err);
    }
  }

  console.log(
    `[review-prompts] emailed ${sentBuyers} ${sentBuyers === 1 ? 'buyer' : 'buyers'} about ${sentItems} ${sentItems === 1 ? 'item' : 'items'}; ${failed} failed`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[review-prompts] failed:', err);
    process.exit(1);
  });
