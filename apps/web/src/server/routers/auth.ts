import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { router, publicProcedure, protectedProcedure, authRateLimit } from '../trpc';
import {
  startRegistration,
  finishRegistration,
  startAuthentication,
  finishAuthentication,
} from '../passkeys';
import { prisma } from '../db';
import {
  dataExportQueue,
  DATA_EXPORT_JOB,
} from '../queue';
import { runPostLoginChecks } from '../login-security';
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  issueOtp,
  verifyOtp,
  regenerateRecoveryCodes,
  recoveryCodesStatus,
  consumeRecoveryCode,
  recordAttribution,
  REFERRAL_COOKIE_NAME,
} from '../auth';
import {
  sendOtpEmail,
  sendTwoFactorEmail,
  sendLockoutEmail,
  sendNewDeviceLoginEmail,
  sendOtpSms,
  sendTwoFactorSms,
  sendAccountDeletionEmail,
} from '../notifications';

const emailSchema = z.string().email().toLowerCase().trim();
const passwordSchema = z.string().min(10).max(128);
// E.164: leading +, 8-15 digits. Twilio rejects anything else.
const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, 'Phone must be in E.164 format (e.g. +14155552671)');

const FAILED_LOGIN_LIMIT = 5;
const LOCKOUT_MINUTES = 30;

async function safeSend<T>(label: string, fn: () => Promise<T>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[email] ${label} failed:`, err);
  }
}

/**
 * Reads the referral cookie set by /r/<code>, attempts attribution, then
 * always clears the cookie so a stale value can't follow the user past
 * their first verification. Failures are non-fatal — a referral that
 * doesn't take must not block signup.
 */
async function consumeReferralCookie(referredUserId: string): Promise<void> {
  const jar = cookies();
  const cookie = jar.get(REFERRAL_COOKIE_NAME);
  if (!cookie?.value) return;
  try {
    await recordAttribution({ code: cookie.value, referredUserId });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[referrals] attribution failed:', err);
  } finally {
    jar.delete(REFERRAL_COOKIE_NAME);
  }
}

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
    .mutation(async ({ input }) => {
      const existing = await prisma.user.findUnique({ where: { email: input.email } });
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Email already registered.' });
      }

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

      const { code } = await issueOtp({
        destination: user.email,
        channel: 'email',
        purpose: 'verify',
        userId: user.id,
      });
      await safeSend('signup verify', () => sendOtpEmail(user.email, code));

      // No session yet — user must verify their email before they can sign in.
      return { needsVerification: true, email: user.email };
    }),

  verifySignupEmail: publicProcedure
    .use(authRateLimit)
    .input(z.object({ email: emailSchema, code: z.string().length(6) }))
    .mutation(async ({ input, ctx }) => {
      const result = await verifyOtp({
        destination: input.email,
        purpose: 'verify',
        code: input.code,
      });
      if (!result.valid || !result.userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid or expired code.' });
      }
      await prisma.user.update({
        where: { id: result.userId },
        data: { emailVerified: new Date(), lastLoginAt: new Date() },
      });
      await consumeReferralCookie(result.userId);
      await createSession(result.userId, {
        ipAddress: ctx.ipAddress ?? undefined,
        userAgent: ctx.userAgent ?? undefined,
      });
      return { ok: true };
    }),

  login: publicProcedure
    .use(authRateLimit)
    .input(z.object({ email: emailSchema, password: passwordSchema }))
    .mutation(async ({ input, ctx }) => {
      const user = await prisma.user.findUnique({ where: { email: input.email } });

      // 1. Lockout window
      if (user?.lockedUntil && user.lockedUntil > new Date()) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: `Account temporarily locked. Try again after ${user.lockedUntil.toUTCString()}.`,
        });
      }

      // 2. Password check
      if (!user || !user.passwordHash || !verifyPassword(user.passwordHash, input.password)) {
        if (user) {
          const fails = user.failedLoginAttempts + 1;
          const shouldLock = fails >= FAILED_LOGIN_LIMIT;
          const unlockAt = shouldLock
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
            : null;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: fails,
              lockedUntil: unlockAt ?? user.lockedUntil,
            },
          });
          if (shouldLock && unlockAt) {
            await safeSend('lockout', () => sendLockoutEmail(user.email, unlockAt));
          }
        }
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password.' });
      }

      if (user.status !== 'ACTIVE') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Account is not active.' });
      }

      // 3. Email-verification gate (signup)
      if (!user.emailVerified) {
        const { code } = await issueOtp({
          destination: user.email,
          channel: 'email',
          purpose: 'verify',
          userId: user.id,
        });
        await safeSend('resend verify', () => sendOtpEmail(user.email, code));
        return { needsEmailVerification: true, email: user.email };
      }

      // Reset fail counter — credentials were good
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });

      // 4. Two-factor step. The destination of record stays email (so the
      // verify endpoint matches by email regardless of which channel the
      // user reads the code from). When SMS is enrolled, the same code
      // also goes to their verified phone number.
      if (user.twoFactorEmail) {
        const { code } = await issueOtp({
          destination: user.email,
          channel: 'email',
          purpose: 'login_2fa',
          userId: user.id,
        });
        await safeSend('2fa email', () => sendTwoFactorEmail(user.email, code));
        if (user.twoFactorSms && user.phone && user.phoneVerified) {
          await safeSend('2fa sms', () => sendTwoFactorSms(user.phone!, code));
        }
        return { requires2FA: true, email: user.email };
      }

      // 5. No 2FA: opt-out path. Create session immediately.
      const ip = ctx.ipAddress ?? null;
      const ua = ctx.userAgent ?? null;
      const now = new Date();
      await createSession(user.id, {
        ipAddress: ip ?? undefined,
        userAgent: ua ?? undefined,
      });
      await runPostLoginChecks({
        user,
        method: 'password',
        ip,
        userAgent: ua,
        at: now,
      });
      await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: now,
          lastLoginIp: ip,
          lastLoginUserAgent: ua,
        },
      });
      return { ok: true };
    }),

  // Recovery-code path: same outcome as verifyTwoFactor, but the user proves
  // control with a one-shot backup code (printed at /account/security) instead
  // of the email OTP. Useful when the email account is compromised or out
  // of reach.
  verifyRecoveryCode: publicProcedure
    .use(authRateLimit)
    .input(
      z.object({
        email: emailSchema,
        // Codes are 14 hex chars rendered with dashes; accept either format.
        code: z.string().min(14).max(20),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const user = await prisma.user.findUnique({ where: { email: input.email } });
      if (!user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid recovery code.' });
      }
      if (user.status !== 'ACTIVE') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Account is not active.' });
      }

      const ok = await consumeRecoveryCode(user.id, input.code);
      if (!ok) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid recovery code.' });
      }

      const ip = ctx.ipAddress ?? null;
      const ua = ctx.userAgent ?? null;
      const now = new Date();

      await createSession(user.id, {
        ipAddress: ip ?? undefined,
        userAgent: ua ?? undefined,
      });
      await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: now,
          lastLoginIp: ip,
          lastLoginUserAgent: ua,
        },
      });

      // A recovery-code login bypasses 2FA — always notify, regardless of
      // device/country history.
      await runPostLoginChecks({
        user,
        method: 'recovery_code',
        ip,
        userAgent: ua,
        at: now,
        forceNotify: true,
      });

      const remaining = await recoveryCodesStatus(user.id);
      return { ok: true, recoveryCodesRemaining: remaining.unused };
    }),

  recoveryCodes: router({
    status: protectedProcedure.query(async ({ ctx }) => {
      return recoveryCodesStatus(ctx.user!.id);
    }),
    regenerate: protectedProcedure.mutation(async ({ ctx }) => {
      const codes = await regenerateRecoveryCodes(ctx.user!.id);
      return { codes };
    }),
  }),

  deleteAccount: router({
    // Tells the UI whether the user can proceed and, if not, why. Active
    // orders block deletion because the buyer can still receive shipments,
    // file returns, or chargeback. Once everything has reached a terminal
    // state we can scrub PII and keep only tax-relevant rows.
    eligibility: protectedProcedure.query(async ({ ctx }) => {
      const TERMINAL = ['COMPLETED', 'CANCELLED', 'REFUNDED', 'FAILED'] as const;
      const blocking = await prisma.order.count({
        where: {
          buyerId: ctx.user!.id,
          status: { notIn: [...TERMINAL] },
        },
      });
      const openReturns = await prisma.return.count({
        where: {
          buyerId: ctx.user!.id,
          status: { notIn: ['REFUNDED', 'REJECTED', 'CANCELLED'] },
        },
      });
      return {
        canDelete: blocking === 0 && openReturns === 0,
        blockingOrders: blocking,
        openReturns,
      };
    }),

    request: protectedProcedure.use(authRateLimit).mutation(async ({ ctx }) => {
      const { code } = await issueOtp({
        destination: ctx.user!.email,
        channel: 'email',
        purpose: 'account_delete',
        userId: ctx.user!.id,
      });
      await safeSend('account-delete', () =>
        sendAccountDeletionEmail(ctx.user!.email, code),
      );
      return { sent: true };
    }),

    confirm: protectedProcedure
      .use(authRateLimit)
      .input(z.object({ code: z.string().length(6) }))
      .mutation(async ({ ctx, input }) => {
        const result = await verifyOtp({
          destination: ctx.user!.email,
          purpose: 'account_delete',
          code: input.code,
        });
        if (!result.valid || result.userId !== ctx.user!.id) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Invalid or expired confirmation code.',
          });
        }

        // Re-check eligibility right before the destructive write — a new
        // order could have landed between request and confirm.
        const TERMINAL = ['COMPLETED', 'CANCELLED', 'REFUNDED', 'FAILED'] as const;
        const blocking = await prisma.order.count({
          where: { buyerId: ctx.user!.id, status: { notIn: [...TERMINAL] } },
        });
        if (blocking > 0) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'You have orders in progress. Wait for them to finish before deleting.',
          });
        }

        const userId = ctx.user!.id;
        const scrubEmail = `deleted+${userId}@onsective.invalid`;

        await prisma.$transaction([
          // Drop credentials + auth surface so nothing can sign back in.
          prisma.passkey.deleteMany({ where: { userId } }),
          prisma.recoveryCode.deleteMany({ where: { userId } }),
          prisma.otp.deleteMany({ where: { userId } }),
          prisma.session.deleteMany({ where: { userId } }),
          prisma.webAuthnChallenge.deleteMany({ where: { userId } }),
          // Forget addresses (orders snapshot the address rows by relation,
          // and Address.userId is nullable with onDelete: SetNull, so existing
          // orders keep their fixed shipping/billing addresses by reference).
          prisma.address.updateMany({
            where: { userId },
            data: { userId: null },
          }),
          // Scrub PII on the User row itself but keep the row so existing
          // FKs (Order.buyerId, Review.buyerId, Return.buyerId) still resolve.
          prisma.user.update({
            where: { id: userId },
            data: {
              status: 'DELETED',
              deletedAt: new Date(),
              email: scrubEmail,
              fullName: null,
              phone: null,
              phoneVerified: null,
              passwordHash: null,
              twoFactorSms: false,
              twoFactorEmail: false,
              lastLoginIp: null,
              lastLoginUserAgent: null,
            },
          }),
        ]);

        // Belt + braces: clear the cookie so the browser doesn't attempt
        // requests with the now-revoked session.
        await destroySession();

        return { ok: true };
      }),
  }),

  dataExport: router({
    // Latest job (if any). Polled by the UI after a request to surface
    // progress + the eventual delivery acknowledgement.
    status: protectedProcedure.query(async ({ ctx }) => {
      const job = await prisma.dataExportJob.findFirst({
        where: { userId: ctx.user!.id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          createdAt: true,
          completedAt: true,
          expiresAt: true,
          bytes: true,
          emailedTo: true,
        },
      });
      return job;
    }),

    request: protectedProcedure.use(authRateLimit).mutation(async ({ ctx }) => {
      // No more than one queued/running job at a time, and not more than one
      // ready job per 24h window. The S3 link expires in 24h anyway, so
      // re-issuing inside that window is just abuse surface.
      const recent = await prisma.dataExportJob.findFirst({
        where: { userId: ctx.user!.id },
        orderBy: { createdAt: 'desc' },
      });
      if (recent) {
        if (recent.status === 'QUEUED' || recent.status === 'RUNNING') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'A previous export is still being prepared. Check back in a minute.',
          });
        }
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        if (recent.status === 'READY' && recent.createdAt > dayAgo) {
          throw new TRPCError({
            code: 'TOO_MANY_REQUESTS',
            message: 'You already requested an export in the last 24 hours. Please reuse the email link.',
          });
        }
      }

      const job = await prisma.dataExportJob.create({
        data: { userId: ctx.user!.id, emailedTo: ctx.user!.email },
      });
      await dataExportQueue().add(
        DATA_EXPORT_JOB,
        { jobId: job.id },
        {
          jobId: `data-export:${job.id}`,
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 200 },
          attempts: 3,
          backoff: { type: 'exponential', delay: 30_000 },
        },
      );
      return { id: job.id };
    }),
  }),

  smsOtp: router({
    status: protectedProcedure.query(async ({ ctx }) => {
      const u = await prisma.user.findUnique({
        where: { id: ctx.user!.id },
        select: { phone: true, phoneVerified: true, twoFactorSms: true },
      });
      if (!u) throw new TRPCError({ code: 'NOT_FOUND' });
      // Mask everything except the last 4 digits in any UI exposure.
      const masked = u.phone ? u.phone.replace(/.(?=.{4})/g, '•') : null;
      return {
        phone: masked,
        verified: !!u.phoneVerified,
        enabled: u.twoFactorSms,
      };
    }),

    requestEnrollment: protectedProcedure
      .use(authRateLimit)
      .input(z.object({ phone: phoneSchema }))
      .mutation(async ({ ctx, input }) => {
        // Reject if the number is already attached (verified) to a different
        // user — phone is unique on User and we don't want a silent collision.
        const collision = await prisma.user.findFirst({
          where: {
            phone: input.phone,
            phoneVerified: { not: null },
            id: { not: ctx.user!.id },
          },
          select: { id: true },
        });
        if (collision) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'This phone is already in use on another account.',
          });
        }
        // Stash the candidate phone (unverified) so verify can match it. If
        // verification doesn't complete, the phone sits as "unverified" until
        // a successful enrollment overwrites it.
        await prisma.user.update({
          where: { id: ctx.user!.id },
          data: { phone: input.phone, phoneVerified: null },
        });
        const { code } = await issueOtp({
          destination: input.phone,
          channel: 'sms',
          purpose: 'verify',
          userId: ctx.user!.id,
        });
        await sendOtpSms(input.phone, code);
        return { sent: true };
      }),

    confirmEnrollment: protectedProcedure
      .use(authRateLimit)
      .input(z.object({ phone: phoneSchema, code: z.string().length(6) }))
      .mutation(async ({ ctx, input }) => {
        const result = await verifyOtp({
          destination: input.phone,
          purpose: 'verify',
          code: input.code,
        });
        if (!result.valid || result.userId !== ctx.user!.id) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid or expired code.' });
        }
        await prisma.user.update({
          where: { id: ctx.user!.id },
          data: {
            phone: input.phone,
            phoneVerified: new Date(),
            twoFactorSms: true,
          },
        });
        return { ok: true };
      }),

    disable: protectedProcedure.mutation(async ({ ctx }) => {
      // Keep the phone on file so re-enabling is one click. Drop the
      // verified flag so any account-recovery path that relies on a
      // verified phone has to re-prove it.
      await prisma.user.update({
        where: { id: ctx.user!.id },
        data: { twoFactorSms: false },
      });
      return { ok: true };
    }),
  }),

  verifyTwoFactor: publicProcedure
    .use(authRateLimit)
    .input(z.object({ email: emailSchema, code: z.string().length(6) }))
    .mutation(async ({ input, ctx }) => {
      const result = await verifyOtp({
        destination: input.email,
        purpose: 'login_2fa',
        code: input.code,
      });
      if (!result.valid || !result.userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid or expired code.' });
      }
      const user = await prisma.user.findUnique({ where: { id: result.userId } });
      if (!user) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'User not found.' });
      if (user.status !== 'ACTIVE') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Account is not active.' });
      }

      const ip = ctx.ipAddress ?? null;
      const ua = ctx.userAgent ?? null;
      const now = new Date();

      await createSession(result.userId, {
        ipAddress: ip ?? undefined,
        userAgent: ua ?? undefined,
      });

      await runPostLoginChecks({ user, method: 'password', ip, userAgent: ua, at: now });

      await prisma.user.update({
        where: { id: result.userId },
        data: {
          lastLoginAt: now,
          lastLoginIp: ip,
          lastLoginUserAgent: ua,
        },
      });

      return { ok: true };
    }),

  requestEmailOtp: publicProcedure
    .use(authRateLimit)
    .input(z.object({ email: emailSchema }))
    .mutation(async ({ input }) => {
      const user = await prisma.user.findUnique({ where: { email: input.email } });
      if (user) {
        const { code } = await issueOtp({
          destination: input.email,
          channel: 'email',
          purpose: 'login',
          userId: user.id,
        });
        await safeSend('passwordless OTP', () => sendOtpEmail(input.email, code));
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

      const user = await prisma.user.findUnique({ where: { id: result.userId } });
      if (!user) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'User not found.' });
      if (user.status !== 'ACTIVE') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Account is not active.' });
      }

      const ip = ctx.ipAddress ?? null;
      const ua = ctx.userAgent ?? null;
      const now = new Date();

      // Passwordless can be the user's first session — if their email isn't
      // yet verified, they came through the magic-link signup flow and any
      // referral cookie is theirs. After that we skip the attribution path
      // because they're an existing user just signing in.
      const firstTimeVerification = !user.emailVerified;

      await prisma.user.update({
        where: { id: result.userId },
        data: {
          emailVerified: user.emailVerified ?? now,
          lastLoginAt: now,
          lastLoginIp: ip,
          lastLoginUserAgent: ua,
          failedLoginAttempts: 0,
        },
      });

      if (firstTimeVerification) {
        await consumeReferralCookie(result.userId);
      }

      await createSession(result.userId, {
        ipAddress: ip ?? undefined,
        userAgent: ua ?? undefined,
      });

      await runPostLoginChecks({ user, method: 'passwordless', ip, userAgent: ua, at: now });

      return { userId: result.userId };
    }),

  logout: protectedProcedure.mutation(async () => {
    await destroySession();
    return { ok: true };
  }),

  requestPasswordReset: publicProcedure
    .use(authRateLimit)
    .input(z.object({ email: emailSchema }))
    .mutation(async ({ input }) => {
      const user = await prisma.user.findUnique({ where: { email: input.email } });
      if (user) {
        const { code } = await issueOtp({
          destination: input.email,
          channel: 'email',
          purpose: 'password_reset',
          userId: user.id,
        });
        await safeSend('password reset', () => sendOtpEmail(input.email, code));
      }
      return { sent: true };
    }),

  resetPassword: publicProcedure
    .use(authRateLimit)
    .input(
      z.object({
        email: emailSchema,
        code: z.string().length(6),
        password: passwordSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const result = await verifyOtp({
        destination: input.email,
        purpose: 'password_reset',
        code: input.code,
      });
      if (!result.valid || !result.userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid or expired code.' });
      }
      // Revoke every existing session — a stolen token must NOT survive a
      // password reset. Then issue a fresh session for the user who just
      // proved control of the email.
      await prisma.session.deleteMany({ where: { userId: result.userId } });

      await prisma.user.update({
        where: { id: result.userId },
        data: {
          passwordHash: hashPassword(input.password),
          lastLoginAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      await createSession(result.userId, {
        ipAddress: ctx.ipAddress ?? undefined,
        userAgent: ctx.userAgent ?? undefined,
      });
      return { userId: result.userId };
    }),

  me: publicProcedure.query(({ ctx }) => {
    if (!ctx.user) return null;
    return {
      id: ctx.user.id,
      email: ctx.user.email,
      fullName: ctx.user.fullName,
      roles: ctx.user.roles,
    };
  }),

  passkeys: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const items = await prisma.passkey.findMany({
        where: { userId: ctx.user!.id },
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
          where: { id: input.id, userId: ctx.user!.id },
        });
        return { ok: true };
      }),

    requestRegistration: protectedProcedure.mutation(async ({ ctx }) => {
      return startRegistration({
        userId: ctx.user!.id,
        userEmail: ctx.user!.email,
        userDisplayName: ctx.user!.fullName,
      });
    }),

    verifyRegistration: protectedProcedure
      .input(
        z.object({
          response: z.any(),
          name: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return finishRegistration({
          userId: ctx.user!.id,
          response: input.response,
          name: input.name,
        });
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
          response: z.any(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const { userId } = await finishAuthentication({
          email: input.email,
          response: input.response,
        });
        const user = await prisma.user.findUniqueOrThrow({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            lastLoginIp: true,
            lastLoginUserAgent: true,
          },
        });
        const ip = ctx.ipAddress ?? null;
        const ua = ctx.userAgent ?? null;
        const now = new Date();
        await createSession(userId, {
          ipAddress: ip ?? undefined,
          userAgent: ua ?? undefined,
        });
        await runPostLoginChecks({ user, method: 'passkey', ip, userAgent: ua, at: now });
        await prisma.user.update({
          where: { id: userId },
          data: {
            lastLoginAt: now,
            lastLoginIp: ip,
            lastLoginUserAgent: ua,
            failedLoginAttempts: 0,
          },
        });
        return { userId };
      }),
  }),
});
