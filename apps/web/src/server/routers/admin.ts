import { z } from 'zod';
import { router, adminProcedure, adminRateLimit } from '../trpc';
import { prisma } from '../db';
import { enqueueSearchReindex } from '../queue';

const limitedAdmin = adminProcedure.use(adminRateLimit);

export const adminRouter = router({
  sellers: router({
    pending: adminProcedure.query(async () => {
      return prisma.seller.findMany({
        where: { status: { in: ['PENDING_KYC', 'KYC_SUBMITTED'] } },
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { email: true, fullName: true } }, kycDocuments: true },
      });
    }),

    approve: limitedAdmin
      .input(z.object({ sellerId: z.string(), notes: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        return prisma.seller.update({
          where: { id: input.sellerId },
          data: {
            status: 'APPROVED',
            approvedAt: new Date(),
            approvedBy: ctx.user.id,
          },
        });
      }),

    reject: limitedAdmin
      .input(z.object({ sellerId: z.string(), reason: z.string().min(1) }))
      .mutation(async ({ input }) => {
        return prisma.seller.update({
          where: { id: input.sellerId },
          data: { status: 'REJECTED', suspendedReason: input.reason },
        });
      }),
  }),

  products: router({
    pendingReview: adminProcedure.query(async () => {
      return prisma.product.findMany({
        where: { status: 'PENDING_REVIEW' },
        orderBy: { createdAt: 'asc' },
        take: 100,
        include: { seller: { select: { displayName: true } } },
      });
    }),

    approve: limitedAdmin
      .input(z.object({ productId: z.string() }))
      .mutation(async ({ input }) => {
        const updated = await prisma.product.update({
          where: { id: input.productId },
          data: { status: 'ACTIVE', publishedAt: new Date() },
        });
        await enqueueSearchReindex(updated.id);
        return updated;
      }),
  }),
});
