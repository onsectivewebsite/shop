import IORedis, { type Redis } from 'ioredis';
import { Queue } from 'bullmq';

let _connection: Redis | null = null;

/**
 * Shared ioredis connection for BullMQ producers and workers. BullMQ requires
 * `maxRetriesPerRequest: null` so blocking commands (BRPOPLPUSH) don't time out.
 */
export function getRedisConnection(): Redis {
  if (_connection) return _connection;
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  _connection = new IORedis(url, { maxRetriesPerRequest: null });
  return _connection;
}

export const PAYOUTS_QUEUE_NAME = 'payouts';
export const PAYOUTS_SWEEP_JOB = 'sweep-seller-payables';

let _payoutsQueue: Queue | null = null;
export function payoutsQueue(): Queue {
  if (!_payoutsQueue) {
    _payoutsQueue = new Queue(PAYOUTS_QUEUE_NAME, { connection: getRedisConnection() });
  }
  return _payoutsQueue;
}

export const IMAGES_QUEUE_NAME = 'image-variants';
export const IMAGE_VARIANTS_JOB = 'resize-product-image';

export type ImageVariantsJob = {
  sourceKey: string;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif';
};

let _imagesQueue: Queue<ImageVariantsJob> | null = null;
export function imagesQueue(): Queue<ImageVariantsJob> {
  if (!_imagesQueue) {
    _imagesQueue = new Queue<ImageVariantsJob>(IMAGES_QUEUE_NAME, {
      connection: getRedisConnection(),
    });
  }
  return _imagesQueue;
}

export const SEARCH_INDEX_QUEUE_NAME = 'search-index';
export const SEARCH_INDEX_JOB = 'index-product';

export type SearchIndexJob = {
  productId: string;
};

let _searchIndexQueue: Queue<SearchIndexJob> | null = null;
export function searchIndexQueue(): Queue<SearchIndexJob> {
  if (!_searchIndexQueue) {
    _searchIndexQueue = new Queue<SearchIndexJob>(SEARCH_INDEX_QUEUE_NAME, {
      connection: getRedisConnection(),
    });
  }
  return _searchIndexQueue;
}

/**
 * Fire-and-forget enqueue used by mutation paths. Swallows queue errors so a
 * Redis blip can't break product writes — the periodic full reindex covers
 * the gap.
 */
export async function enqueueSearchReindex(productId: string): Promise<void> {
  try {
    await searchIndexQueue().add(
      SEARCH_INDEX_JOB,
      { productId },
      {
        jobId: `search-index:${productId}`,
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[search-index] enqueue failed (will be picked up by full reindex):', err);
  }
}
