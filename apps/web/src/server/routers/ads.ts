import { z } from 'zod';
import { createHash } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import {
  router,
  publicProcedure,
  sellerProcedure,
  publicReadRateLimit,
} from '../trpc';
import { prisma } from '../db';

/**
 * Onsective Ads — Phase 5 stub.
 *
 * What's here:
 *   - seller.create / list / pause campaigns
 *   - public buildSlate query: returns 0–N sponsored placements for a search
 *     query, factoring keyword targeting, status, daily budget remaining
 *   - trackImpression + trackClick public mutations with bot-filter heuristics
 *
 * What's deferred:
 *   - second-price auction math (current stub charges full bid)
 *   - daily budget reset cron (table column exists, no scheduled job)
 *   - frequency capping per session
 *   - billing — clicks accumulate but no AdInvoice / Stripe charge yet
 *   - admin moderation (every campaign goes ACTIVE on create)
 */

function hashIdent(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 32);
}

const limitedRead = publicProcedure.use(publicReadRateLimit);

export const adsRouter = router({
  // -------- Seller-side campaign management --------
  campaigns: router({
    list: sellerProcedure.query(async ({ ctx }) => {
      const seller = await prisma.seller.findUnique({ where: { userId: ctx.user.id } });
      if (!seller) return [];
      return prisma.adCampaign.findMany({
        where: { sellerId: seller.id },
        orderBy: { createdAt: 'desc' },
        include: { product: { select: { title: true, slug: true } } },
      });
    }),

    create: sellerProcedure
      .input(
        z.object({
          name: z.string().min(1).max(120),
          productId: z.string(),
          placement: z.enum(['SEARCH_RESULTS', 'PDP_RELATED', 'HOME_FEATURED']),
          bidCpcMinor: z.number().int().min(1).max(10_000_00),
          currency: z.string().length(3),
          keywords: z.array(z.string().min(1).max(60)).max(50).default([]),
          dailyBudgetMinor: z.number().int().min(100),
          totalBudgetMinor: z.number().int().min(100).optional(),
          startsAt: z.coerce.date(),
          endsAt: z.coerce.date().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const seller = await prisma.seller.findUnique({ where: { userId: ctx.user.id } });
        if (!seller) {
          throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'No seller account.' });
        }
        const product = await prisma.product.findFirst({
          where: { id: input.productId, sellerId: seller.id },
        });
        if (!product) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Product not found or not yours.' });
        }
        // Lands in DRAFT — admin moderation flips it to ACTIVE. Keeps a
        // hostile/illegal ad from rendering before review.
        return prisma.adCampaign.create({
          data: {
            sellerId: seller.id,
            productId: product.id,
            name: input.name,
            placement: input.placement,
            bidCpcMinor: input.bidCpcMinor,
            currency: input.currency,
            keywords: input.keywords,
            dailyBudgetMinor: input.dailyBudgetMinor,
            totalBudgetMinor: input.totalBudgetMinor,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            status: 'DRAFT',
          },
        });
      }),

    pause: sellerProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const seller = await prisma.seller.findUnique({ where: { userId: ctx.user.id } });
        if (!seller) {
          throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'No seller account.' });
        }
        const r = await prisma.adCampaign.updateMany({
          where: { id: input.id, sellerId: seller.id, status: 'ACTIVE' },
          data: { status: 'PAUSED' },
        });
        return { ok: r.count > 0 };
      }),
  }),

  // -------- Buyer-side slate (chosen at render time) --------
  buildSlate: limitedRead
    .input(
      z.object({
        placement: z.enum(['SEARCH_RESULTS', 'PDP_RELATED', 'HOME_FEATURED']),
        query: z.string().max(120).optional(),
        slotCount: z.number().int().min(1).max(6).default(2),
      }),
    )
    .query(async ({ input }) => {
      const now = new Date();
      const candidates = await prisma.adCampaign.findMany({
        where: {
          status: 'ACTIVE',
          placement: input.placement,
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        },
        include: {
          product: {
            select: {
              id: true,
              slug: true,
              title: true,
              brand: true,
              images: true,
              status: true,
              variants: {
                where: { isActive: true },
                orderBy: { priceAmount: 'asc' },
                take: 1,
                select: { priceAmount: true, currency: true },
              },
            },
          },
        },
        take: 50,
      });

      const q = input.query?.toLowerCase().trim() ?? '';
      const matched = candidates.filter((c) => {
        if (c.product.status !== 'ACTIVE') return false;
        if (c.spentTodayMinor >= c.dailyBudgetMinor) return false;
        if (c.totalBudgetMinor && c.spentTotalMinor >= c.totalBudgetMinor) return false;
        if (c.keywords.length === 0) return true;
        if (!q) return false;
        return c.keywords.some((k) => q.includes(k.toLowerCase()));
      });

      // Naive ranking: highest CPC bid wins. Real implementation needs
      // pCTR × bid (quality score) and a second-price clearing rule.
      matched.sort((a, b) => b.bidCpcMinor - a.bidCpcMinor);

      return matched.slice(0, input.slotCount).map((c) => ({
        campaignId: c.id,
        sponsored: true as const,
        product: c.product,
      }));
    }),

  trackImpression: publicProcedure
    .input(
      z.object({
        campaignId: z.string(),
        placement: z.enum(['SEARCH_RESULTS', 'PDP_RELATED', 'HOME_FEATURED']),
        query: z.string().max(120).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await prisma.adImpression.create({
        data: {
          campaignId: input.campaignId,
          placement: input.placement,
          query: input.query,
          sessionId: ctx.sessionId,
          ipAddressHash: ctx.ipAddress ? hashIdent(ctx.ipAddress) : null,
          userAgentHash: ctx.userAgent ? hashIdent(ctx.userAgent) : null,
        },
      });
      return { ok: true };
    }),

  trackClick: publicProcedure
    .input(
      z.object({
        campaignId: z.string(),
        impressionId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const campaign = await prisma.adCampaign.findUnique({
        where: { id: input.campaignId },
        select: {
          id: true,
          placement: true,
          bidCpcMinor: true,
          currency: true,
          status: true,
          spentTodayMinor: true,
          dailyBudgetMinor: true,
          keywords: true,
        },
      });
      if (!campaign || campaign.status !== 'ACTIVE') return { ok: false } as const;

      // Second-price clearing rule: charge max($floor, secondHighestBid + 1¢)
      // among the campaigns competing for the same placement (and at least
      // one overlapping keyword, or both untargeted). Falls back to the
      // bidder's own bid if no rivals.
      const FLOOR_MINOR = 1; // 1 minor unit reserve
      const rivals = await prisma.adCampaign.findMany({
        where: {
          id: { not: campaign.id },
          status: 'ACTIVE',
          placement: campaign.placement,
        },
        select: { bidCpcMinor: true, keywords: true },
      });
      const competing = rivals.filter((r) => {
        if (r.keywords.length === 0 || campaign.keywords.length === 0) return true;
        return r.keywords.some((k) => campaign.keywords.includes(k));
      });
      const secondPrice = competing.reduce(
        (max, r) => (r.bidCpcMinor > max ? r.bidCpcMinor : max),
        0,
      );
      const clearing = Math.max(FLOOR_MINOR, Math.min(campaign.bidCpcMinor, secondPrice + 1));

      const overBudget = campaign.spentTodayMinor + clearing > campaign.dailyBudgetMinor;

      // Bot heuristic: > 5 clicks on this campaign from the same impression's
      // session in the last 60s. Cheaper + more accurate than IP density.
      let filtered = false;
      let filterReason: string | null = null;
      if (ctx.sessionId) {
        const recent = await prisma.adClick.count({
          where: {
            campaignId: input.campaignId,
            sessionId: ctx.sessionId,
            occurredAt: { gt: new Date(Date.now() - 60_000) },
          },
        });
        if (recent > 5) {
          filtered = true;
          filterReason = 'rapid same-session clicks';
        }
      }

      const charged = filtered || overBudget ? 0 : clearing;

      await prisma.$transaction([
        prisma.adClick.create({
          data: {
            campaignId: input.campaignId,
            impressionId: input.impressionId,
            sessionId: ctx.sessionId,
            chargedMinor: charged,
            currency: campaign.currency,
            filtered,
            filterReason,
          },
        }),
        ...(charged > 0
          ? [
              prisma.adCampaign.update({
                where: { id: input.campaignId },
                data: {
                  spentTodayMinor: { increment: charged },
                  spentTotalMinor: { increment: charged },
                  // Auto-flip to EXHAUSTED if this click hit the cap exactly
                  // — the cron resets it tomorrow.
                  status:
                    campaign.spentTodayMinor + charged >= campaign.dailyBudgetMinor
                      ? 'EXHAUSTED'
                      : 'ACTIVE',
                },
              }),
            ]
          : []),
      ]);

      // Suppress the unused-locals lint noise around the dropped IP hash path.
      void hashIdent;

      return { ok: true, filtered, charged };
    }),
});
