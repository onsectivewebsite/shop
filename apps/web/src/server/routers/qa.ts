import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { prisma } from '../db';

const QUESTION_MAX = 600;

function redactName(name: string | null): string {
  if (!name) return 'Onsective shopper';
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ?? '';
  const lastInitial = parts.length > 1 ? `${parts[parts.length - 1]!.charAt(0)}.` : '';
  return `${first} ${lastInitial}`.trim() || 'Onsective shopper';
}

export const qaRouter = router({
  /**
   * Public listing — answered questions float to the top so PDP visitors see
   * the high-signal exchanges first; unanswered questions still render below
   * because they're often the same questions a new visitor wants asked.
   *
   * ProductQuestion has no `asker` Prisma relation declared (askerId is just
   * a string), so we batch-resolve names in a second query.
   */
  list: publicProcedure
    .input(
      z.object({
        productId: z.string(),
        limit: z.number().int().min(1).max(50).default(10),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const items = await prisma.productQuestion.findMany({
        where: { productId: input.productId },
        orderBy: [
          // null answers sort last under "desc" in Postgres by default; the
          // explicit nulls ordering keeps unanswered Qs at the bottom.
          { answeredAt: { sort: 'desc', nulls: 'last' } },
          { createdAt: 'desc' },
        ],
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        skip: input.cursor ? 1 : 0,
        select: {
          id: true,
          askerId: true,
          question: true,
          answer: true,
          answeredAt: true,
          createdAt: true,
        },
      });

      let nextCursor: string | undefined;
      if (items.length > input.limit) {
        nextCursor = items.pop()?.id;
      }

      const askerIds = Array.from(new Set(items.map((q) => q.askerId)));
      const askers = await prisma.user.findMany({
        where: { id: { in: askerIds } },
        select: { id: true, fullName: true },
      });
      const nameById = new Map(askers.map((u) => [u.id, redactName(u.fullName)]));

      const total = await prisma.productQuestion.count({ where: { productId: input.productId } });

      return {
        items: items.map((q) => ({
          id: q.id,
          question: q.question,
          answer: q.answer,
          answeredAt: q.answeredAt,
          createdAt: q.createdAt,
          askerLabel: nameById.get(q.askerId) ?? 'Onsective shopper',
        })),
        nextCursor,
        total,
      };
    }),

  ask: protectedProcedure
    .input(
      z.object({
        productId: z.string(),
        question: z.string().trim().min(5).max(QUESTION_MAX),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const product = await prisma.product.findUnique({
        where: { id: input.productId },
        select: { id: true, status: true },
      });
      if (!product || product.status !== 'ACTIVE') {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      const created = await prisma.productQuestion.create({
        data: {
          productId: product.id,
          askerId: ctx.user!.id,
          question: input.question,
        },
        select: { id: true },
      });
      return { id: created.id };
    }),
});
