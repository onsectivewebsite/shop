import Link from 'next/link';
import { Star, Trophy } from 'lucide-react';
import { prisma } from '@/server/db';

export const metadata = { title: 'Best Sellers' };
export const dynamic = 'force-dynamic';

const PER_PAGE = 24;

function formatMoney(amountMinor: number, currency: string): string {
  const v = amountMinor / 100;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(v);
  } catch {
    return `${v.toFixed(2)} ${currency}`;
  }
}

export default async function BestSellersPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { page?: string; category?: string };
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);

  // Optional category filter via slug
  let categoryId: string | null = null;
  if (searchParams.category) {
    const cat = await prisma.category.findUnique({
      where: { slug: searchParams.category },
      select: { id: true },
    });
    categoryId = cat?.id ?? null;
  }

  const productWhere = {
    status: 'ACTIVE' as const,
    ...(categoryId ? { categoryId } : {}),
  };

  const [products, total, topCategories] = await Promise.all([
    prisma.product.findMany({
      where: productWhere,
      orderBy: { orderItems: { _count: 'desc' } },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        slug: true,
        title: true,
        brand: true,
        ratingAvg: true,
        ratingCount: true,
        images: true,
        category: { select: { slug: true, name: true } },
        variants: {
          take: 1,
          orderBy: { priceAmount: 'asc' },
          select: { priceAmount: true, mrpAmount: true, currency: true, stockQty: true },
        },
        _count: { select: { orderItems: true } },
      },
    }),
    prisma.product.count({ where: productWhere }),
    prisma.category.findMany({
      where: { isActive: true, parentId: null },
      orderBy: { sortOrder: 'asc' },
      select: { slug: true, name: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="bg-stone-50">
      <section className="container-page py-12 md:py-16">
        <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500">
          <Trophy size={12} className="text-amber-500" /> Best sellers
        </p>
        <h1 className="mt-4 font-display text-4xl font-medium leading-tight tracking-tight text-stone-950 md:text-6xl">
          What buyers <em className="italic">keep</em> buying.
        </h1>
        <p className="mt-4 max-w-2xl text-sm text-stone-600">
          Ranked by total units sold across the marketplace. Updated continuously —
          today&rsquo;s shipping orders move tomorrow&rsquo;s rankings.
        </p>

        {/* Category filter pills */}
        <div className="mt-8 flex flex-wrap gap-2">
          <CategoryPill
            href={`/${params.locale}/best-sellers`}
            label="All categories"
            active={!searchParams.category}
          />
          {topCategories.map((c) => (
            <CategoryPill
              key={c.slug}
              href={`/${params.locale}/best-sellers?category=${c.slug}`}
              label={c.name}
              active={searchParams.category === c.slug}
            />
          ))}
        </div>
      </section>

      <section className="container-page pb-24">
        {products.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-12 text-center">
            <p className="font-display text-2xl font-medium text-stone-950">
              No best sellers yet
            </p>
            <p className="mt-2 text-sm text-stone-600">
              Once orders start flowing, the most-purchased products show up here.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {products.map((p, i) => {
                const v = p.variants[0];
                const cover = (p.images as string[])[0] ?? null;
                const rank = (page - 1) * PER_PAGE + i + 1;
                const isTop3 = rank <= 3;
                return (
                  <Link
                    key={p.id}
                    href={`/${params.locale}/product/${p.slug}`}
                    className="group block overflow-hidden rounded-2xl border border-stone-200/60 bg-white transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.04)]"
                  >
                    <div className="relative aspect-square overflow-hidden bg-stone-100">
                      {cover && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cover}
                          alt=""
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                      )}
                      <span
                        className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isTop3
                            ? 'bg-amber-400 text-amber-950'
                            : 'bg-stone-900 text-white'
                        }`}
                      >
                        {isTop3 && <Trophy size={9} strokeWidth={2.5} />}#{rank}
                      </span>
                      {v && v.mrpAmount && v.mrpAmount > v.priceAmount && (
                        <span className="absolute right-2 top-2 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">
                          -{Math.round(((v.mrpAmount - v.priceAmount) / v.mrpAmount) * 100)}%
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5 p-3">
                      {p.category && (
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                          {p.category.name}
                        </p>
                      )}
                      <p className="line-clamp-2 text-sm font-medium text-stone-900">
                        {p.title}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-stone-500">
                        {p.ratingCount > 0 ? (
                          <>
                            <span className="flex items-center text-amber-500">
                              {Array.from({ length: 5 }).map((_, idx) => (
                                <Star
                                  key={idx}
                                  size={11}
                                  strokeWidth={0}
                                  fill={idx < Math.round(p.ratingAvg ?? 0) ? 'currentColor' : 'none'}
                                  stroke="currentColor"
                                  className={idx < Math.round(p.ratingAvg ?? 0) ? '' : 'text-stone-300'}
                                />
                              ))}
                            </span>
                            ({p.ratingCount.toLocaleString()})
                          </>
                        ) : (
                          <span>{p._count.orderItems.toLocaleString()} sold</span>
                        )}
                      </div>
                      {v && (
                        <div className="flex items-baseline gap-2 pt-1">
                          <span className="text-base font-bold text-stone-950">
                            {formatMoney(v.priceAmount, v.currency)}
                          </span>
                          {v.mrpAmount && v.mrpAmount > v.priceAmount && (
                            <span className="text-xs text-stone-400 line-through">
                              {formatMoney(v.mrpAmount, v.currency)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>

            {totalPages > 1 && (
              <nav className="mt-12 flex items-center justify-center gap-3 text-sm">
                {page > 1 && (
                  <Link
                    href={pageUrl(params.locale, searchParams, page - 1)}
                    className="rounded-full border border-stone-300 px-4 py-2 hover:border-stone-500"
                  >
                    ← Prev
                  </Link>
                )}
                <span className="text-stone-500">
                  Page {page} of {totalPages} · {total.toLocaleString()} products
                </span>
                {page < totalPages && (
                  <Link
                    href={pageUrl(params.locale, searchParams, page + 1)}
                    className="rounded-full border border-stone-300 px-4 py-2 hover:border-stone-500"
                  >
                    Next →
                  </Link>
                )}
              </nav>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function CategoryPill({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex h-9 items-center rounded-full px-4 text-xs font-semibold transition-colors ${
        active
          ? 'bg-stone-900 text-white'
          : 'border border-stone-300 bg-white text-stone-700 hover:border-stone-500'
      }`}
    >
      {label}
    </Link>
  );
}

function pageUrl(
  locale: string,
  params: Record<string, string | undefined>,
  page: number,
): string {
  const search = new URLSearchParams();
  if (params.category) search.set('category', params.category);
  search.set('page', String(page));
  return `/${locale}/best-sellers?${search.toString()}`;
}
