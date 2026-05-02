import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { prisma } from '../db';
import { getEmailMarketingOptIn, setEmailMarketingOptIn } from '../auth';
import {
  getOrCreateWishlistShare,
  setWishlistShareVisibility,
  setWishlistShareDisplayName,
} from '../wishlist-share';
import { ensureStripeCustomer, getStripe } from '../stripe';

const addressInput = z.object({
  type: z.enum(['SHIPPING', 'BILLING', 'PICKUP']).default('SHIPPING'),
  label: z.string().optional(),
  recipient: z.string().min(1),
  phone: z.string().min(4),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
  countryCode: z.string().length(2).toUpperCase(),
  isDefault: z.boolean().default(false),
});

export const meRouter = router({
  profile: protectedProcedure.query(async ({ ctx }) => {
    return prisma.user.findUnique({
      where: { id: ctx.user.id },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        phone: true,
        phoneVerified: true,
        fullName: true,
        locale: true,
        countryCode: true,
        roles: true,
        createdAt: true,
      },
    });
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        fullName: z.string().min(1).max(120).optional(),
        locale: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return prisma.user.update({ where: { id: ctx.user.id }, data: input });
    }),

  paymentMethods: router({
    /**
     * Lists saved cards for the user. Stripe is the source of truth — we
     * don't mirror cards into our DB because keeping a copy in sync with
     * Stripe's lifecycle (expirations, brand re-fingerprints, fraud-driven
     * removals) is a net loss. One round-trip per page is fine.
     */
    list: protectedProcedure.query(async ({ ctx }) => {
      const customerId = await ensureStripeCustomer(ctx.user.id);
      const stripe = getStripe();
      const [methods, customer] = await Promise.all([
        stripe.paymentMethods.list({ customer: customerId, type: 'card' }),
        stripe.customers.retrieve(customerId),
      ]);
      const defaultId =
        !('deleted' in customer) && customer.invoice_settings?.default_payment_method
          ? typeof customer.invoice_settings.default_payment_method === 'string'
            ? customer.invoice_settings.default_payment_method
            : customer.invoice_settings.default_payment_method.id
          : null;

      return methods.data.map((m) => ({
        id: m.id,
        brand: m.card?.brand ?? 'card',
        last4: m.card?.last4 ?? '????',
        expMonth: m.card?.exp_month ?? 0,
        expYear: m.card?.exp_year ?? 0,
        funding: m.card?.funding ?? 'unknown',
        isDefault: m.id === defaultId,
      }));
    }),

    /**
     * SetupIntent gives the browser-side Stripe Element a client_secret it
     * can use to attach a fresh card to the customer without charging it.
     * Returning a SetupIntent for the same customer is safe to call
     * repeatedly — Stripe issues a new one each time.
     */
    createSetupIntent: protectedProcedure.mutation(async ({ ctx }) => {
      const customerId = await ensureStripeCustomer(ctx.user.id);
      const stripe = getStripe();
      const intent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session',
      });
      if (!intent.client_secret) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Stripe did not return a client secret.',
        });
      }
      return { clientSecret: intent.client_secret };
    }),

    /**
     * Detach (Stripe's term for delete on a payment method). Verify the
     * method belongs to this user before detaching — otherwise a leaked
     * payment-method id from somewhere else could be killed via our API.
     */
    remove: protectedProcedure
      .input(z.object({ paymentMethodId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const customerId = await ensureStripeCustomer(ctx.user.id);
        const stripe = getStripe();
        const method = await stripe.paymentMethods.retrieve(input.paymentMethodId);
        const owner =
          typeof method.customer === 'string' ? method.customer : method.customer?.id;
        if (owner !== customerId) {
          throw new TRPCError({ code: 'NOT_FOUND' });
        }
        await stripe.paymentMethods.detach(input.paymentMethodId);
        return { ok: true };
      }),

    setDefault: protectedProcedure
      .input(z.object({ paymentMethodId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const customerId = await ensureStripeCustomer(ctx.user.id);
        const stripe = getStripe();
        const method = await stripe.paymentMethods.retrieve(input.paymentMethodId);
        const owner =
          typeof method.customer === 'string' ? method.customer : method.customer?.id;
        if (owner !== customerId) {
          throw new TRPCError({ code: 'NOT_FOUND' });
        }
        await stripe.customers.update(customerId, {
          invoice_settings: { default_payment_method: input.paymentMethodId },
        });
        return { ok: true };
      }),
  }),

  wishlistShare: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return getOrCreateWishlistShare(ctx.user.id);
    }),
    setVisibility: protectedProcedure
      .input(z.object({ isPublic: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        await setWishlistShareVisibility(ctx.user.id, input.isPublic);
        return { ok: true };
      }),
    setDisplayName: protectedProcedure
      .input(z.object({ displayName: z.string().trim().max(60).nullable() }))
      .mutation(async ({ ctx, input }) => {
        await setWishlistShareDisplayName(ctx.user.id, input.displayName);
        return { ok: true };
      }),
  }),

  notifications: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return {
        emailMarketingOptIn: await getEmailMarketingOptIn(ctx.user.id),
      };
    }),
    setEmailMarketing: protectedProcedure
      .input(z.object({ optIn: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        await setEmailMarketingOptIn(ctx.user.id, input.optIn);
        return { ok: true };
      }),
  }),

  addresses: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return prisma.address.findMany({
        where: { userId: ctx.user.id },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });
    }),

    create: protectedProcedure.input(addressInput).mutation(async ({ ctx, input }) => {
      if (input.isDefault) {
        await prisma.address.updateMany({
          where: { userId: ctx.user.id, type: input.type },
          data: { isDefault: false },
        });
      }
      return prisma.address.create({ data: { ...input, userId: ctx.user.id } });
    }),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await prisma.address.delete({
          where: { id: input.id, userId: ctx.user.id },
        });
        return { ok: true };
      }),
  }),
});
