/* eslint-disable no-console */
import { Worker, type Job } from 'bullmq';
import {
  IMAGES_QUEUE_NAME,
  IMAGE_VARIANTS_JOB,
  getRedisConnection,
  type ImageVariantsJob,
} from '../src/server/queue';
import { processImageVariants } from '../src/server/workers/images';

/**
 * Long-running BullMQ worker that produces 200/400/800/1200 webp variants
 * for product images. Run as its own process:
 *
 *   pnpm --filter @onsective/web worker:images
 */

const worker = new Worker<ImageVariantsJob>(
  IMAGES_QUEUE_NAME,
  async (job: Job<ImageVariantsJob>) => {
    if (job.name === IMAGE_VARIANTS_JOB) {
      const result = await processImageVariants(job.data);
      console.log(`[images] resized ${job.data.sourceKey} → ${result.generated.length} variants`);
      return result;
    }
    console.warn(`[images] unknown job name: ${job.name}`);
  },
  { connection: getRedisConnection(), concurrency: 4 },
);

worker.on('failed', (job, err) => {
  console.error(`[images] job ${job?.id} (${job?.data.sourceKey}) failed:`, err);
});

worker.on('error', (err) => {
  console.error('[images] worker error:', err);
});

const shutdown = async (signal: string) => {
  console.log(`[images] received ${signal}, draining…`);
  await worker.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

console.log('[images] worker started, listening for jobs');
