'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@onsective/db';
import { getConsoleSession } from '@/server/auth';
import { audit } from '@/lib/audit';

/**
 * Hide a review and clear its reports. Audit-logged with the reason given by
 * the moderator, which is also written to Review.hiddenReason so the buyer
 * sees it on /account/reviews.
 */
export async function hideReviewAction(reviewId: string, formData: FormData): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  const reason = (formData.get('reason') ?? '').toString().trim();
  if (!reason) throw new Error('Reason required');

  const existing = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { id: true, productId: true, buyerId: true, isHidden: true },
  });
  if (!existing) throw new Error('Review not found');

  await prisma.$transaction([
    prisma.review.update({
      where: { id: reviewId },
      data: { isHidden: true, hiddenReason: reason.slice(0, 500) },
    }),
    prisma.reviewReport.deleteMany({ where: { reviewId } }),
  ]);

  // Hidden reviews don't count toward Product/Seller aggregates — recompute
  // both so the storefront stops counting this rating.
  await recomputeProductRatings(existing.productId);

  await audit({
    actorId: session.user.id,
    action: 'review.hide',
    targetType: 'review',
    targetId: reviewId,
    metadata: { reason: reason.slice(0, 500) },
  });

  revalidatePath('/dashboard/reviews');
}

export async function dismissReportsAction(reviewId: string): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  const result = await prisma.reviewReport.deleteMany({ where: { reviewId } });

  await audit({
    actorId: session.user.id,
    action: 'review.report.dismiss',
    targetType: 'review',
    targetId: reviewId,
    metadata: { dismissedCount: result.count },
  });

  revalidatePath('/dashboard/reviews');
}

export async function unhideReviewAction(reviewId: string): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { id: true, productId: true, isHidden: true },
  });
  if (!review || !review.isHidden) return;

  await prisma.review.update({
    where: { id: reviewId },
    data: { isHidden: false, hiddenReason: null },
  });

  await recomputeProductRatings(review.productId);

  await audit({
    actorId: session.user.id,
    action: 'review.unhide',
    targetType: 'review',
    targetId: reviewId,
  });

  revalidatePath('/dashboard/reviews');
}

/**
 * Mirror the buyer-side recomputeRatings helper. Done here in plain Prisma
 * (without a transaction client) because the audit + hide steps already ran
 * and only the aggregate refresh remains.
 */
async function recomputeProductRatings(productId: string): Promise<void> {
  const productAgg = await prisma.review.aggregate({
    where: { productId, isHidden: false },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const product = await prisma.product.update({
    where: { id: productId },
    data: {
      ratingAvg: productAgg._avg.rating ?? 0,
      ratingCount: productAgg._count._all,
    },
    select: { sellerId: true },
  });

  const sellerAgg = await prisma.review.aggregate({
    where: { product: { sellerId: product.sellerId }, isHidden: false },
    _avg: { rating: true },
    _count: { _all: true },
  });
  await prisma.seller.update({
    where: { id: product.sellerId },
    data: {
      ratingAvg: sellerAgg._avg.rating ?? 0,
      ratingCount: sellerAgg._count._all,
    },
  });
}
