import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, protectedProcedure, userMutationRateLimit } from '../trpc';
import { prisma } from '../db';
import { getStripe, ensureStripeCustomer } from '../stripe';
import {
  convertMinor,
  getCreditBalance,
  getCreditBalances,
  getLatestRate,
  quoteCrossCurrency,
} from '../auth';
import { evaluateCoupon } from '../coupons';
import { isOnVacation } from '../vacation';

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

type CrossCurrencyOption = {
  fromCurrency: string;
  fromAmountMinor: number;
  toAmountMinor: number;
  rate: number;
};

/**
 * Pick the single non-cart-currency credit balance that, after FX conversion,
 * covers the most of the residual order total. Single-source on purpose —
 * multi-source redemption is fancier UI without a real user pulling for it.
 */
async function pickBestCrossCurrencyOption(
  userId: string,
  cartCurrency: string,
  residualMinor: number,
): Promise<CrossCurrencyOption | null> {
  if (residualMinor <= 0) return null;
  const balances = await getCreditBalances(userId);
  let best: CrossCurrencyOption | null = null;
  for (const b of balances) {
    if (b.currency === cartCurrency) continue;
    const quote = await quoteCrossCurrency({
      amountMinor: b.amountMinor,
      fromCurrency: b.currency,
      toCurrency: cartCurrency,
    });
    if (!quote || quote.amountMinor === 0) continue;
    const applied = Math.min(quote.amountMinor, residualMinor);
    if (!best || applied > best.toAmountMinor) {
      best = {
        fromCurrency: b.currency,
        fromAmountMinor: b.amountMinor,
        toAmountMinor: applied,
        rate: quote.rate,
      };
    }
  }
  return best;
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

    // Same-currency credit auto-applies. Splitting orders is the workaround
    // for users who want to hold same-currency credit back.
    const creditAvailable = await getCreditBalance(ctx.user.id, cart.currency);
    const creditApplied = Math.min(creditAvailable, preCreditTotal);
    const residual = preCreditTotal - creditApplied;

    // Cross-currency option only surfaces when there's residual order total
    // AND the user has a non-cart-currency balance. Opt-in at order time —
    // we don't auto-apply because the user is choosing to lock in today's
    // FX rate.
    const crossCurrencyOption = await pickBestCrossCurrencyOption(
      ctx.user.id,
      cart.currency,
      residual,
    );

    return {
      cart,
      subtotal,
      shipping,
      shippingDiscount: primeActive ? baseShipping : 0,
      primeActive,
      tax,
      creditAvailable,
      creditApplied,
      crossCurrencyOption,
      total: residual,
      currency: cart.currency,
    };
  }),

  /**
   * Preview a coupon against the current cart. Cheap to call on each
   * keystroke since it just reads one Coupon row and does arithmetic.
   * Returns null when the coupon doesn't apply for any reason — UI just
   * shows "Coupon not applicable" without disclosing why.
   */
  previewCoupon: protectedProcedure
    .input(z.object({ code: z.string().trim().max(64) }))
    .query(async ({ ctx, input }) => {
      const cart = await loadCart(ctx.user.id);
      if (!cart || cart.items.length === 0) return null;
      const subtotal = cart.items.reduce(
        (acc, i) => acc + i.priceSnapshot * i.qty,
        0,
      );
      const evaluation = await evaluateCoupon({
        code: input.code,
        cartCurrency: cart.currency,
        cartSubtotalMinor: subtotal,
      });
      if (!evaluation) return null;
      return {
        code: evaluation.code,
        discountMinor: evaluation.discountMinor,
        currency: cart.currency,
      };
    }),

  placeOrder: protectedProcedure
    .use(userMutationRateLimit)
    .input(
      z.object({
        shippingAddressId: z.string(),
        billingAddressId: z.string().optional(),
        // Optional gift message / delivery instructions. Capped at 1000
        // chars at the boundary so a malicious payload can't blow up
        // seller email rendering.
        buyerNote: z.string().trim().max(1000).optional(),
        // Opt-in to applying a non-cart-currency credit balance. We don't
        // auto-apply because the user is choosing to lock in today's FX
        // rate — that's their call.
        useCrossCurrencyCredit: z.boolean().default(false),
        // Optional promo code. Re-validated server-side at order time;
        // we never trust the discount preview from the summary call.
        couponCode: z.string().trim().max(64).optional(),
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

      // Stock check + vacation guard. The cart could contain items from a
      // seller who flipped on vacation mode after the buyer added them.
      for (const item of cart.items) {
        if (item.variant.stockQty < item.qty) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `${item.variant.product.title} is out of stock.`,
          });
        }
        if (isOnVacation(item.variant.product.seller)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `${item.variant.product.seller.displayName} is on vacation. Remove items from this seller and try again.`,
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

      // Re-evaluate the coupon server-side at order time. Never trust the
      // discount preview that came back from previewCoupon — the coupon
      // could have expired, been disabled, or hit maxUses since the
      // checkout page rendered.
      let couponEval: Awaited<ReturnType<typeof evaluateCoupon>> = null;
      if (input.couponCode && input.couponCode.length > 0) {
        couponEval = await evaluateCoupon({
          code: input.couponCode,
          cartCurrency: cart.currency,
          cartSubtotalMinor: subtotal,
        });
        if (!couponEval) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Coupon is no longer valid.',
          });
        }
      }
      const couponDiscount = couponEval?.discountMinor ?? 0;
      const preCreditTotal = subtotal + shipping + tax - couponDiscount;

      // Re-read the credit balance at order time so two parallel checkouts
      // can't apply the same credit to two carts. The transaction below
      // guards the actual decrement so a race here is caught and rejected.
      const creditAvailable = await getCreditBalance(ctx.user.id, cart.currency);
      const creditApplied = Math.min(creditAvailable, preCreditTotal);
      const residualAfterSameCurrency = preCreditTotal - creditApplied;

      // Re-quote the FX option at order time. The rate the buyer locks in is
      // whatever's in the FxRate table right now — not whatever was quoted on
      // the summary page seconds ago. Returns null if rates are stale or the
      // buyer has no eligible balance left.
      let fxRedemption:
        | {
            fromCurrency: string;
            fromAmountMinor: number;
            toAmountMinor: number;
            rate: number;
          }
        | null = null;
      if (input.useCrossCurrencyCredit && residualAfterSameCurrency > 0) {
        const best = await pickBestCrossCurrencyOption(
          ctx.user.id,
          cart.currency,
          residualAfterSameCurrency,
        );
        // pickBest returns the source-currency total it considered; we need
        // the precise from-amount for the actual applied to-amount, not the
        // whole balance. Re-derive at the rate we just quoted, rounding UP
        // so we don't grant the buyer a fractional-cent extra.
        if (best) {
          fxRedemption = {
            fromCurrency: best.fromCurrency,
            fromAmountMinor: Math.ceil(best.toAmountMinor / best.rate),
            toAmountMinor: best.toAmountMinor,
            rate: best.rate,
          };
        }
      }
      const fxApplied = fxRedemption?.toAmountMinor ?? 0;
      const totalDiscount = creditApplied + fxApplied + couponDiscount;
      const total = subtotal + shipping + tax - totalDiscount;

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
            discountAmount: totalDiscount,
            couponCode: couponEval?.code ?? null,
            couponDiscountAmount: couponDiscount,
            totalAmount: total,
            shippingAddressId: input.shippingAddressId,
            billingAddressId: input.billingAddressId ?? input.shippingAddressId,
            buyerNote: input.buyerNote && input.buyerNote.length > 0 ? input.buyerNote : null,
            status: 'PAYMENT_PENDING',
          },
        });

        // Increment Coupon.usedCount with a guarded updateMany — if maxUses
        // is set and we'd blow past it, the where-clause misses and the
        // transaction rolls back the order. Two parallel last-redemption
        // races can't both win.
        if (couponEval) {
          const claimed = await tx.coupon.updateMany({
            where: {
              id: couponEval.couponId,
              isActive: true,
              OR: [
                { maxUses: null },
                { usedCount: { lt: prisma.coupon.fields.maxUses } },
              ],
            },
            data: { usedCount: { increment: 1 } },
          });
          if (claimed.count === 0) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'Coupon was just exhausted. Please retry without it.',
            });
          }
        }

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

        // Cross-currency redemption — pulled inside the same transaction so
        // the order, the source-currency decrement, and the FX-tagged ledger
        // row land together. The unique (sourceType, sourceId, type) gate on
        // the ledger means we have to write a single REDEEM row covering both
        // legs; we encode the same-currency leg as the primary amount and
        // record the FX details when both legs combine. To keep idempotency
        // straight, the FX REDEEM is written as a SEPARATE source pair using
        // 'order_fx' so the same-currency REDEEM still owns the 'order' key.
        if (fxRedemption) {
          // Re-fetch the freshest rate for this pair to make sure we don't
          // commit at a rate older than what stale-guard would refuse on the
          // refund side. Belt-and-braces — pickBest already filtered staleness.
          const lookup = await getLatestRate(
            fxRedemption.fromCurrency,
            cart.currency,
          );
          if (!lookup) {
            throw new TRPCError({
              code: 'CONFLICT',
              message:
                'FX rate became stale during checkout. Please retry without cross-currency credit.',
            });
          }
          // Re-derive the from-amount against the freshest rate so we don't
          // overspend if the rate moved between the summary call and now.
          const finalFromMinor = Math.ceil(fxRedemption.toAmountMinor / lookup.rate);
          const decremented = await tx.userCreditBalance.updateMany({
            where: {
              userId: ctx.user.id,
              currency: fxRedemption.fromCurrency,
              amountMinor: { gte: finalFromMinor },
            },
            data: { amountMinor: { decrement: finalFromMinor } },
          });
          if (decremented.count === 0) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'Your cross-currency balance changed during checkout. Please retry.',
            });
          }
          // Recompute toMinor against the actual rate we used so the receipt,
          // ledger, and order discount all agree.
          const finalToMinor = convertMinor(finalFromMinor, lookup.rate);
          await tx.userCreditTransaction.create({
            data: {
              userId: ctx.user.id,
              type: 'REDEEM',
              amountMinor: -finalToMinor,
              currency: cart.currency,
              fxRate: lookup.rate.toFixed(8),
              fxFromCurrency: fxRedemption.fromCurrency,
              fxFromAmountMinor: finalFromMinor,
              sourceType: 'order_fx',
              sourceId: created.id,
              note: `FX-applied at checkout (${orderNumber})`,
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

      // Stripe PaymentIntent. Attaching the Customer surfaces the buyer's
      // saved cards inside Stripe Elements automatically — no client-side
      // picker UI required. setup_future_usage: 'off_session' tells Stripe
      // to save any newly entered card to that Customer once the payment
      // succeeds, which is what populates /account/payment-methods.
      const stripe = getStripe();
      const customerId = await ensureStripeCustomer(ctx.user.id);
      const intent = await stripe.paymentIntents.create(
        {
          amount: order.totalAmount,
          currency: order.currency.toLowerCase(),
          customer: customerId,
          setup_future_usage: 'off_session',
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
