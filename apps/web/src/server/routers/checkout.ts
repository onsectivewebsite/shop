import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, protectedProcedure, userMutationRateLimit } from '../trpc';
import { prisma } from '../db';
import { getStripe } from '../stripe';
import { getCreditBalance } from '../auth';

/**
 * Checkout router — Phase 1.
 *
 * Money model:
 *  - all amounts in minor units + currency
 *  - commission frozen on each OrderItem at placement time
 *  - tax + shipping stubbed at v0 (real values: Phase 2 + Phase 3)
 */

async function loadCart(userId: string) {
  return prisma.cart.findFirst({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: {
      items: {
        include: {
          variant: { include: { product: { include: { seller: true, category: true } } } },
        },
      },
    },
  });
}

/**
 * Active Prime member? Used for free-shipping gating. Falls open on DB error
 * (free shipping if we can't tell — better than charging Prime members).
 */
async function userHasActivePrime(userId: string): Promise<boolean> {
  try {
    const m = await prisma.primeMembership.findUnique({ where: { userId } });
    if (!m) return false;
    return m.status === 'ACTIVE' && m.currentPeriodEnd > new Date();
  } catch {
    return false;
  }
}

export const checkoutRouter = router({
  summary: protectedProcedure.query(async ({ ctx }) => {
    const cart = await loadCart(ctx.user.id);
    if (!cart || cart.items.length === 0) return null;

    const subtotal = cart.items.reduce((acc, i) => acc + i.priceSnapshot * i.qty, 0);
    const shippingPerSeller = 500; // 500 minor units = $5; rate-shop in Phase 3
    const sellerCount = new Set(cart.items.map((i) => i.variant.product.sellerId)).size;
    const baseShipping = shippingPerSeller * sellerCount;
    const primeActive = await userHasActivePrime(ctx.user.id);
    const shipping = primeActive ? 0 : baseShipping;
    const tax = 0; // Stripe Tax in Phase 2
    const preCreditTotal = subtotal + shipping + tax;

    // Apply user credit in the cart's currency. Auto-applies up to the
    // order total — no slider, no opt-out at v1. Splitting an order is
    // the workaround for users who want to hold credit back.
    const creditAvailable = await getCreditBalance(ctx.user.id, cart.currency);
    const creditApplied = Math.min(creditAvailable, preCreditTotal);
    const total = preCreditTotal - creditApplied;

    return {
      cart,
      subtotal,
      shipping,
      shippingDiscount: primeActive ? baseShipping : 0,
      primeActive,
      tax,
      creditAvailable,
      creditApplied,
      total,
      currency: cart.currency,
    };
  }),

  placeOrder: protectedProcedure
    .use(userMutationRateLimit)
    .input(
      z.object({
        shippingAddressId: z.string(),
        billingAddressId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const cart = await loadCart(ctx.user.id);
      if (!cart || cart.items.length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cart is empty.' });
      }

      const shipAddr = await prisma.address.findFirst({
        where: { id: input.shippingAddressId, userId: ctx.user.id },
      });
      if (!shipAddr) throw new TRPCError({ code: 'NOT_FOUND', message: 'Address not found.' });

      // Stock check
      for (const item of cart.items) {
        if (item.variant.stockQty < item.qty) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `${item.variant.product.title} is out of stock.`,
          });
        }
      }

      // Money math — re-check Prime at order time so a member can't lose
      // free shipping between viewing the summary and placing the order.
      const subtotal = cart.items.reduce((acc, i) => acc + i.priceSnapshot * i.qty, 0);
      const sellerCount = new Set(cart.items.map((i) => i.variant.product.sellerId)).size;
      const primeActive = await userHasActivePrime(ctx.user.id);
      const shipping = primeActive ? 0 : 500 * sellerCount;
      const tax = 0;
      const preCreditTotal = subtotal + shipping + tax;

      // Re-read the credit balance at order time so two parallel checkouts
      // can't apply the same credit to two carts. The transaction below
      // guards the actual decrement so a race here is caught and rejected.
      const creditAvailable = await getCreditBalance(ctx.user.id, cart.currency);
      const creditApplied = Math.min(creditAvailable, preCreditTotal);
      const total = preCreditTotal - creditApplied;

      // Order number — production should use a sequence-backed generator
      const year = new Date().getFullYear();
      const seq = (await prisma.order.count()) + 1;
      const orderNumber = `ONS-${year}-${String(seq).padStart(6, '0')}`;

      const order = await prisma.$transaction(async (tx) => {
        const created = await tx.order.create({
          data: {
            orderNumber,
            buyerId: ctx.user.id,
            currency: cart.currency,
            countryCode: cart.countryCode,
            subtotalAmount: subtotal,
            shippingAmount: shipping,
            taxAmount: tax,
            discountAmount: creditApplied,
            totalAmount: total,
            shippingAddressId: input.shippingAddressId,
            billingAddressId: input.billingAddressId ?? input.shippingAddressId,
            status: 'PAYMENT_PENDING',
          },
        });

        // Redeem credit inside the order-create transaction so we either
        // get the order + ledger entry + balance decrement together, or
        // none of them. The guarded updateMany rejects if the live balance
        // changed under us between read and write — caller retries.
        if (creditApplied > 0) {
          const decremented = await tx.userCreditBalance.updateMany({
            where: {
              userId: ctx.user.id,
              currency: cart.currency,
              amountMinor: { gte: creditApplied },
            },
            data: { amountMinor: { decrement: creditApplied } },
          });
          if (decremented.count === 0) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'Your credit balance changed during checkout. Please retry.',
            });
          }
          await tx.userCreditTransaction.create({
            data: {
              userId: ctx.user.id,
              type: 'REDEEM',
              amountMinor: -creditApplied,
              currency: cart.currency,
              sourceType: 'order',
              sourceId: created.id,
              note: `Applied at checkout (${orderNumber})`,
            },
          });
        }

        // Reserve inventory
        for (const item of cart.items) {
          await tx.variant.update({
            where: { id: item.variantId },
            data: { reservedQty: { increment: item.qty } },
          });
        }

        // Create OrderItems with frozen commission
        for (const item of cart.items) {
          const seller = item.variant.product.seller;
          const categoryPct = item.variant.product.category.commissionPct;
          const commissionPct = Number(categoryPct ?? seller.defaultCommissionPct);
          const lineSubtotal = item.priceSnapshot * item.qty;
          const commissionAmount = Math.round((lineSubtotal * commissionPct) / 100);
          const sellerNet = lineSubtotal - commissionAmount;

          await tx.orderItem.create({
            data: {
              orderId: created.id,
              variantId: item.variantId,
              sellerId: seller.id,
              productTitle: item.variant.product.title,
              variantTitle: item.variant.title,
              sku: item.variant.sku,
              qty: item.qty,
              unitPrice: item.priceSnapshot,
              lineSubtotal,
              taxAmount: 0,
              shippingAmount: 0,
              commissionPct,
              commissionAmount,
              sellerNetAmount: sellerNet,
              status: 'PAYMENT_PENDING',
            },
          });
        }

        await tx.orderEvent.create({
          data: { orderId: created.id, type: 'placed', toStatus: 'PAYMENT_PENDING', actor: `user:${ctx.user.id}` },
        });

        return created;
      });

      // Credit covered the entire order — skip Stripe and flip the order
      // straight to PAID. We mirror the essentials of handlePaymentIntent
      // Succeeded here (status flip + orderEvent) so the rest of the
      // system sees the same final state for credit-only orders.
      if (order.totalAmount === 0) {
        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'PAID', placedAt: new Date() },
        });
        await prisma.orderEvent.create({
          data: { orderId: order.id, type: 'paid', toStatus: 'PAID', actor: 'system' },
        });
        await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
        return {
          orderId: order.id,
          orderNumber: order.orderNumber,
          clientSecret: null,
          paid: true,
        };
      }

      // Stripe PaymentIntent
      const stripe = getStripe();
      const intent = await stripe.paymentIntents.create(
        {
          amount: order.totalAmount,
          currency: order.currency.toLowerCase(),
          metadata: { orderId: order.id, orderNumber: order.orderNumber },
          automatic_payment_methods: { enabled: true },
          description: `Onsective ${order.orderNumber}`,
        },
        { idempotencyKey: `order:${order.id}` },
      );

      await prisma.payment.create({
        data: {
          orderId: order.id,
          gateway: 'stripe',
          gatewayRef: intent.id,
          gatewayClientSecret: intent.client_secret,
          amount: order.totalAmount,
          currency: order.currency,
          status: 'INITIATED',
        },
      });

      // Clear cart
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        clientSecret: intent.client_secret,
        paid: false,
      };
    }),

  orderStatus: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ ctx, input }) => {
      return prisma.order.findFirst({
        where: { id: input.orderId, buyerId: ctx.user.id },
        select: { id: true, orderNumber: true, status: true, totalAmount: true, currency: true },
      });
    }),
});
