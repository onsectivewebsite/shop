import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import type { Context } from './context';
import { checkRateLimit, type RateLimitBucket } from './rate-limit';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const middleware = t.middleware;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

/**
 * Block writes when the request is an impersonation session. View-as-user is
 * read-only by design — every mutation is rejected so a PM browsing as a
 * customer can never accidentally place an order or change a setting.
 */
const blockIfImpersonating = t.middleware(({ ctx, next, type }) => {
  if (ctx.impersonation && type === 'mutation') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Impersonation sessions are read-only.',
    });
  }
  return next();
});

const requireSeller = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
  if (!ctx.user.roles.includes('SELLER')) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Seller account required.' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const requireAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
  const adminRoles = ['ADMIN', 'OWNER', 'PLATFORM_MANAGER'] as const;
  if (!ctx.user.roles.some((r) => adminRoles.includes(r as (typeof adminRoles)[number]))) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin role required.' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const publicProcedureWithImpersonationGuard = t.procedure.use(blockIfImpersonating);
export const protectedProcedure = t.procedure.use(blockIfImpersonating).use(requireUser);
export const sellerProcedure = t.procedure.use(blockIfImpersonating).use(requireSeller);
export const adminProcedure = t.procedure.use(blockIfImpersonating).use(requireAdmin);

/**
 * Build a rate-limit middleware. The key derivation runs against `(ctx, input)`
 * — auth flows key on `ip:email`, mutations on `userId|ip`, etc. Throw with a
 * `Retry-After` hint so the client can back off cleanly.
 */
export function rateLimitMiddleware<TInput = unknown>(opts: {
  bucket: RateLimitBucket;
  perMinute: number;
  perHour?: number;
  keyFor: (args: { ctx: Context; input: TInput }) => string | null;
}) {
  return middleware(async ({ ctx, next, rawInput }) => {
    const key = opts.keyFor({ ctx, input: rawInput as TInput });
    if (!key) return next();

    const result = await checkRateLimit({
      bucket: opts.bucket,
      key,
      perMinute: opts.perMinute,
      perHour: opts.perHour,
    });
    if (!result.ok) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `Rate limit exceeded. Retry in ${result.retryAfterSeconds}s.`,
      });
    }
    return next();
  });
}

/** Auth flows: 5/min and 30/h, scoped to ip+email per SECURITY.md §4.1. */
export const authRateLimit = rateLimitMiddleware<{ email?: string } | undefined>({
  bucket: 'auth',
  perMinute: 5,
  perHour: 30,
  keyFor: ({ ctx, input }) => {
    const ip = ctx.ipAddress ?? 'unknown';
    const email = input?.email?.toLowerCase().trim() ?? 'noemail';
    return `${ip}:${email}`;
  },
});

/** Authenticated mutations (cart, checkout): 30/min per user, falls back to IP for guests. */
export const userMutationRateLimit = rateLimitMiddleware({
  bucket: 'mutation',
  perMinute: 30,
  keyFor: ({ ctx }) => ctx.user?.id ?? `ip:${ctx.ipAddress ?? 'unknown'}`,
});

/** Public catalog reads: 60/min per IP. */
export const publicReadRateLimit = rateLimitMiddleware({
  bucket: 'public-read',
  perMinute: 60,
  keyFor: ({ ctx }) => `ip:${ctx.ipAddress ?? 'unknown'}`,
});

/** Admin actions: 30/min per admin. */
export const adminRateLimit = rateLimitMiddleware({
  bucket: 'admin',
  perMinute: 30,
  keyFor: ({ ctx }) => ctx.user?.id ?? `ip:${ctx.ipAddress ?? 'unknown'}`,
});
