import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, publicProcedure, protectedProcedure, authRateLimit } from '../trpc';
import {
  startRegistration,
  finishRegistration,
  startAuthentication,
  finishAuthentication,
} from '../passkeys';
import { prisma } from '../db';
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  issueOtp,
  verifyOtp,
} from '../auth';
import { sendOtpEmail } from '../notifications';

const emailSchema = z.string().email().toLowerCase().trim();
const passwordSchema = z.string().min(10).max(128);

export const authRouter = router({
  signupWithEmail: publicProcedure
    .use(authRateLimit)
    .input(
      z.object({
        email: emailSchema,
        password: passwordSchema,
        fullName: z.string().min(1).max(120),
        countryCode: z.string().length(2).toUpperCase(),
        locale: z.string().default('en-US'),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await prisma.user.findUnique({ where: { email: input.email } });
      if (existing) throw new TRPCError({ code: 'CONFLICT', message: 'Email already registered.' });

      const user = await prisma.user.create({
        data: {
          email: input.email,
          passwordHash: hashPassword(input.password),
          fullName: input.fullName,
          countryCode: input.countryCode,
          locale: input.locale,
          roles: ['BUYER'],
        },
      });

      await createSession(user.id, {
        ipAddress: ctx.ipAddress ?? undefined,
        userAgent: ctx.userAgent ?? undefined,
      });

      // Optional: kick off email verification
      const { code } = await issueOtp({
        destination: user.email,
        channel: 'email',
        purpose: 'verify',
        userId: user.id,
      });
      await sendOtpEmail(user.email, code);

      return { userId: user.id };
    }),

  login: publicProcedure
    .use(authRateLimit)
    .input(z.object({ email: emailSchema, password: passwordSchema }))
    .mutation(async ({ input, ctx }) => {
      const user = await prisma.user.findUnique({ where: { email: input.email } });
      if (!user || !user.passwordHash || !verifyPassword(user.passwordHash, input.password)) {
        // Generic message to avoid user enumeration.
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password.' });
      }
      if (user.status !== 'ACTIVE') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Account is not active.' });
      }

      await createSession(user.id, {
        ipAddress: ctx.ipAddress ?? undefined,
        userAgent: ctx.userAgent ?? undefined,
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      return { userId: user.id };
    }),

  requestEmailOtp: publicProcedure
    .use(authRateLimit)
    .input(z.object({ email: emailSchema }))
    .mutation(async ({ input }) => {
      const user = await prisma.user.findUnique({ where: { email: input.email } });
      // Always return success to prevent enumeration; only actually send if user exists.
      if (user) {
        const { code } = await issueOtp({
          destination: input.email,
          channel: 'email',
          purpose: 'login',
          userId: user.id,
        });
        await sendOtpEmail(input.email, code);
      }
      return { sent: true };
    }),

  verifyEmailOtp: publicProcedure
    .use(authRateLimit)
    .input(z.object({ email: emailSchema, code: z.string().length(6) }))
    .mutation(async ({ input, ctx }) => {
      const result = await verifyOtp({
        destination: input.email,
        purpose: 'login',
        code: input.code,
      });
      if (!result.valid || !result.userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid or expired code.' });
      }

      await prisma.user.update({
        where: { id: result.userId },
        data: { emailVerified: new Date(), lastLoginAt: new Date() },
      });

      await createSession(result.userId, {
        ipAddress: ctx.ipAddress ?? undefined,
        userAgent: ctx.userAgent ?? undefined,
      });

      return { userId: result.userId };
    }),

  logout: protectedProcedure.mutation(async () => {
    await destroySession();
    return { ok: true };
  }),

  me: publicProcedure.query(({ ctx }) => {
    if (!ctx.user) return null;
    return {
      id: ctx.user.id,
      email: ctx.user.email,
      fullName: ctx.user.fullName,
      roles: ctx.user.roles,
      countryCode: ctx.user.countryCode,
      locale: ctx.user.locale,
    };
  }),

  passkeys: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const items = await prisma.passkey.findMany({
        where: { userId: ctx.user.id },
        select: {
          id: true,
          name: true,
          deviceType: true,
          backedUp: true,
          createdAt: true,
          lastUsedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      return items;
    }),

    remove: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await prisma.passkey.deleteMany({
          where: { id: input.id, userId: ctx.user.id },
        });
        return { ok: true };
      }),

    requestRegistration: protectedProcedure.mutation(async ({ ctx }) => {
      return startRegistration({
        userId: ctx.user.id,
        userEmail: ctx.user.email,
        userDisplayName: ctx.user.fullName,
      });
    }),

    verifyRegistration: protectedProcedure
      .input(
        z.object({
          response: z.unknown(),
          name: z.string().min(1).max(80).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          return await finishRegistration({
            userId: ctx.user.id,
            response: input.response as Parameters<typeof finishRegistration>[0]['response'],
            name: input.name,
          });
        } catch (err) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: err instanceof Error ? err.message : 'Registration failed.',
          });
        }
      }),

    requestAuthentication: publicProcedure
      .use(authRateLimit)
      .input(z.object({ email: emailSchema.optional() }))
      .mutation(async ({ input }) => {
        return startAuthentication({ email: input.email });
      }),

    verifyAuthentication: publicProcedure
      .use(authRateLimit)
      .input(
        z.object({
          email: emailSchema.optional(),
          response: z.unknown(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          const { userId } = await finishAuthentication({
            email: input.email,
            response: input.response as Parameters<typeof finishAuthentication>[0]['response'],
          });
          await createSession(userId, {
            ipAddress: ctx.ipAddress ?? undefined,
            userAgent: ctx.userAgent ?? undefined,
          });
          await prisma.user.update({
            where: { id: userId },
            data: { lastLoginAt: new Date() },
          });
          return { userId };
        } catch (err) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: err instanceof Error ? err.message : 'Sign-in failed.',
          });
        }
      }),
  }),
});
