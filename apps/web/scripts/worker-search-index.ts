/* eslint-disable no-console */
import { Worker, type Job } from 'bullmq';
import {
  SEARCH_INDEX_QUEUE_NAME,
  SEARCH_INDEX_JOB,
  getRedisConnection,
  type SearchIndexJob,
} from '../src/server/queue';
import { indexProductById } from '../src/server/workers/search-index';
import { isOpenSearchEnabled } from '../src/server/search/opensearch';

/**
 * Long-running BullMQ worker that pushes individual product changes into
 * OpenSearch. No-op when OPENSEARCH_URL isn't set — jobs still drain so the
 * queue doesn't back up if the toggle is flipped.
 *
 *   pnpm --filter @onsective/web worker:search-index
 */

const worker = new Worker<SearchIndexJob>(
  SEARCH_INDEX_QUEUE_NAME,
  async (job: Job<SearchIndexJob>) => {
    if (job.name !== SEARCH_INDEX_JOB) {
      console.warn(`[search-index] unknown job name: ${job.name}`);
      return;
    }
    if (!isOpenSearchEnabled()) return;
    await indexProductById(job.data.productId);
    return { productId: job.data.productId };
  },
  { connection: getRedisConnection(), concurrency: 4 },
);

worker.on('failed', (job, err) => {
  console.error(`[search-index] job ${job?.id} failed:`, err);
});

worker.on('error', (err) => {
  console.error('[search-index] worker error:', err);
});

const shutdown = async (signal: string) => {
  console.log(`[search-index] received ${signal}, draining…`);
  await worker.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

console.log('[search-index] worker started, listening for jobs');
