import { ProductCard } from '@/components/product-card';
import { SponsoredCard } from '@/components/sponsored-card';
import { prisma } from '@/server/db';
import { Prisma } from '@onsective/db';
import { isOpenSearchEnabled, searchProducts } from '@/server/search/opensearch';

const PER_PAGE = 24;
const SPONSORED_SLOTS = 2;

type Props = {
  params: { locale: string };
  searchParams: { q?: string; page?: string };
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
  variants: Array<{ priceAmount: number; mrpAmount: number | null; currency: string }>;
};

async function runSearch(q: string, page: number): Promise<{ items: SearchHitItem[]; total: number }> {
  if (isOpenSearchEnabled()) {
    const { items, total } = await searchProducts({ q, page, perPage: PER_PAGE });
    return {
      items: items.map((h) => ({
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
    };
  }

  const offset = (page - 1) * PER_PAGE;
  const rows = await prisma.$queryRaw<
    Array<{ id: string; slug: string; title: string; brand: string | null; images: string[]; total: bigint }>
  >(Prisma.sql`
    SELECT p."id", p."slug", p."title", p."brand", p."images",
           COUNT(*) OVER() AS total
    FROM "Product" p
    WHERE p."status" = 'ACTIVE'
      AND p."searchVector" @@ websearch_to_tsquery('english', ${q})
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

  if (!q) {
    return (
      <div className="container-page py-12 text-center">
        <h1 className="text-2xl font-bold">Search the marketplace</h1>
        <p className="mt-2 text-sm text-slate-500">Type a query in the header search box.</p>
      </div>
    );
  }

  const [{ items, total }, ads] = await Promise.all([runSearch(q, page), runAdSlate(q)]);
  // Filter out sponsored products that would also appear in organic — same
  // product shouldn't appear twice on the page.
  const adProductIds = new Set(ads.map((a) => a.product.id));
  const organicItems = items.filter((it) => !adProductIds.has(it.id));

  return (
    <div className="container-page py-8">
      <header className="flex items-end justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Results for &ldquo;{q}&rdquo;
        </h1>
        <p className="text-sm text-slate-500">
          {total === 0 ? 'No matches' : `${total.toLocaleString()} matches`}
        </p>
      </header>

      {ads.length === 0 && organicItems.length === 0 ? (
        <div className="mt-12 rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          No products match &ldquo;{q}&rdquo;.
        </div>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
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
  );
}
