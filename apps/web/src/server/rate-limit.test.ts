import { describe, it, expect } from 'vitest';
import { checkRateLimit } from './rate-limit';

/**
 * Lightweight in-memory fake just for verifying the limiter's branching logic.
 * Real Redis is exercised by the integration tests (TBD).
 */
function makeFakeRedis() {
  const store = new Map<string, number>();
  const fake = {
    async incr(key: string) {
      const next = (store.get(key) ?? 0) + 1;
      store.set(key, next);
      return next;
    },
    async expire(_key: string, _ttl: number) {
      return 1;
    },
    pipeline() {
      const calls: Array<['incr' | 'expire', string]> = [];
      const p = {
        incr(key: string) {
          calls.push(['incr', key]);
          return p;
        },
        expire(key: string, _ttl: number) {
          calls.push(['expire', key]);
          return p;
        },
        async exec() {
          const out: Array<[null, number]> = [];
          for (const [op, key] of calls) {
            if (op === 'incr') {
              out.push([null, await fake.incr(key)]);
            } else {
              out.push([null, 1]);
            }
          }
          return out;
        },
      };
      return p;
    },
  };
  // Cast: the limiter only uses { incr, expire, pipeline }.
  return fake as unknown as Parameters<typeof checkRateLimit>[0]['redis'];
}

describe('checkRateLimit', () => {
  it('allows up to perMinute and rejects the next call', async () => {
    const redis = makeFakeRedis();
    for (let i = 0; i < 5; i++) {
      const r = await checkRateLimit({
        bucket: 'auth',
        key: 'ip:1.2.3.4',
        perMinute: 5,
        redis,
      });
      expect(r.ok).toBe(true);
    }
    const sixth = await checkRateLimit({
      bucket: 'auth',
      key: 'ip:1.2.3.4',
      perMinute: 5,
      redis,
    });
    expect(sixth.ok).toBe(false);
    if (!sixth.ok) {
      expect(sixth.reason).toBe('minute');
      expect(sixth.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it('hits the hour cap separately from the minute cap', async () => {
    const redis = makeFakeRedis();
    for (let i = 0; i < 4; i++) {
      const r = await checkRateLimit({
        bucket: 'auth',
        key: 'ip:5.6.7.8',
        perMinute: 100,
        perHour: 4,
        redis,
      });
      expect(r.ok).toBe(true);
    }
    const fifth = await checkRateLimit({
      bucket: 'auth',
      key: 'ip:5.6.7.8',
      perMinute: 100,
      perHour: 4,
      redis,
    });
    expect(fifth.ok).toBe(false);
    if (!fifth.ok) {
      expect(fifth.reason).toBe('hour');
    }
  });

  it('keys are isolated by scope', async () => {
    const redis = makeFakeRedis();
    for (let i = 0; i < 5; i++) {
      const r = await checkRateLimit({ bucket: 'auth', key: 'a', perMinute: 5, redis });
      expect(r.ok).toBe(true);
    }
    // Different key still has full budget.
    const fresh = await checkRateLimit({ bucket: 'auth', key: 'b', perMinute: 5, redis });
    expect(fresh.ok).toBe(true);
  });
});
