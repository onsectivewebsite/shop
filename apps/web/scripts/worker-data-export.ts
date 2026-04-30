/* eslint-disable no-console */
import { Worker, type Job } from 'bullmq';
import {
  DATA_EXPORT_QUEUE_NAME,
  DATA_EXPORT_JOB,
  getRedisConnection,
  type DataExportQueueJob,
} from '../src/server/queue';
import { runDataExport } from '../src/server/workers/data-export';

/**
 * Long-running BullMQ worker for GDPR data exports. Run as its own process:
 *
 *   pnpm --filter @onsective/web worker:data-export
 *
 * Concurrency is intentionally low (2). A single export touches many tables
 * and writes a JSON blob to S3 — fan-out is not the bottleneck, S3 is.
 */

const worker = new Worker<DataExportQueueJob>(
  DATA_EXPORT_QUEUE_NAME,
  async (job: Job<DataExportQueueJob>) => {
    if (job.name === DATA_EXPORT_JOB) {
      const result = await runDataExport(job.data);
      console.log(`[data-export] job=${job.data.jobId} → ${result.bytes} bytes (${result.s3Key})`);
      return result;
    }
    console.warn(`[data-export] unknown job name: ${job.name}`);
  },
  { connection: getRedisConnection(), concurrency: 2 },
);

worker.on('failed', (job, err) => {
  console.error(`[data-export] job ${job?.id} (${job?.data.jobId}) failed:`, err);
});

worker.on('error', (err) => {
  console.error('[data-export] worker error:', err);
});

const shutdown = async (signal: string) => {
  console.log(`[data-export] received ${signal}, draining…`);
  await worker.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

console.log('[data-export] worker started, listening for jobs');
