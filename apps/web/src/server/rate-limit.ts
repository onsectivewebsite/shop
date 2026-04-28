import type { Redis } from 'ioredis';
import { getRedisConnection } from './queue';

/**
 * Fixed-window counter rate limiter, Redis-backed.
 *
 * Each call increments two windows: per-minute (always) and per-hour (when
 * `perHour` is set). The keyspace looks like
 *   rl:{bucket}:{key}:m:{minuteEpoch}     INCR + EXPIRE 60
 *   rl:{bucket}:{key}:h:{hourEpoch}       INCR + EXPIRE 3600
 *
 * Fail-open: if Redis is unreachable we allow the request and log. A best-
 * effort limiter that vanishes under partial outage is preferred over wedged
 * auth flows. Edge-layer rate limiting (CloudFront/WAF, Cloudflare) catches
 * the floor.
 */

export type RateLimitBucket = 'auth' | 'mutation' | 'public-read' | 'authed-read' | 'admin';

export type RateLimitArgs = {
  bucket: RateLimitBucket;
  /** Per-bucket scope (e.g. ip, userId, "ip:email"). */
  key: string;
  perMinute: number;
  perHour?: number;
  /** Override Redis client (used by tests). */
  redis?: Pick<Redis, 'incr' | 'expire' | 'pipeline'>;
};

export type RateLimitResult =
  | { ok: true; remainingMinute: number; remainingHour?: number }
  | { ok: false; retryAfterSeconds: number; reason: 'minute' | 'hour' };

export async function checkRateLimit(args: RateLimitArgs): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const minuteEpoch = Math.floor(now / 60);
  const hourEpoch = Math.floor(now / 3600);
  const minuteKey = `rl:${args.bucket}:${args.key}:m:${minuteEpoch}`;
  const hourKey = args.perHour ? `rl:${args.bucket}:${args.key}:h:${hourEpoch}` : null;

  const redis = args.redis ?? getRedisConnection();

  try {
    const pipe = redis.pipeline();
    pipe.incr(minuteKey);
    pipe.expire(minuteKey, 60);
    if (hourKey) {
      pipe.incr(hourKey);
      pipe.expire(hourKey, 3600);
    }
    const replies = (await pipe.exec()) ?? [];

    const minuteCount = Number(replies[0]?.[1] ?? 0);
    if (minuteCount > args.perMinute) {
      return {
        ok: false,
        reason: 'minute',
        retryAfterSeconds: 60 - (now % 60),
      };
    }

    if (hourKey && args.perHour) {
      const hourCount = Number(replies[2]?.[1] ?? 0);
      if (hourCount > args.perHour) {
        return {
          ok: false,
          reason: 'hour',
          retryAfterSeconds: 3600 - (now % 3600),
        };
      }
      return {
        ok: true,
        remainingMinute: Math.max(0, args.perMinute - minuteCount),
        remainingHour: Math.max(0, args.perHour - hourCount),
      };
    }

    return {
      ok: true,
      remainingMinute: Math.max(0, args.perMinute - minuteCount),
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[rate-limit] redis error, failing open:', err);
    return { ok: true, remainingMinute: args.perMinute };
  }
}
