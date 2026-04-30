import IORedis, { type Redis } from 'ioredis';
import { Queue } from 'bullmq';

let _connection: Redis | null = null;
export function getRedisConnection(): Redis {
  if (_connection) return _connection;
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  _connection = new IORedis(url, { maxRetriesPerRequest: null });
  return _connection;
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

let _searchIndexQueue: Queue<{ productId: string }> | null = null;
export function searchIndexQueue(): Queue<{ productId: string }> {
  if (!_searchIndexQueue) {
    _searchIndexQueue = new Queue<{ productId: string }>(SEARCH_INDEX_QUEUE_NAME, {
      connection: getRedisConnection(),
    });
  }
  return _searchIndexQueue;
}

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
    console.warn('[search-index] enqueue failed:', err);
  }
}
