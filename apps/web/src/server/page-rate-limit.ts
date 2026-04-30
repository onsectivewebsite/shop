import { headers } from 'next/headers';
import { checkRateLimit, type RateLimitResult } from './rate-limit';

/**
 * Server-component rate limit for public catalog pages.
 *
 * tRPC paths are limited via the `publicReadRateLimit` middleware in trpc.ts;
 * SSR pages bypass tRPC and hit Prisma directly, so they need their own
 * gate. Same `public-read` bucket and budget (60/min/IP) so the two paths
 * share a single ceiling per visitor.
 *
 * Usage in a server component:
 *   const limit = await pageReadLimit();
 *   if (!limit.ok) return <RateLimited retryAfter={limit.retryAfterSeconds} />;
 *
 * Fail-open: rate-limit.ts returns `ok: true` when Redis is unreachable. We
 * trust that fallback rather than blocking real users on a Redis blip.
 */

const PER_MINUTE = 60;

function ipFromHeaders(): string {
  const h = headers();
  // x-forwarded-for is "client, proxy1, proxy2…" — first is the originator.
  const xff = h.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = h.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}

export async function pageReadLimit(): Promise<RateLimitResult> {
  const ip = ipFromHeaders();
  return checkRateLimit({
    bucket: 'public-read',
    key: `ip:${ip}`,
    perMinute: PER_MINUTE,
  });
}
