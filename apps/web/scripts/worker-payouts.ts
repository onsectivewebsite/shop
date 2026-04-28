/* eslint-disable no-console */
import { Worker, type Job } from 'bullmq';
import {
  PAYOUTS_QUEUE_NAME,
  PAYOUTS_SWEEP_JOB,
  getRedisConnection,
} from '../src/server/queue';
import { runPayoutsBatch } from '../src/server/workers/payouts';

/**
 * Long-running BullMQ worker that processes the `payouts` queue. Run as a
 * standalone process (k8s Deployment, ECS service, etc).
 *
 *   pnpm --filter @onsective/web worker:payouts
 */

const worker = new Worker(
  PAYOUTS_QUEUE_NAME,
  async (job: Job) => {
    if (job.name === PAYOUTS_SWEEP_JOB) {
      const result = await runPayoutsBatch({ log: (m) => console.log(m) });
      console.log(`[payouts] sweep complete:`, result);
      return result;
    }
    console.warn(`[payouts] unknown job name: ${job.name}`);
  },
  { connection: getRedisConnection(), concurrency: 1 },
);

worker.on('failed', (job, err) => {
  console.error(`[payouts] job ${job?.id} failed:`, err);
});

worker.on('error', (err) => {
  console.error('[payouts] worker error:', err);
});

const shutdown = async (signal: string) => {
  console.log(`[payouts] received ${signal}, draining…`);
  await worker.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

console.log('[payouts] worker started, listening for jobs');
