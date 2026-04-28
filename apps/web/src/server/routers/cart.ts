import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { router, publicProcedure, userMutationRateLimit } from '../trpc';
import { prisma } from '../db';

const CART_COOKIE = 'ons_cart';

async function getOrCreateCart(userId: string | null) {
  if (userId) {
    const existing = await prisma.cart.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: { items: { include: { variant: { include: { product: true } } } } },
    });
    if (existing) return existing;

    return prisma.cart.create({
      data: { userId, currency: 'USD', countryCode: 'US' },
      include: { items: { include: { variant: { include: { product: true } } } } },
    });
  }

  // Guest cart by sessionId in cookie
  let sessionId = cookies().get(CART_COOKIE)?.value;
  if (!sessionId) {
    sessionId = randomBytes(16).toString('base64url');
    cookies().set(CART_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  const existing = await prisma.cart.findUnique({
    where: { sessionId },
    include: { items: { include: { variant: { include: { product: true } } } } },
  });
  if (existing) return existing;

  return prisma.cart.create({
    data: { sessionId, currency: 'USD', countryCode: 'US' },
    include: { items: { include: { variant: { include: { product: true } } } } },
  });
}

export const cartRouter = router({
  get: publicProcedure.query(async ({ ctx }) => {
    return getOrCreateCart(ctx.user?.id ?? null);
  }),

  addItem: publicProcedure
    .use(userMutationRateLimit)
    .input(z.object({ variantId: z.string(), qty: z.number().int().min(1).max(99) }))
    .mutation(async ({ ctx, input }) => {
      const variant = await prisma.variant.findUnique({
        where: { id: input.variantId },
        include: { product: true },
      });
      if (!variant || !variant.isActive) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Variant unavailable.' });
      }
      if (variant.stockQty < input.qty) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Insufficient stock.' });
      }

      const cart = await getOrCreateCart(ctx.user?.id ?? null);

      await prisma.cartItem.upsert({
        where: { cartId_variantId: { cartId: cart.id, variantId: input.variantId } },
        update: { qty: { increment: input.qty } },
        create: {
          cartId: cart.id,
          variantId: input.variantId,
          qty: input.qty,
          priceSnapshot: variant.priceAmount,
          currency: variant.currency,
        },
      });

      return getOrCreateCart(ctx.user?.id ?? null);
    }),

  updateQty: publicProcedure
    .use(userMutationRateLimit)
    .input(z.object({ itemId: z.string(), qty: z.number().int().min(0).max(99) }))
    .mutation(async ({ ctx, input }) => {
      if (input.qty === 0) {
        await prisma.cartItem.delete({ where: { id: input.itemId } });
      } else {
        await prisma.cartItem.update({
          where: { id: input.itemId },
          data: { qty: input.qty },
        });
      }
      return getOrCreateCart(ctx.user?.id ?? null);
    }),

  removeItem: publicProcedure
    .use(userMutationRateLimit)
    .input(z.object({ itemId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await prisma.cartItem.delete({ where: { id: input.itemId } });
      return getOrCreateCart(ctx.user?.id ?? null);
    }),
});
