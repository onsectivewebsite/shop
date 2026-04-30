import IORedis, { type Redis } from 'ioredis';
import { Queue } from 'bullmq';
import { prisma } from '@onsective/db';

let _redis: Redis | null = null;
function getRedis(): Redis {
  if (_redis) return _redis;
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  _redis = new IORedis(url, { maxRetriesPerRequest: null });
  return _redis;
}

export type ProbeResult =
  | { ok: true; latencyMs: number }
  | { ok: false; error: string };

export async function probePostgres(): Promise<ProbeResult> {
  const t0 = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - t0 };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Postgres unreachable.' };
  }
}

export async function probeRedis(): Promise<ProbeResult> {
  const t0 = Date.now();
  try {
    const r = getRedis();
    const pong = await r.ping();
    if (pong !== 'PONG') {
      return { ok: false, error: `Unexpected reply: ${pong}` };
    }
    return { ok: true, latencyMs: Date.now() - t0 };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Redis unreachable.' };
  }
}

export type QueueSnapshot = {
  name: string;
  ok: boolean;
  error?: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
  // Last job we can find for liveness signal
  lastCompletedAt: number | null;
  lastFailedAt: number | null;
};

const QUEUE_NAMES = ['payouts', 'image-variants', 'search-index'] as const;

async function probeQueue(name: string): Promise<QueueSnapshot> {
  const queue = new Queue(name, { connection: getRedis() });
  try {
    const counts = await queue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
      'paused',
    );
    // Pull the most recent completed/failed job (1 each) for last-seen timestamps.
    const [recentCompleted, recentFailed] = await Promise.all([
      queue.getJobs(['completed'], 0, 0, false),
      queue.getJobs(['failed'], 0, 0, false),
    ]);
    return {
      name,
      ok: true,
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0,
      paused: counts.paused ?? 0,
      lastCompletedAt: recentCompleted[0]?.finishedOn ?? null,
      lastFailedAt: recentFailed[0]?.finishedOn ?? null,
    };
  } catch (err) {
    return {
      name,
      ok: false,
      error: err instanceof Error ? err.message : 'Queue unreachable.',
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0,
      lastCompletedAt: null,
      lastFailedAt: null,
    };
  } finally {
    // Don't keep the queue connection open.
    await queue.close().catch(() => {});
  }
}

export async function probeAllQueues(): Promise<QueueSnapshot[]> {
  return Promise.all(QUEUE_NAMES.map(probeQueue));
}
