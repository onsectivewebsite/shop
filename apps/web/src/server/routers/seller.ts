import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, sellerProcedure } from '../trpc';
import { prisma } from '../db';
import {
  ALLOWED_IMAGE_MIME,
  MAX_PRODUCT_IMAGE_BYTES,
  createProductImageUploadUrl,
  type AllowedImageMime,
} from '../uploads';
import {
  ensureStripeAccount,
  createOnboardingLink,
  refreshAccountStatus,
} from '../connect';
import { imagesQueue, IMAGE_VARIANTS_JOB, enqueueSearchReindex } from '../queue';

async function getSellerOrThrow(userId: string) {
  const seller = await prisma.seller.findUnique({ where: { userId } });
  if (!seller) {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'No seller account.' });
  }
  return seller;
}

const variantInput = z.object({
  sku: z.string().min(1).max(64),
  title: z.string().optional(),
  attributes: z.record(z.string()).default({}),
  priceAmount: z.number().int().min(0),
  mrpAmount: z.number().int().optional(),
  currency: z.string().length(3),
  stockQty: z.number().int().min(0).default(0),
  weightGrams: z.number().int().min(0),
  lengthMm: z.number().int().min(0),
  widthMm: z.number().int().min(0),
  heightMm: z.number().int().min(0),
});

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 48);
}

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || 'seller';
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = attempt === 0 ? root : `${root}-${Math.random().toString(36).slice(2, 6)}`;
    const exists = await prisma.seller.findUnique({ where: { slug: candidate } });
    if (!exists) return candidate;
  }
  return `${root}-${Date.now().toString(36).slice(-6)}`;
}

export const sellerRouter = router({
  // Public-to-logged-in-user surface for the buyer site /sell flow.
  application: router({
    status: protectedProcedure.query(async ({ ctx }) => {
      const seller = await prisma.seller.findUnique({
        where: { userId: ctx.user.id },
        select: {
          id: true,
          status: true,
          legalName: true,
          displayName: true,
          slug: true,
          countryCode: true,
          stripePayoutsEnabled: true,
          createdAt: true,
        },
      });
      return seller; // null when user hasn't applied yet
    }),

    apply: protectedProcedure
      .input(
        z.object({
          legalName: z.string().min(2).max(120),
          displayName: z.string().min(2).max(80),
          countryCode: z.string().length(2).toUpperCase(),
          description: z.string().max(2000).optional(),
          taxId: z.string().max(64).optional(),
          website: z.string().url().max(200).optional(),
          // Honesty: store, but don't enforce — admin verifies in console.
          categoryHints: z.array(z.string()).max(8).default([]),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const existing = await prisma.seller.findUnique({ where: { userId: ctx.user.id } });
        if (existing) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: `You already applied — current status: ${existing.status}.`,
          });
        }
        const slug = await uniqueSlug(input.displayName);
        const seller = await prisma.seller.create({
          data: {
            userId: ctx.user.id,
            legalName: input.legalName,
            displayName: input.displayName,
            slug,
            countryCode: input.countryCode,
            description: input.description ?? null,
            taxId: input.taxId ?? null,
            status: 'PENDING_KYC',
          },
        });
        // Add SELLER role so they can see /seller dashboard once approved.
        if (!ctx.user.roles.includes('SELLER')) {
          await prisma.user.update({
            where: { id: ctx.user.id },
            data: { roles: { set: [...ctx.user.roles, 'SELLER'] } },
          });
        }
        return { sellerId: seller.id, status: seller.status, slug: seller.slug };
      }),
  }),

  dashboard: router({
    summary: sellerProcedure.query(async ({ ctx }) => {
      const seller = await prisma.seller.findUnique({ where: { userId: ctx.user.id } });
      if (!seller) return null;
      const [productCount, orderCount, openOrders] = await Promise.all([
        prisma.product.count({ where: { sellerId: seller.id, status: 'ACTIVE' } }),
        prisma.orderItem.count({ where: { sellerId: seller.id } }),
        prisma.orderItem.count({
          where: { sellerId: seller.id, status: { in: ['CREATED', 'PAID', 'CONFIRMED'] } },
        }),
      ]);
      return { seller, productCount, orderCount, openOrders };
    }),
  }),

  products: router({
    list: sellerProcedure
      .input(z.object({ page: z.number().int().min(1).default(1) }))
      .query(async ({ ctx, input }) => {
        const seller = await getSellerOrThrow(ctx.user.id);
        const perPage = 24;
        const where = { sellerId: seller.id };
        const [items, total] = await Promise.all([
          prisma.product.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
            skip: (input.page - 1) * perPage,
            take: perPage,
            include: { variants: { take: 1 } },
          }),
          prisma.product.count({ where }),
        ]);
        return { items, total, page: input.page, perPage };
      }),

    create: sellerProcedure
      .input(
        z.object({
          title: z.string().min(3).max(200),
          slug: z.string().min(3).max(200).regex(/^[a-z0-9-]+$/i),
          categoryId: z.string(),
          brand: z.string().optional(),
          description: z.string().min(20),
          bullets: z.array(z.string()).default([]),
          images: z.array(z.string().url()).min(1).max(8),
          countryCode: z.string().length(2).toUpperCase(),
          attributes: z.record(z.string()).optional(),
          variants: z.array(variantInput).min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const seller = await getSellerOrThrow(ctx.user.id);

        const product = await prisma.$transaction(async (tx) => {
          const created = await tx.product.create({
            data: {
              sellerId: seller.id,
              categoryId: input.categoryId,
              title: input.title,
              slug: input.slug,
              brand: input.brand,
              description: input.description,
              bullets: input.bullets,
              images: input.images,
              countryCode: input.countryCode,
              attributes: input.attributes,
              status: 'PENDING_REVIEW',
            },
          });
          for (const v of input.variants) {
            await tx.variant.create({
              data: { ...v, productId: created.id },
            });
          }
          return created;
        });

        // PENDING_REVIEW isn't indexable; indexProductById no-ops on non-ACTIVE.
        // Enqueueing now means the same job dedupes a later approve event.
        await enqueueSearchReindex(product.id);
        return product;
      }),
  }),

  connect: router({
    status: sellerProcedure.query(async ({ ctx }) => {
      const seller = await getSellerOrThrow(ctx.user.id);
      return {
        hasAccount: Boolean(seller.stripeAccountId),
        payoutsEnabled: seller.stripePayoutsEnabled,
        onboardedAt: seller.stripeOnboardedAt,
      };
    }),

    startOnboarding: sellerProcedure
      .input(z.object({ locale: z.string().min(2).max(10) }))
      .mutation(async ({ ctx, input }) => {
        const seller = await getSellerOrThrow(ctx.user.id);
        try {
          const stripeAccountId = await ensureStripeAccount(seller);
          const link = await createOnboardingLink({ stripeAccountId, locale: input.locale });
          return { url: link.url };
        } catch (err) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: err instanceof Error ? err.message : 'Failed to start onboarding.',
          });
        }
      }),

    refreshStatus: sellerProcedure.mutation(async ({ ctx }) => {
      const seller = await getSellerOrThrow(ctx.user.id);
      if (!seller.stripeAccountId) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'No Stripe account yet.' });
      }
      try {
        return await refreshAccountStatus(seller.id);
      } catch (err) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err instanceof Error ? err.message : 'Failed to refresh status.',
        });
      }
    }),
  }),

  uploads: router({
    requestImageUploadUrl: sellerProcedure
      .input(
        z.object({
          contentType: z.enum(ALLOWED_IMAGE_MIME as unknown as [AllowedImageMime, ...AllowedImageMime[]]),
          sizeBytes: z.number().int().positive().max(MAX_PRODUCT_IMAGE_BYTES),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const seller = await getSellerOrThrow(ctx.user.id);
        try {
          return await createProductImageUploadUrl({
            sellerId: seller.id,
            contentType: input.contentType,
            sizeBytes: input.sizeBytes,
          });
        } catch (err) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: err instanceof Error ? err.message : 'Failed to sign upload URL.',
          });
        }
      }),

    confirmImageUpload: sellerProcedure
      .input(
        z.object({
          key: z.string().min(1).max(512),
          contentType: z.enum(ALLOWED_IMAGE_MIME as unknown as [AllowedImageMime, ...AllowedImageMime[]]),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const seller = await getSellerOrThrow(ctx.user.id);
        // Enforce the seller-scoped key prefix so a seller can only enqueue
        // jobs for objects they own.
        const expectedPrefix = `sellers/${seller.id}/`;
        if (!input.key.startsWith(expectedPrefix)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Key does not belong to seller.' });
        }
        await imagesQueue().add(
          IMAGE_VARIANTS_JOB,
          { sourceKey: input.key, contentType: input.contentType },
          {
            jobId: `variants:${input.key}`, // dedupe: don't double-enqueue
            removeOnComplete: { count: 1000 },
            removeOnFail: { count: 5000 },
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
          },
        );
        return { enqueued: true };
      }),
  }),

  orders: router({
    list: sellerProcedure
      .input(z.object({ page: z.number().int().min(1).default(1) }))
      .query(async ({ ctx, input }) => {
        const seller = await getSellerOrThrow(ctx.user.id);
        const perPage = 20;
        const where = { sellerId: seller.id };
        const [items, total] = await Promise.all([
          prisma.orderItem.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (input.page - 1) * perPage,
            take: perPage,
            include: { order: { select: { orderNumber: true } } },
          }),
          prisma.orderItem.count({ where }),
        ]);
        return { items, total, page: input.page, perPage };
      }),
  }),

  analytics: router({
    /**
     * Headline numbers for the dashboard hero. All money is minor units +
     * currency. PAID and CONFIRMED items count toward "delivered revenue";
     * CREATED counts toward "in flight". Refunded items are excluded from
     * sold counts but tracked separately for the returns rate.
     */
    summary: sellerProcedure
      .input(
        z.object({
          fromDays: z.number().int().min(1).max(365).default(30),
        }),
      )
      .query(async ({ ctx, input }) => {
        const seller = await getSellerOrThrow(ctx.user.id);
        const since = new Date(Date.now() - input.fromDays * 24 * 60 * 60 * 1000);

        const [paid, refunded, inFlight, ratings] = await Promise.all([
          prisma.orderItem.findMany({
            where: {
              sellerId: seller.id,
              createdAt: { gte: since },
              status: { in: ['PAID', 'CONFIRMED', 'SHIPPED', 'DELIVERED'] },
            },
            select: {
              lineSubtotal: true,
              commissionAmount: true,
              sellerNetAmount: true,
              qty: true,
              orderId: true,
            },
          }),
          prisma.orderItem.count({
            where: {
              sellerId: seller.id,
              createdAt: { gte: since },
              status: 'REFUNDED',
            },
          }),
          prisma.orderItem.count({
            where: {
              sellerId: seller.id,
              createdAt: { gte: since },
              status: 'CREATED',
            },
          }),
          prisma.review.aggregate({
            where: {
              orderItem: { sellerId: seller.id, createdAt: { gte: since } },
            },
            _avg: { rating: true },
            _count: true,
          }),
        ]);

        const grossRevenue = paid.reduce((acc, i) => acc + i.lineSubtotal, 0);
        const commissionPaid = paid.reduce((acc, i) => acc + i.commissionAmount, 0);
        const netRevenue = paid.reduce((acc, i) => acc + i.sellerNetAmount, 0);
        const unitsSold = paid.reduce((acc, i) => acc + i.qty, 0);
        const ordersCount = new Set(paid.map((i) => i.orderId)).size;
        const aov = ordersCount > 0 ? Math.round(grossRevenue / ordersCount) : 0;
        const returnsRate =
          paid.length > 0 ? refunded / (paid.length + refunded) : 0;

        return {
          fromDays: input.fromDays,
          grossRevenue,
          commissionPaid,
          netRevenue,
          unitsSold,
          ordersCount,
          aov,
          inFlight,
          refunded,
          returnsRate,
          ratingAvg: ratings._avg.rating ?? 0,
          ratingCount: ratings._count,
          currency: 'USD', // multi-currency aggregation lives in Phase 2
        };
      }),

    /**
     * Daily revenue series — naive groupBy on `createdAt::date`. For 30-day
     * windows on small catalogs Prisma's $queryRaw outperforms the in-app
     * group, so we use it.
     */
    salesOverTime: sellerProcedure
      .input(
        z.object({
          fromDays: z.number().int().min(1).max(365).default(30),
        }),
      )
      .query(async ({ ctx, input }) => {
        const seller = await getSellerOrThrow(ctx.user.id);
        const since = new Date(Date.now() - input.fromDays * 24 * 60 * 60 * 1000);
        const rows = await prisma.$queryRaw<
          Array<{ day: Date; revenue: bigint; units: bigint; orders: bigint }>
        >`
          SELECT
            date_trunc('day', oi."createdAt") AS day,
            SUM(oi."lineSubtotal")::bigint    AS revenue,
            SUM(oi."qty")::bigint             AS units,
            COUNT(DISTINCT oi."orderId")::bigint AS orders
          FROM "OrderItem" oi
          WHERE oi."sellerId" = ${seller.id}
            AND oi."createdAt" >= ${since}
            AND oi."status" IN ('PAID', 'CONFIRMED', 'SHIPPED', 'DELIVERED')
          GROUP BY day
          ORDER BY day ASC
        `;
        return rows.map((r) => ({
          day: r.day.toISOString().slice(0, 10),
          revenue: Number(r.revenue),
          units: Number(r.units),
          orders: Number(r.orders),
        }));
      }),

    topProducts: sellerProcedure
      .input(
        z.object({
          fromDays: z.number().int().min(1).max(365).default(30),
          limit: z.number().int().min(1).max(50).default(10),
        }),
      )
      .query(async ({ ctx, input }) => {
        const seller = await getSellerOrThrow(ctx.user.id);
        const since = new Date(Date.now() - input.fromDays * 24 * 60 * 60 * 1000);

        const grouped = await prisma.orderItem.groupBy({
          by: ['variantId'],
          where: {
            sellerId: seller.id,
            createdAt: { gte: since },
            status: { in: ['PAID', 'CONFIRMED', 'SHIPPED', 'DELIVERED'] },
          },
          _sum: { lineSubtotal: true, qty: true },
          orderBy: { _sum: { lineSubtotal: 'desc' } },
          take: input.limit,
        });
        if (grouped.length === 0) return [];

        const variants = await prisma.variant.findMany({
          where: { id: { in: grouped.map((g) => g.variantId) } },
          select: {
            id: true,
            sku: true,
            title: true,
            product: { select: { id: true, slug: true, title: true, images: true } },
          },
        });
        const byId = new Map(variants.map((v) => [v.id, v]));
        return grouped.map((g) => {
          const v = byId.get(g.variantId);
          return {
            variantId: g.variantId,
            sku: v?.sku ?? '',
            productTitle: v?.product.title ?? '',
            productSlug: v?.product.slug ?? '',
            productImage: v?.product.images[0] ?? null,
            revenue: g._sum.lineSubtotal ?? 0,
            units: g._sum.qty ?? 0,
          };
        });
      }),
  }),
});
