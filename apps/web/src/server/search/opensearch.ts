import { Client } from '@opensearch-project/opensearch';

/**
 * OpenSearch client + index management. Activates only when OPENSEARCH_URL
 * is set. Otherwise callers fall back to Postgres FTS.
 *
 * Index name lives in OPENSEARCH_INDEX (default: onsective-products). Mapping
 * is hand-tuned: title/brand boost, description fallback, attribute keyword
 * fields for facets, status keyword for filtering, price for range/sort.
 */

let _client: Client | null = null;

export function isOpenSearchEnabled(): boolean {
  return Boolean(process.env.OPENSEARCH_URL);
}

export function getOpenSearch(): Client {
  if (_client) return _client;
  const url = process.env.OPENSEARCH_URL;
  if (!url) throw new Error('OPENSEARCH_URL is not configured.');
  _client = new Client({
    node: url,
    auth:
      process.env.OPENSEARCH_USERNAME && process.env.OPENSEARCH_PASSWORD
        ? {
            username: process.env.OPENSEARCH_USERNAME,
            password: process.env.OPENSEARCH_PASSWORD,
          }
        : undefined,
    ssl: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
  });
  return _client;
}

export function indexName(): string {
  return process.env.OPENSEARCH_INDEX ?? 'onsective-products';
}

export type ProductDoc = {
  id: string;
  slug: string;
  title: string;
  brand: string | null;
  description: string;
  bullets: string[];
  images: string[];
  status: string;
  countryCode: string;
  categoryId: string;
  categorySlug: string;
  sellerId: string;
  sellerSlug: string;
  attributes: Record<string, string> | null;
  ratingAvg: number;
  ratingCount: number;
  salesCount: number;
  priceAmount: number | null;
  currency: string | null;
  createdAt: string;
};

// The OpenSearch JS client's TypeScript surface is strict about analyzer
// literals and rejects 'english' (it expects raw analyzer types only). We
// pass the mapping as a plain object — the server-side validates at index
// creation time, which is the real boundary.
const PRODUCT_MAPPING: Record<string, unknown> = {
  properties: {
    id: { type: 'keyword' },
    slug: { type: 'keyword' },
    title: {
      type: 'text',
      analyzer: 'english',
      fields: { keyword: { type: 'keyword', ignore_above: 256 } },
    },
    brand: {
      type: 'text',
      analyzer: 'english',
      fields: { keyword: { type: 'keyword', ignore_above: 256 } },
    },
    description: { type: 'text', analyzer: 'english' },
    bullets: { type: 'text', analyzer: 'english' },
    images: { type: 'keyword' },
    status: { type: 'keyword' },
    countryCode: { type: 'keyword' },
    categoryId: { type: 'keyword' },
    categorySlug: { type: 'keyword' },
    sellerId: { type: 'keyword' },
    sellerSlug: { type: 'keyword' },
    attributes: { type: 'flattened' },
    ratingAvg: { type: 'float' },
    ratingCount: { type: 'integer' },
    salesCount: { type: 'integer' },
    priceAmount: { type: 'integer' },
    currency: { type: 'keyword' },
    createdAt: { type: 'date' },
  },
};

/**
 * Create the index with our mapping if it doesn't exist. Idempotent. Run on
 * deploy (`scripts/opensearch-init.ts`) or as part of the reindex worker.
 */
export async function ensureIndex(): Promise<void> {
  const client = getOpenSearch();
  const exists = await client.indices.exists({ index: indexName() });
  if (exists.body) return;
  await client.indices.create({
    index: indexName(),
    body: {
      settings: {
        number_of_shards: 1,
        number_of_replicas: 1,
      } as Record<string, unknown>,
      mappings: PRODUCT_MAPPING as never,
    },
  });
}

export async function indexProduct(doc: ProductDoc): Promise<void> {
  const client = getOpenSearch();
  await client.index({
    index: indexName(),
    id: doc.id,
    body: doc,
    refresh: false,
  });
}

export async function deleteProduct(id: string): Promise<void> {
  const client = getOpenSearch();
  await client.delete({ index: indexName(), id }).catch(() => {});
}

/**
 * Bulk index a batch of docs in one round-trip. ~20× faster than indexProduct
 * in a loop. Wire format: action header `{ index: { _id } }` then doc body.
 */
export async function bulkIndexProducts(
  docs: ProductDoc[],
): Promise<{ indexed: number; errors: Array<{ id: string; reason: string }> }> {
  if (docs.length === 0) return { indexed: 0, errors: [] };
  const client = getOpenSearch();
  const body: unknown[] = [];
  for (const doc of docs) {
    body.push({ index: { _index: indexName(), _id: doc.id } });
    body.push(doc);
  }
  // The OpenSearch client's bulk-body type is overly narrow; cast at the
  // boundary. Wire format is validated server-side.
  const result = await client.bulk({ body: body as never, refresh: false });
  const items =
    (result.body as {
      items: Array<{ index?: { _id: string; status: number; error?: { reason?: string } } }>;
    }).items ?? [];
  const errors: Array<{ id: string; reason: string }> = [];
  let indexed = 0;
  for (const it of items) {
    const op = it.index;
    if (!op) continue;
    if (op.status >= 200 && op.status < 300) {
      indexed++;
    } else {
      errors.push({ id: op._id, reason: op.error?.reason ?? `HTTP ${op.status}` });
    }
  }
  return { indexed, errors };
}

export type SearchHit = {
  id: string;
  slug: string;
  title: string;
  brand: string | null;
  images: string[];
  priceAmount: number | null;
  currency: string | null;
  score: number;
};

export async function searchProducts(args: {
  q: string;
  page: number;
  perPage: number;
}): Promise<{ items: SearchHit[]; total: number }> {
  const client = getOpenSearch();
  const from = (args.page - 1) * args.perPage;

  const result = await client.search({
    index: indexName(),
    body: {
      from,
      size: args.perPage,
      query: {
        bool: {
          must: {
            multi_match: {
              query: args.q,
              fields: ['title^3', 'brand^2', 'bullets', 'description'],
              type: 'best_fields',
              fuzziness: 'AUTO',
            },
          },
          filter: [{ term: { status: 'ACTIVE' } }],
        },
      },
      _source: ['id', 'slug', 'title', 'brand', 'images', 'priceAmount', 'currency'],
    },
  });

  // OpenSearch typings are loose — we narrow at the boundary via unknown.
  const body = result.body as unknown as {
    hits: {
      total: { value: number } | number;
      hits: Array<{ _id: string; _score: number; _source: Omit<SearchHit, 'score'> }>;
    };
  };
  const total = typeof body.hits.total === 'number' ? body.hits.total : body.hits.total.value;
  const items = body.hits.hits.map((h) => ({ ...h._source, score: h._score }));
  return { items, total };
}
