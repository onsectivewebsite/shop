import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, protectedProcedure, userMutationRateLimit } from '../trpc';
import { prisma } from '../db';
import { notifyNewMessage } from '../messaging';

/**
 * Buyer-side messaging. A Conversation is anchored 1:1 to an OrderItem so
 * the buyer can only ever message the seller of something they actually
 * bought — there's no "DM any seller" surface and no spam vector. The seller
 * side lives in apps/seller as REST routes (no shared tRPC across subdomains).
 *
 * Read state is per-side timestamps on the Conversation row, not a per-message
 * read-receipt table. Inbox unread = (lastMessageAt > buyerLastReadAt).
 */

const BODY_MIN = 1;
const BODY_MAX = 2000;

export const messagesRouter = router({
  /**
   * Inbox: every conversation the buyer is part of, sorted by most recent
   * activity. Includes the latest message preview and an unread flag so the
   * UI can render badges without a second round-trip per row.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await prisma.conversation.findMany({
      where: { buyerId: ctx.user.id },
      orderBy: [
        { lastMessageAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
      take: 100,
      select: {
        id: true,
        lastMessageAt: true,
        buyerLastReadAt: true,
        seller: { select: { displayName: true, slug: true } },
        orderItem: {
          select: {
            productTitle: true,
            order: { select: { orderNumber: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { body: true, authorRole: true, createdAt: true },
        },
      },
    });

    return rows.map((c) => {
      const last = c.messages[0];
      const unread =
        !!c.lastMessageAt &&
        (!c.buyerLastReadAt || c.lastMessageAt > c.buyerLastReadAt) &&
        last?.authorRole === 'SELLER';
      return {
        id: c.id,
        sellerName: c.seller.displayName,
        sellerSlug: c.seller.slug,
        productTitle: c.orderItem.productTitle,
        orderNumber: c.orderItem.order.orderNumber,
        lastMessageAt: c.lastMessageAt,
        lastMessagePreview: last?.body.slice(0, 140) ?? null,
        lastAuthorRole: last?.authorRole ?? null,
        unread,
      };
    });
  }),

  /**
   * Thread view. Marks the buyer's read cursor before returning so opening
   * the conversation clears the unread badge — the cost is one write per
   * open, which is fine for the volume.
   */
  get: protectedProcedure
    .input(z.object({ conversationId: z.string() }))
    .query(async ({ ctx, input }) => {
      const conv = await prisma.conversation.findFirst({
        where: { id: input.conversationId, buyerId: ctx.user.id },
        select: {
          id: true,
          createdAt: true,
          seller: { select: { displayName: true, slug: true } },
          orderItem: {
            select: {
              productTitle: true,
              variant: { select: { product: { select: { slug: true, images: true } } } },
              order: { select: { orderNumber: true } },
            },
          },
          messages: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              authorRole: true,
              body: true,
              isHidden: true,
              createdAt: true,
            },
          },
        },
      });
      if (!conv) throw new TRPCError({ code: 'NOT_FOUND' });

      // Mark read; ignore if it races with a parallel read.
      await prisma.conversation.update({
        where: { id: conv.id },
        data: { buyerLastReadAt: new Date() },
      });

      // Scrub hidden bodies before they leave the server. The row is kept
      // in the DB for moderation audit but the buyer surface gets a
      // placeholder so the thread visually reflects the takedown.
      return {
        ...conv,
        messages: conv.messages.map((m) =>
          m.isHidden ? { ...m, body: '[Hidden by moderation]' } : m,
        ),
      };
    }),

  /**
   * Get-or-create the conversation for a given OrderItem. Idempotent on
   * orderItemId (unique on schema). Caller is the buyer; we verify ownership
   * before minting so the seller id stamped on the conversation is correct.
   */
  startFromOrderItem: protectedProcedure
    .use(userMutationRateLimit)
    .input(z.object({ orderItemId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const item = await prisma.orderItem.findUnique({
        where: { id: input.orderItemId },
        select: {
          id: true,
          sellerId: true,
          order: { select: { buyerId: true } },
        },
      });
      if (!item || item.order.buyerId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const existing = await prisma.conversation.findUnique({
        where: { orderItemId: item.id },
        select: { id: true },
      });
      if (existing) return { id: existing.id };

      try {
        const created = await prisma.conversation.create({
          data: {
            orderItemId: item.id,
            buyerId: ctx.user.id,
            sellerId: item.sellerId,
          },
          select: { id: true },
        });
        return { id: created.id };
      } catch (err: unknown) {
        // P2002 = race lost; the other writer already minted it. Fetch and
        // return that one — the contract is "get or create".
        if ((err as { code?: string }).code === 'P2002') {
          const winner = await prisma.conversation.findUnique({
            where: { orderItemId: item.id },
            select: { id: true },
          });
          if (winner) return { id: winner.id };
        }
        throw err;
      }
    }),

  send: protectedProcedure
    .use(userMutationRateLimit)
    .input(
      z.object({
        conversationId: z.string(),
        body: z.string().trim().min(BODY_MIN).max(BODY_MAX),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const conv = await prisma.conversation.findFirst({
        where: { id: input.conversationId, buyerId: ctx.user.id },
        select: { id: true },
      });
      if (!conv) throw new TRPCError({ code: 'NOT_FOUND' });

      const now = new Date();
      const [message] = await prisma.$transaction([
        prisma.message.create({
          data: {
            conversationId: conv.id,
            authorRole: 'BUYER',
            authorId: ctx.user.id,
            body: input.body,
          },
          select: { id: true, createdAt: true },
        }),
        prisma.conversation.update({
          where: { id: conv.id },
          data: { lastMessageAt: now, buyerLastReadAt: now },
        }),
      ]);
      // Fire-and-forget — never block the buyer's response on SMTP. The
      // notify helper has its own error swallow so the unhandled rejection
      // here is the rare "even logging failed" case.
      void notifyNewMessage({
        conversationId: conv.id,
        fromRole: 'BUYER',
        bodyPreview: input.body,
      });
      return { id: message.id, createdAt: message.createdAt };
    }),

  /**
   * Flag a message in a conversation the buyer is part of. Idempotent on
   * (messageId, reporterId) so a duplicate click swallows the P2002 and
   * the UI just shows "Reported".
   */
  report: protectedProcedure
    .use(userMutationRateLimit)
    .input(
      z.object({
        messageId: z.string(),
        reason: z.enum(['SPAM', 'OFFENSIVE', 'HARASSMENT', 'SCAM', 'OTHER']),
        note: z.string().trim().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Confirm the buyer is a participant in the message's conversation.
      const message = await prisma.message.findFirst({
        where: {
          id: input.messageId,
          conversation: { buyerId: ctx.user.id },
        },
        select: { id: true },
      });
      if (!message) throw new TRPCError({ code: 'NOT_FOUND' });

      try {
        await prisma.messageReport.create({
          data: {
            messageId: message.id,
            reporterId: ctx.user.id,
            reporterRole: 'BUYER',
            reason: input.reason,
            note: input.note,
          },
        });
      } catch (err: unknown) {
        if ((err as { code?: string }).code !== 'P2002') throw err;
      }
      return { ok: true };
    }),
});
