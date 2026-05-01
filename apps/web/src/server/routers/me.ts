import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { prisma } from '../db';
import { getEmailMarketingOptIn, setEmailMarketingOptIn } from '../auth';

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
