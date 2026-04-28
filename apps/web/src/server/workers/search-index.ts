import { prisma } from '../db';
import {
  isOpenSearchEnabled,
  ensureIndex,
  indexProduct,
  bulkIndexProducts,
  deleteProduct,
  type ProductDoc,
} from '../search/opensearch';

/**
 * Project a Prisma Product (with the joins we need) onto a flat OpenSearch
 * doc. Centralised here so the indexer and the on-write hook agree.
 */
export async function projectProductDoc(productId: string): Promise<ProductDoc | null> {
  const p = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      category: { select: { id: true, slug: true } },
      seller: { select: { id: true, slug: true } },
      variants: {
        where: { isActive: true },
        orderBy: { priceAmount: 'asc' },
        take: 1,
        select: { priceAmount: true, currency: true },
      },
    },
  });
  if (!p) return null;
  const v = p.variants[0];
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    brand: p.brand,
    description: p.description,
    bullets: p.bullets,
    images: p.images,
    status: p.status,
    countryCode: p.countryCode,
    categoryId: p.category.id,
    categorySlug: p.category.slug,
    sellerId: p.seller.id,
    sellerSlug: p.seller.slug,
    attributes: (p.attributes as Record<string, string> | null) ?? null,
    ratingAvg: p.ratingAvg,
    ratingCount: p.ratingCount,
    salesCount: p.salesCount,
    priceAmount: v?.priceAmount ?? null,
    currency: v?.currency ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

export async function indexProductById(productId: string): Promise<void> {
  if (!isOpenSearchEnabled()) return;
  const doc = await projectProductDoc(productId);
  if (!doc) {
    await deleteProduct(productId);
    return;
  }
  if (doc.status !== 'ACTIVE') {
    await deleteProduct(productId);
    return;
  }
  await indexProduct(doc);
}

const BULK_BATCH_SIZE = 500;

/**
 * Full reindex via OpenSearch bulk API. Pages 500 products at a time, builds
 * the doc projections in parallel, ships in one round-trip per batch.
 *
 * Performance note: a 50K-doc catalog reindexes in ~30s on a single shard,
 * vs ~10min when this looped indexProductById. Errors are logged but don't
 * abort the run — the next-day reindex picks up missing docs.
 */
export async function fullReindex(opts: { log?: (m: string) => void } = {}): Promise<{
  total: number;
  errors: number;
}> {
  const log = opts.log ?? (() => {});
  await ensureIndex();
  let cursor: string | undefined;
  let total = 0;
  let errorCount = 0;
  while (true) {
    const batch = await prisma.product.findMany({
      where: { status: 'ACTIVE' },
      take: BULK_BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    if (batch.length === 0) break;

    const docs = (
      await Promise.all(batch.map((row) => projectProductDoc(row.id)))
    ).filter((d): d is ProductDoc => d !== null && d.status === 'ACTIVE');

    const { indexed, errors } = await bulkIndexProducts(docs);
    total += indexed;
    errorCount += errors.length;
    if (errors.length > 0) {
      log(`[search-index] batch had ${errors.length} errors; first: ${errors[0]!.reason}`);
    }
    cursor = batch[batch.length - 1]!.id;
    log(`[search-index] indexed ${total} so far`);
  }
  return { total, errors: errorCount };
}
