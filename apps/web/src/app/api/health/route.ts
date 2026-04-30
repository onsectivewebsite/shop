import { NextResponse } from 'next/server';
import IORedis from 'ioredis';
import { prisma } from '@/server/db';

/**
 * Public liveness + readiness endpoint for monitoring (UptimeRobot, AWS ALB,
 * etc). Returns 200 when Postgres + Redis are reachable; 503 if either is
 * down. No auth — but no sensitive data either: just `{ ok, postgres, redis }`.
 *
 * Probes run in parallel with a 1.5s timeout each so a hung dependency can't
 * delay the response past 2s. CDN/edge caches are bypassed via no-store.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PROBE_TIMEOUT_MS = 1500;

type ProbeResult = { ok: true; latencyMs: number } | { ok: false };

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ms),
    ),
  ]);
}

async function probePostgres(): Promise<ProbeResult> {
  const t0 = Date.now();
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, PROBE_TIMEOUT_MS);
    return { ok: true, latencyMs: Date.now() - t0 };
  } catch {
    return { ok: false };
  }
}

async function probeRedis(): Promise<ProbeResult> {
  const t0 = Date.now();
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  // Fresh connection per probe — no point keeping a long-lived client just for
  // health checks. lazyConnect avoids racing connect with the timeout.
  const client = new IORedis(url, {
    maxRetriesPerRequest: 1,
    connectTimeout: PROBE_TIMEOUT_MS,
    lazyConnect: true,
  });
  try {
    await withTimeout(client.connect(), PROBE_TIMEOUT_MS);
    const reply = await withTimeout(client.ping(), PROBE_TIMEOUT_MS);
    if (reply !== 'PONG') return { ok: false };
    return { ok: true, latencyMs: Date.now() - t0 };
  } catch {
    return { ok: false };
  } finally {
    client.disconnect();
  }
}

export async function GET() {
  const [pg, rd] = await Promise.all([probePostgres(), probeRedis()]);
  const ok = pg.ok && rd.ok;
  return NextResponse.json(
    {
      ok,
      service: 'web',
      postgres: pg.ok ? { ok: true, latencyMs: pg.latencyMs } : { ok: false },
      redis: rd.ok ? { ok: true, latencyMs: rd.latencyMs } : { ok: false },
      timestamp: new Date().toISOString(),
    },
    {
      status: ok ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    },
  );
}
