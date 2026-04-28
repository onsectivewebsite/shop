import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, protectedProcedure, userMutationRateLimit } from '../trpc';
import { prisma } from '../db';

/**
 * Buyer-facing RMA endpoints.
 *
 * `request` is the only user-driven write. Approval/rejection lives in the
 * console (server actions, not exposed to the buyer here). Buyers can also
 * cancel their own request while it's still REQUESTED.
 */

const reasonSchema = z.enum([
  'DAMAGED',
  'WRONG_ITEM',
  'NOT_AS_DESCRIBED',
  'NO_LONGER_NEEDED',
  'ARRIVED_LATE',
  'OTHER',
]);

export const returnsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return prisma.return.findMany({
      where: { buyerId: ctx.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        orderItem: {
          select: {
            productTitle: true,
            qty: true,
            unitPrice: true,
            order: { select: { orderNumber: true } },
          },
        },
      },
    });
  }),

  request: protectedProcedure
    .use(userMutationRateLimit)
    .input(
      z.object({
        orderItemId: z.string(),
        reason: reasonSchema,
        buyerNote: z.string().max(2000).optional(),
        qty: z.number().int().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const item = await prisma.orderItem.findFirst({
        where: { id: input.orderItemId, order: { buyerId: ctx.user.id } },
        include: { order: { select: { currency: true, status: true } } },
      });
      if (!item) throw new TRPCError({ code: 'NOT_FOUND', message: 'Order item not found.' });

      // Eligibility: only items past PAID and not already refunded.
      const eligibleStatuses = ['PAID', 'CONFIRMED', 'SHIPPED', 'DELIVERED'];
      if (!eligibleStatuses.includes(item.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot return an item in status ${item.status}.`,
        });
      }

      const existing = await prisma.return.findFirst({
        where: {
          orderItemId: item.id,
          status: { in: ['REQUESTED', 'APPROVED', 'RECEIVED'] },
        },
      });
      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A return is already in flight for this item.',
        });
      }

      const qty = Math.min(input.qty ?? item.qty, item.qty);
      const refundAmount = Math.round((item.lineSubtotal * qty) / item.qty);

      // Sequential RMA number — production should use a Postgres sequence.
      const year = new Date().getFullYear();
      const seq = (await prisma.return.count()) + 1;
      const rmaNumber = `ONS-R-${year}-${String(seq).padStart(6, '0')}`;

      return prisma.return.create({
        data: {
          rmaNumber,
          orderItemId: item.id,
          buyerId: ctx.user.id,
          sellerId: item.sellerId,
          status: 'REQUESTED',
          reason: input.reason,
          buyerNote: input.buyerNote,
          qty,
          refundAmount,
          currency: item.order.currency,
        },
      });
    }),

  cancel: protectedProcedure
    .use(userMutationRateLimit)
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const r = await prisma.return.findFirst({
        where: { id: input.id, buyerId: ctx.user.id, status: 'REQUESTED' },
      });
      if (!r) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Return cannot be cancelled in its current state.',
        });
      }
      return prisma.return.update({
        where: { id: r.id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
    }),
});
