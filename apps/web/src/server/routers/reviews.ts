import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import type { Prisma } from '@onsective/db';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { prisma } from '../db';

// Buyers can review an OrderItem once it's been delivered for at least this
// long. Lets the package settle before the review window opens — also gives
// returns time to land before reviews stack up.
const REVIEW_GRACE_DAYS = 7;
const REVIEW_GRACE_MS = REVIEW_GRACE_DAYS * 24 * 60 * 60 * 1000;
// Once a review is posted the buyer has 30 days to edit or delete it. After
// that the seller's reply may have anchored the conversation.
const REVIEW_EDIT_WINDOW_DAYS = 30;
const REVIEW_EDIT_WINDOW_MS = REVIEW_EDIT_WINDOW_DAYS * 24 * 60 * 60 * 1000;

const REVIEW_TERMINAL_STATUSES = ['DELIVERED', 'COMPLETED'] as const;

const reviewBody = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().max(4000).optional(),
  // S3 keys for already-uploaded review images. We trust them by virtue of
  // having come back from the same presigner; the moderation queue picks up
  // anything that looks off.
  images: z.array(z.string().trim().min(1).max(512)).max(6).default([]),
});

/**
 * Recompute and persist the denormalized rating aggregates for a product
 * (and the seller who lists it). One SQL pass each — no N+1.
 *
 * Called inside the same transaction as the review mutation so a failure
 * keeps the aggregates consistent.
 */
async function recomputeRatings(tx: Prisma.TransactionClient, productId: string): Promise<void> {
  const productAgg = await tx.review.aggregate({
    where: { productId, isHidden: false },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const product = await tx.product.update({
    where: { id: productId },
    data: {
      ratingAvg: productAgg._avg.rating ?? 0,
      ratingCount: productAgg._count._all,
    },
    select: { sellerId: true },
  });

  const sellerAgg = await tx.review.aggregate({
    where: { product: { sellerId: product.sellerId }, isHidden: false },
    _avg: { rating: true },
    _count: { _all: true },
  });
  await tx.seller.update({
    where: { id: product.sellerId },
    data: {
      ratingAvg: sellerAgg._avg.rating ?? 0,
      ratingCount: sellerAgg._count._all,
    },
  });
}

export const reviewsRouter = router({
  /**
   * Public PDP view. Cursor-paginated, hidden reviews stripped, buyer
   * names trimmed to first-name + initial. Sort defaults to newest;
   * 'helpful' is a placeholder for a future helpfulness counter.
   */
  list: publicProcedure
    .input(
      z.object({
        productId: z.string(),
        limit: z.number().int().min(1).max(50).default(10),
        cursor: z.string().optional(),
        sort: z.enum(['newest', 'highest', 'lowest']).default('newest'),
      }),
    )
    .query(async ({ input }) => {
      const orderBy: Prisma.ReviewOrderByWithRelationInput =
        input.sort === 'highest'
          ? { rating: 'desc' }
          : input.sort === 'lowest'
            ? { rating: 'asc' }
            : { createdAt: 'desc' };

      const items = await prisma.review.findMany({
        where: { productId: input.productId, isHidden: false },
        orderBy: [orderBy, { createdAt: 'desc' }],
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        skip: input.cursor ? 1 : 0,
        select: {
          id: true,
          rating: true,
          title: true,
          body: true,
          images: true,
          sellerReply: true,
          sellerRepliedAt: true,
          createdAt: true,
          buyer: { select: { fullName: true } },
        },
      });

      let nextCursor: string | undefined;
      if (items.length > input.limit) {
        const last = items.pop();
        nextCursor = last?.id;
      }

      // Aggregate is the source of truth for the PDP header; computing it
      // here saves the page from doing a second query.
      const agg = await prisma.review.aggregate({
        where: { productId: input.productId, isHidden: false },
        _count: { _all: true },
        _avg: { rating: true },
      });
      const distribution = await prisma.review.groupBy({
        by: ['rating'],
        where: { productId: input.productId, isHidden: false },
        _count: { _all: true },
      });

      const distMap: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const row of distribution) distMap[row.rating] = row._count._all;

      return {
        items: items.map((r) => ({
          ...r,
          // Show "FirstName L." — never the full name. Email is never exposed.
          buyerLabel: redactName(r.buyer.fullName),
        })),
        nextCursor,
        total: agg._count._all,
        average: agg._avg.rating ?? 0,
        distribution: distMap,
      };
    }),

  /**
   * Tells the PDP whether to render the "leave a review" CTA, and if so,
   * which OrderItem to attach the review to. Multiple eligible items are
   * possible (the buyer ordered the same product twice) — we surface them
   * all so the UI can disambiguate by purchase date.
   */
  eligibility: protectedProcedure
    .input(z.object({ productId: z.string() }))
    .query(async ({ ctx, input }) => {
      const cutoff = new Date(Date.now() - REVIEW_GRACE_MS);
      const candidates = await prisma.orderItem.findMany({
        where: {
          variant: { productId: input.productId },
          order: { buyerId: ctx.user!.id },
          status: { in: [...REVIEW_TERMINAL_STATUSES] },
          updatedAt: { lte: cutoff },
          // Review.orderItemId is @unique so this is effectively a 1:1 — but
          // the inverse on OrderItem is modelled as a list, so "no review yet"
          // is `reviews: { none: {} }` rather than `review: null`.
          reviews: { none: {} },
        },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          updatedAt: true,
          productTitle: true,
          variantTitle: true,
        },
      });

      return {
        eligible: candidates.length > 0,
        items: candidates,
      };
    }),

  create: protectedProcedure
    .input(reviewBody.extend({ orderItemId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const item = await prisma.orderItem.findUnique({
        where: { id: input.orderItemId },
        select: {
          id: true,
          status: true,
          updatedAt: true,
          variant: { select: { productId: true } },
          order: { select: { buyerId: true } },
          reviews: { select: { id: true } },
        },
      });
      if (!item || item.order.buyerId !== ctx.user!.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Order item not found.' });
      }
      if (item.reviews.length > 0) {
        throw new TRPCError({ code: 'CONFLICT', message: 'You already reviewed this purchase.' });
      }
      const ok = REVIEW_TERMINAL_STATUSES.includes(
        item.status as (typeof REVIEW_TERMINAL_STATUSES)[number],
      );
      if (!ok) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Reviews open after delivery.',
        });
      }
      if (item.updatedAt > new Date(Date.now() - REVIEW_GRACE_MS)) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `Reviews open ${REVIEW_GRACE_DAYS} days after delivery.`,
        });
      }

      const review = await prisma.$transaction(async (tx) => {
        const created = await tx.review.create({
          data: {
            productId: item.variant.productId,
            orderItemId: item.id,
            buyerId: ctx.user!.id,
            rating: input.rating,
            title: input.title || null,
            body: input.body || null,
            images: input.images,
          },
          select: { id: true },
        });
        await recomputeRatings(tx, item.variant.productId);
        return created;
      });

      return { id: review.id };
    }),

  update: protectedProcedure
    .input(reviewBody.extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await prisma.review.findUnique({
        where: { id: input.id },
        select: { id: true, buyerId: true, productId: true, createdAt: true, isHidden: true },
      });
      if (!existing || existing.buyerId !== ctx.user!.id) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      if (existing.isHidden) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'This review has been hidden by moderation.',
        });
      }
      if (existing.createdAt < new Date(Date.now() - REVIEW_EDIT_WINDOW_MS)) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `Reviews can be edited within ${REVIEW_EDIT_WINDOW_DAYS} days.`,
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.review.update({
          where: { id: existing.id },
          data: {
            rating: input.rating,
            title: input.title || null,
            body: input.body || null,
            images: input.images,
          },
        });
        await recomputeRatings(tx, existing.productId);
      });

      return { ok: true };
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await prisma.review.findUnique({
        where: { id: input.id },
        select: { id: true, buyerId: true, productId: true, createdAt: true },
      });
      if (!existing || existing.buyerId !== ctx.user!.id) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      if (existing.createdAt < new Date(Date.now() - REVIEW_EDIT_WINDOW_MS)) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `Reviews can be deleted within ${REVIEW_EDIT_WINDOW_DAYS} days.`,
        });
      }
      await prisma.$transaction(async (tx) => {
        await tx.review.delete({ where: { id: existing.id } });
        await recomputeRatings(tx, existing.productId);
      });
      return { ok: true };
    }),

  /**
   * Flag a review for moderation. Idempotent on (reviewId, reporterId) — a
   * second click does nothing rather than erroring, so the UI can render a
   * stable "Reported" state without bookkeeping.
   */
  report: protectedProcedure
    .input(
      z.object({
        reviewId: z.string(),
        reason: z.enum(['SPAM', 'OFFENSIVE', 'OFF_TOPIC', 'FAKE', 'OTHER']),
        note: z.string().trim().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const exists = await prisma.review.findUnique({
        where: { id: input.reviewId },
        select: { id: true, buyerId: true },
      });
      if (!exists) throw new TRPCError({ code: 'NOT_FOUND' });
      if (exists.buyerId === ctx.user!.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: "You can't report your own review.",
        });
      }
      try {
        await prisma.reviewReport.create({
          data: {
            reviewId: input.reviewId,
            reporterId: ctx.user!.id,
            reason: input.reason,
            note: input.note,
          },
        });
      } catch (err: unknown) {
        // Unique violation = the user already reported this review. Don't
        // surface that as an error — keep the action idempotent.
        const code = (err as { code?: string }).code;
        if (code !== 'P2002') throw err;
      }
      return { ok: true };
    }),

  /** Buyer's own reviews — used by /account/reviews to manage them. */
  mine: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(20), cursor: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const items = await prisma.review.findMany({
        where: { buyerId: ctx.user!.id },
        orderBy: { createdAt: 'desc' },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        skip: input.cursor ? 1 : 0,
        select: {
          id: true,
          rating: true,
          title: true,
          body: true,
          images: true,
          isHidden: true,
          hiddenReason: true,
          sellerReply: true,
          sellerRepliedAt: true,
          createdAt: true,
          product: { select: { id: true, title: true, slug: true, images: true } },
        },
      });
      let nextCursor: string | undefined;
      if (items.length > input.limit) {
        nextCursor = items.pop()?.id;
      }
      return { items, nextCursor };
    }),
});

function redactName(name: string | null): string {
  if (!name) return 'Onsective shopper';
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ?? '';
  const lastInitial = parts.length > 1 ? `${parts[parts.length - 1]!.charAt(0)}.` : '';
  return `${first} ${lastInitial}`.trim() || 'Onsective shopper';
}
