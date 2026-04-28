import { z } from 'zod';
import { Prisma } from '@onsective/db';
import { router, publicProcedure, publicReadRateLimit } from '../trpc';
import { prisma } from '../db';
import { isOpenSearchEnabled, searchProducts } from '../search/opensearch';

const limitedRead = publicProcedure.use(publicReadRateLimit);

type SearchRow = {
  id: string;
  slug: string;
  title: string;
  brand: string | null;
  images: string[];
};

type SearchVariantRow = {
  productId: string;
  priceAmount: number;
  mrpAmount: number | null;
  currency: string;
};

export const catalogRouter = router({
  categories: router({
    tree: limitedRead.query(async () => {
      // Top-level only for v0; expand to recursive in Phase 1.
      return prisma.category.findMany({
        where: { parentId: null, isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, slug: true, name: true, imageUrl: true },
      });
    }),

    bySlug: limitedRead
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        return prisma.category.findUnique({
          where: { slug: input.slug },
          include: { children: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } },
        });
      }),
  }),

  products: router({
    byCategory: limitedRead
      .input(
        z.object({
          slug: z.string(),
          page: z.number().int().min(1).default(1),
          perPage: z.number().int().min(1).max(60).default(24),
        }),
      )
      .query(async ({ input }) => {
        const category = await prisma.category.findUnique({ where: { slug: input.slug } });
        if (!category) return { items: [], total: 0, page: input.page, perPage: input.perPage };

        const where = { categoryId: category.id, status: 'ACTIVE' as const };
        const [items, total] = await Promise.all([
          prisma.product.findMany({
            where,
            include: { variants: { take: 1, where: { isActive: true } } },
            skip: (input.page - 1) * input.perPage,
            take: input.perPage,
            orderBy: { createdAt: 'desc' },
          }),
          prisma.product.count({ where }),
        ]);

        return { items, total, page: input.page, perPage: input.perPage };
      }),

    bySlug: limitedRead
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        return prisma.product.findUnique({
          where: { slug: input.slug },
          include: {
            variants: { where: { isActive: true } },
            seller: { select: { id: true, displayName: true, slug: true, ratingAvg: true } },
            category: true,
          },
        });
      }),
  }),

  /**
   * Catalog search.
   *
   * - **OpenSearch** (Phase 4): activated when `OPENSEARCH_URL` is set. Adds
   *   fuzziness, multi-field boosting, and the room to grow into synonyms /
   *   facets / filters without rewriting the API.
   * - **Postgres FTS** (Phase 1, default): a generated `searchVector` column
   *   on Product, GIN-indexed, queried via `websearch_to_tsquery`.
   *
   * Same response shape from both backends so callers don't care which is on.
   */
  search: limitedRead
    .input(
      z.object({
        q: z.string().min(1).max(120),
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(60).default(24),
      }),
    )
    .query(async ({ input }) => {
      if (isOpenSearchEnabled()) {
        const { items: hits, total } = await searchProducts({
          q: input.q,
          page: input.page,
          perPage: input.perPage,
        });
        return {
          items: hits.map((h) => ({
            id: h.id,
            slug: h.slug,
            title: h.title,
            brand: h.brand,
            images: h.images,
            variants:
              h.priceAmount !== null && h.currency !== null
                ? [{ priceAmount: h.priceAmount, mrpAmount: null, currency: h.currency }]
                : [],
          })),
          total,
          page: input.page,
          perPage: input.perPage,
        };
      }

      const offset = (input.page - 1) * input.perPage;

      const rows = await prisma.$queryRaw<Array<SearchRow & { rank: number; total: bigint }>>(
        Prisma.sql`
          SELECT
            p."id",
            p."slug",
            p."title",
            p."brand",
            p."images",
            ts_rank(p."searchVector", websearch_to_tsquery('english', ${input.q})) AS rank,
            COUNT(*) OVER() AS total
          FROM "Product" p
          WHERE p."status" = 'ACTIVE'
            AND p."searchVector" @@ websearch_to_tsquery('english', ${input.q})
          ORDER BY rank DESC, p."createdAt" DESC
          LIMIT ${input.perPage} OFFSET ${offset}
        `,
      );

      if (rows.length === 0) {
        return { items: [], total: 0, page: input.page, perPage: input.perPage };
      }

      const total = Number(rows[0]!.total);
      const productIds = rows.map((r) => r.id);
      const variants = await prisma.variant.findMany({
        where: { productId: { in: productIds }, isActive: true },
        select: { productId: true, priceAmount: true, mrpAmount: true, currency: true },
      });
      const variantByProduct = new Map<string, SearchVariantRow>();
      for (const v of variants) {
        if (!variantByProduct.has(v.productId)) variantByProduct.set(v.productId, v);
      }

      const items = rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        brand: r.brand,
        images: r.images,
        variants: variantByProduct.has(r.id) ? [variantByProduct.get(r.id)!] : [],
      }));

      return { items, total, page: input.page, perPage: input.perPage };
    }),
});
