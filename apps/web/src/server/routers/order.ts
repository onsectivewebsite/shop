import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { prisma } from '../db';

export const orderRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where = { buyerId: ctx.user.id };
      const [items, total] = await Promise.all([
        prisma.order.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (input.page - 1) * input.perPage,
          take: input.perPage,
          include: {
            items: { take: 3, include: { variant: { select: { title: true } } } },
          },
        }),
        prisma.order.count({ where }),
      ]);
      return { items, total, page: input.page, perPage: input.perPage };
    }),

  detail: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ ctx, input }) => {
      return prisma.order.findFirst({
        where: { id: input.orderId, buyerId: ctx.user.id },
        include: {
          items: { include: { variant: { include: { product: true } } } },
          shipments: { include: { trackingEvents: { orderBy: { occurredAt: 'desc' } } } },
          payments: true,
          shippingAddress: true,
        },
      });
    }),
});
