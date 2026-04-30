import { ProductCard } from '@/components/product-card';
import { SponsoredCard } from '@/components/sponsored-card';
import { SearchFilters } from '@/components/search-filters';
import { RateLimited } from '@/components/rate-limited';
import { prisma } from '@/server/db';
import { Prisma } from '@onsective/db';
import { pageReadLimit } from '@/server/page-rate-limit';
import { isOpenSearchEnabled, searchProducts } from '@/server/search/opensearch';

const PER_PAGE = 24;
const SPONSORED_SLOTS = 2;

type Props = {
  params: { locale: string };
  searchParams: {
    q?: string;
    page?: string;
    minPrice?: string;
    maxPrice?: string;
    brand?: string;
    minRating?: string;
  };
};

export async function generateMetadata({ searchParams }: Props) {
  return { title: searchParams.q ? `Search: ${searchParams.q}` : 'Search' };
}

type SearchHitItem = {
  id: string;
  slug: string;
  title: string;
  brand: string | null;
  images: string[];
  ratingAvg: number;
  ratingCount: number;
  variants: Array<{ priceAmount: number; mrpAmount: number | null; currency: string }>;
};

type Filters = {
  minPrice: number | null;
  maxPrice: number | null;
  brand: string;
  minRating: number | null;
};

function parseFilters(sp: Props['searchParams']): Filters {
  const minPrice = Number(sp.minPrice);
  const maxPrice = Number(sp.maxPrice);
  const minRating = Number(sp.minRating);
  return {
    minPrice: Number.isFinite(minPrice) && minPrice > 0 ? Math.floor(minPrice) : null,
    maxPrice: Number.isFinite(maxPrice) && maxPrice > 0 ? Math.floor(maxPrice) : null,
    brand: (sp.brand ?? '').trim(),
    minRating: Number.isFinite(minRating) && minRating > 0 ? minRating : null,
  };
}

async function runSearch(
  q: string,
  page: number,
  f: Filters,
): Promise<{ items: SearchHitItem[]; total: number }> {
  // OpenSearch backend doesn't yet do filters — fall through to Postgres for
  // filtered queries until Phase 8 wires faceted search.
  const hasFilters = f.minPrice !== null || f.maxPrice !== null || f.brand !== '' || f.minRating !== null;
  if (isOpenSearchEnabled() && !hasFilters) {
    const { items, total } = await searchProducts({ q, page, perPage: PER_PAGE });
    return {
      items: items.map((h) => ({
        id: h.id,
        slug: h.slug,
        title: h.title,
        brand: h.brand,
        images: h.images,
        ratingAvg: h.ratingAvg,
        ratingCount: h.ratingCount,
        variants:
          h.priceAmount !== null && h.currency !== null
            ? [{ priceAmount: h.priceAmount, mrpAmount: null, currency: h.currency }]
            : [],
      })),
      total,
    };
  }

  const offset = (page - 1) * PER_PAGE;

  const brandClause = f.brand
    ? Prisma.sql`AND p."brand" ILIKE ${`%${f.brand}%`}`
    : Prisma.empty;
  const ratingClause = f.minRating !== null
    ? Prisma.sql`AND s."ratingAvg" >= ${f.minRating}`
    : Prisma.empty;
  const priceClause =
    f.minPrice !== null || f.maxPrice !== null
      ? Prisma.sql`
          AND EXISTS (
            SELECT 1 FROM "Variant" v
            WHERE v."productId" = p."id"
              AND v."isActive"
              ${f.minPrice !== null ? Prisma.sql`AND v."priceAmount" >= ${f.minPrice}` : Prisma.empty}
              ${f.maxPrice !== null ? Prisma.sql`AND v."priceAmount" <= ${f.maxPrice}` : Prisma.empty}
          )
        `
      : Prisma.empty;
  const sellerJoin =
    f.minRating !== null
      ? Prisma.sql`JOIN "Seller" s ON s."id" = p."sellerId"`
      : Prisma.empty;

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      slug: string;
      title: string;
      brand: string | null;
      images: string[];
      ratingAvg: number;
      ratingCount: number;
      total: bigint;
    }>
  >(Prisma.sql`
    SELECT p."id", p."slug", p."title", p."brand", p."images",
           p."ratingAvg", p."ratingCount",
           COUNT(*) OVER() AS total
    FROM "Product" p
    ${sellerJoin}
    WHERE p."status" = 'ACTIVE'
      AND p."searchVector" @@ websearch_to_tsquery('english', ${q})
      ${brandClause}
      ${ratingClause}
      ${priceClause}
    ORDER BY ts_rank(p."searchVector", websearch_to_tsquery('english', ${q})) DESC,
             p."createdAt" DESC
    LIMIT ${PER_PAGE} OFFSET ${offset}
  `);

  if (rows.length === 0) return { items: [], total: 0 };

  const total = Number(rows[0]!.total);
  const variants = await prisma.variant.findMany({
    where: { productId: { in: rows.map((r) => r.id) }, isActive: true },
    select: { productId: true, priceAmount: true, mrpAmount: true, currency: true },
    orderBy: { priceAmount: 'asc' },
  });
  const byProduct = new Map<string, { priceAmount: number; mrpAmount: number | null; currency: string }>();
  for (const v of variants) {
    if (!byProduct.has(v.productId)) {
      byProduct.set(v.productId, {
        priceAmount: v.priceAmount,
        mrpAmount: v.mrpAmount,
        currency: v.currency,
      });
    }
  }
  return {
    items: rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      brand: r.brand,
      images: r.images,
      ratingAvg: r.ratingAvg,
      ratingCount: r.ratingCount,
      variants: byProduct.has(r.id) ? [byProduct.get(r.id)!] : [],
    })),
    total,
  };
}

async function runAdSlate(query: string) {
  const now = new Date();
  const candidates = await prisma.adCampaign.findMany({
    where: {
      status: 'ACTIVE',
      placement: 'SEARCH_RESULTS',
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    include: {
      product: {
        select: {
          id: true,
          slug: true,
          title: true,
          brand: true,
          images: true,
          status: true,
          ratingAvg: true,
          ratingCount: true,
          variants: {
            where: { isActive: true },
            orderBy: { priceAmount: 'asc' },
            take: 1,
            select: { priceAmount: true, mrpAmount: true, currency: true },
          },
        },
      },
    },
    take: 50,
  });

  const lower = query.toLowerCase();
  const matched = candidates
    .filter((c) => {
      if (c.product.status !== 'ACTIVE') return false;
      if (c.spentTodayMinor >= c.dailyBudgetMinor) return false;
      if (c.totalBudgetMinor && c.spentTotalMinor >= c.totalBudgetMinor) return false;
      if (c.keywords.length === 0) return true;
      return c.keywords.some((k) => lower.includes(k.toLowerCase()));
    })
    .sort((a, b) => b.bidCpcMinor - a.bidCpcMinor)
    .slice(0, SPONSORED_SLOTS);

  return matched.map((c) => ({
    campaignId: c.id,
    product: c.product,
  }));
}

export default async function SearchPage({ params, searchParams }: Props) {
  const q = (searchParams.q ?? '').trim();
  const page = Math.max(1, Number(searchParams.page ?? 1) || 1);
  const filters = parseFilters(searchParams);

  if (!q) {
    return (
      <div className="container-page py-12 text-center">
        <h1 className="font-display text-3xl font-medium text-stone-950">
          Search the marketplace
        </h1>
        <p className="mt-2 text-sm text-stone-500">Type a query in the header search box.</p>
      </div>
    );
  }

  const limit = await pageReadLimit();
  if (!limit.ok) return <RateLimited retryAfter={limit.retryAfterSeconds} />;

  const [{ items, total }, ads] = await Promise.all([runSearch(q, page, filters), runAdSlate(q)]);
  const adProductIds = new Set(ads.map((a) => a.product.id));
  const organicItems = items.filter((it) => !adProductIds.has(it.id));

  const activeFilterCount =
    (filters.minPrice !== null ? 1 : 0) +
    (filters.maxPrice !== null ? 1 : 0) +
    (filters.brand ? 1 : 0) +
    (filters.minRating !== null ? 1 : 0);

  return (
    <div className="container-page py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl font-medium tracking-tight text-stone-950 md:text-4xl">
          Results for &ldquo;{q}&rdquo;
        </h1>
        <p className="text-sm text-stone-500">
          {total === 0 ? 'No matches' : `${total.toLocaleString()} matches`}
          {activeFilterCount > 0 && ` · ${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} applied`}
        </p>
      </header>

      <div className="mt-8 grid gap-8 md:grid-cols-[260px_1fr]">
        <SearchFilters
          q={q}
          locale={params.locale}
          minPrice={filters.minPrice}
          maxPrice={filters.maxPrice}
          brand={filters.brand}
          minRating={filters.minRating}
        />

        <div>
          {ads.length === 0 && organicItems.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-12 text-center">
              <p className="font-display text-2xl font-medium text-stone-950">
                Nothing matches &ldquo;{q}&rdquo;
              </p>
              <p className="mt-2 text-sm text-stone-600">
                {activeFilterCount > 0
                  ? 'Try clearing the filters or broadening your search.'
                  : 'Try a different keyword or check the spelling.'}
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {ads.map((ad) => (
                <li key={`ad-${ad.campaignId}`}>
                  <SponsoredCard
                    campaignId={ad.campaignId}
                    query={q}
                    placement="SEARCH_RESULTS"
                    locale={params.locale}
                    product={ad.product}
                  />
                </li>
              ))}
              {organicItems.map((p) => (
                <li key={p.id}>
                  <ProductCard locale={params.locale} product={p} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
