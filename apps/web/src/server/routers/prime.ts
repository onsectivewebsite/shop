import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, publicProcedure } from '../trpc';
import { prisma } from '../db';
import { getStripe } from '../stripe';

/**
 * Onsective Prime — Phase 5 stub.
 *
 * Full feature is multi-week (pricing config per market, family sharing,
 * gifting, retention flows). This module ships:
 *   - status query — buyer-side check used by checkout for free shipping
 *   - subscribe mutation — creates Stripe subscription + persists membership
 *   - cancel mutation — flags cancelled-at-period-end via Stripe
 * Webhook routing for `customer.subscription.*` to update PrimeStatus is
 * also TODO — without it, status drifts on payment failures.
 */

const PRIME_PRICE_IDS = {
  // Wire these via env in prod; hardcoded fallback so dev runs without setup.
  MONTHLY: process.env.STRIPE_PRICE_PRIME_MONTHLY ?? 'price_prime_monthly_test',
  ANNUAL: process.env.STRIPE_PRICE_PRIME_ANNUAL ?? 'price_prime_annual_test',
} as const;

export const primeRouter = router({
  status: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return { active: false } as const;
    const m = await prisma.primeMembership.findUnique({
      where: { userId: ctx.user.id },
    });
    if (!m) return { active: false } as const;
    const active = m.status === 'ACTIVE' && m.currentPeriodEnd > new Date();
    return {
      active,
      plan: m.plan,
      currentPeriodEnd: m.currentPeriodEnd,
      status: m.status,
    } as const;
  }),

  /**
   * Start a Stripe Checkout Session for Prime signup. Returns the hosted-
   * checkout URL — frontend redirects there. Stripe collects the payment
   * method, creates the subscription on success, and our subscription
   * webhook (`customer.subscription.created`) writes the active membership.
   */
  startCheckout: protectedProcedure
    .input(
      z.object({
        plan: z.enum(['MONTHLY', 'ANNUAL']),
        locale: z.string().min(2).max(10).default('en'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await prisma.primeMembership.findUnique({
        where: { userId: ctx.user.id },
      });
      if (existing && existing.status === 'ACTIVE' && existing.currentPeriodEnd > new Date()) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Already a Prime member.' });
      }

      const stripe = getStripe();
      const customer =
        existing?.stripeCustomerId ??
        (
          await stripe.customers.create({
            email: ctx.user.email,
            name: ctx.user.fullName ?? undefined,
            metadata: { userId: ctx.user.id },
          })
        ).id;

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer,
        line_items: [{ price: PRIME_PRICE_IDS[input.plan], quantity: 1 }],
        success_url: `${baseUrl}/${input.locale}/account/prime?status=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/${input.locale}/account/prime?status=cancelled`,
        metadata: { userId: ctx.user.id, plan: input.plan },
      });

      // Pre-populate the customer link so a webhook arriving before the
      // buyer returns from Checkout still finds the right user. Membership
      // starts CANCELLED with epoch periodEnd; the subscription webhook
      // upgrades it to ACTIVE on success.
      if (!existing) {
        await prisma.primeMembership
          .create({
            data: {
              userId: ctx.user.id,
              plan: input.plan,
              status: 'CANCELLED',
              stripeCustomerId: customer,
              currentPeriodEnd: new Date(0),
            },
          })
          .catch(() => {});
      } else if (!existing.stripeCustomerId) {
        await prisma.primeMembership.update({
          where: { id: existing.id },
          data: { stripeCustomerId: customer },
        });
      }

      if (!session.url) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Stripe did not return a checkout URL.',
        });
      }
      return { url: session.url, plan: input.plan };
    }),

  cancel: protectedProcedure.mutation(async ({ ctx }) => {
    const m = await prisma.primeMembership.findUnique({ where: { userId: ctx.user.id } });
    if (!m || !m.stripeSubscriptionId) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'No active subscription.' });
    }
    const stripe = getStripe();
    await stripe.subscriptions.update(m.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
    await prisma.primeMembership.update({
      where: { userId: ctx.user.id },
      data: { cancelledAt: new Date() },
    });
    return { ok: true };
  }),
});
