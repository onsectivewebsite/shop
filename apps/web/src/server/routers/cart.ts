import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { router, publicProcedure, protectedProcedure, userMutationRateLimit } from '../trpc';
import { prisma } from '../db';
import { isOnVacation } from '../vacation';

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
        include: {
          product: {
            include: {
              seller: { select: { displayName: true, vacationMode: true, vacationUntil: true } },
            },
          },
        },
      });
      if (!variant || !variant.isActive) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Variant unavailable.' });
      }
      if (variant.stockQty < input.qty) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Insufficient stock.' });
      }
      if (isOnVacation(variant.product.seller)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `${variant.product.seller.displayName} is on vacation. Save to your wishlist to buy when they're back.`,
        });
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

  /**
   * "Save for later" surface — protected because the row is keyed off
   * userId, and guest carts (cookie-only) have nowhere to put it. The cart
   * page hides the "Save for later" affordance when the buyer isn't
   * signed in, so this also acts as a defensive belt.
   */
  listSaved: protectedProcedure.query(async ({ ctx }) => {
    return prisma.savedForLaterItem.findMany({
      where: { userId: ctx.user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        qty: true,
        priceSnapshot: true,
        currency: true,
        createdAt: true,
        variant: {
          select: {
            id: true,
            sku: true,
            title: true,
            priceAmount: true,
            currency: true,
            stockQty: true,
            reservedQty: true,
            isActive: true,
            product: {
              select: {
                title: true,
                slug: true,
                images: true,
                seller: {
                  select: { displayName: true, vacationMode: true, vacationUntil: true },
                },
              },
            },
          },
        },
      },
    });
  }),

  /**
   * Move a cart item to the "save for later" shelf. Idempotent on
   * (userId, variantId) — a duplicate save just sums qty so a second
   * save-for-later from a re-added item doesn't error.
   */
  saveForLater: protectedProcedure
    .use(userMutationRateLimit)
    .input(z.object({ itemId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const item = await prisma.cartItem.findUnique({
        where: { id: input.itemId },
        select: {
          id: true,
          variantId: true,
          qty: true,
          priceSnapshot: true,
          currency: true,
          cart: { select: { userId: true } },
        },
      });
      if (!item || item.cart.userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      await prisma.$transaction([
        prisma.savedForLaterItem.upsert({
          where: {
            userId_variantId: { userId: ctx.user.id, variantId: item.variantId },
          },
          create: {
            userId: ctx.user.id,
            variantId: item.variantId,
            qty: item.qty,
            priceSnapshot: item.priceSnapshot,
            currency: item.currency,
          },
          update: { qty: { increment: item.qty } },
        }),
        prisma.cartItem.delete({ where: { id: item.id } }),
      ]);
      return { ok: true };
    }),

  /**
   * Move a saved item back to the cart. Re-checks stock + vacation at
   * move-time — the variant could have gone OOS or the seller could've
   * gone on vacation while it sat. Price refreshes from the live variant
   * (no clinging to the stale priceSnapshot at move).
   */
  moveToCart: protectedProcedure
    .use(userMutationRateLimit)
    .input(z.object({ savedItemId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const saved = await prisma.savedForLaterItem.findFirst({
        where: { id: input.savedItemId, userId: ctx.user.id },
        select: { id: true, variantId: true, qty: true },
      });
      if (!saved) throw new TRPCError({ code: 'NOT_FOUND' });

      const variant = await prisma.variant.findUnique({
        where: { id: saved.variantId },
        include: {
          product: {
            include: {
              seller: { select: { displayName: true, vacationMode: true, vacationUntil: true } },
            },
          },
        },
      });
      if (!variant || !variant.isActive) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Variant unavailable.' });
      }
      if (variant.stockQty < saved.qty) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Insufficient stock.' });
      }
      if (isOnVacation(variant.product.seller)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `${variant.product.seller.displayName} is on vacation. Try again when they're back.`,
        });
      }

      const cart = await getOrCreateCart(ctx.user.id);
      await prisma.$transaction([
        prisma.cartItem.upsert({
          where: { cartId_variantId: { cartId: cart.id, variantId: saved.variantId } },
          create: {
            cartId: cart.id,
            variantId: saved.variantId,
            qty: saved.qty,
            priceSnapshot: variant.priceAmount,
            currency: variant.currency,
          },
          update: { qty: { increment: saved.qty } },
        }),
        prisma.savedForLaterItem.delete({ where: { id: saved.id } }),
      ]);
      return { ok: true };
    }),

  removeSaved: protectedProcedure
    .use(userMutationRateLimit)
    .input(z.object({ savedItemId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await prisma.savedForLaterItem.deleteMany({
        where: { id: input.savedItemId, userId: ctx.user.id },
      });
      if (result.count === 0) throw new TRPCError({ code: 'NOT_FOUND' });
      return { ok: true };
    }),
});
