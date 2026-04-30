import Link from 'next/link';
import Image from 'next/image';
import { Star } from 'lucide-react';

// 6-col desktop grid → ~16vw per card. 3-col tablet, 2-col mobile.
const CARD_SIZES = '(min-width: 1024px) 16vw, (min-width: 768px) 33vw, 50vw';
import { prisma } from '@/server/db';
import { pageReadLimit } from '@/server/page-rate-limit';
import { RateLimited } from '@/components/rate-limited';

export const metadata = { title: "Today's Deals" };
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

export default async function DealsPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { page?: string; sort?: string };
}) {
  const limit = await pageReadLimit();
  if (!limit.ok) return <RateLimited retryAfter={limit.retryAfterSeconds} />;

  const page = Math.max(1, Number(searchParams.page) || 1);
  const sort = searchParams.sort ?? 'pct';

  // Pull active variants with mrp > price. Postgres can't ORDER BY a computed
  // expression efficiently for this, so we fetch a wide window then sort in
  // JS. With Phase 4's catalog sizing this stays under 5k rows comfortably.
  const candidates = await prisma.variant.findMany({
    where: {
      isActive: true,
      mrpAmount: { not: null },
      product: { status: 'ACTIVE' },
    },
    select: {
      id: true,
      title: true,
      priceAmount: true,
      mrpAmount: true,
      currency: true,
      stockQty: true,
      product: {
        select: {
          id: true,
          slug: true,
          title: true,
          brand: true,
          ratingAvg: true,
          ratingCount: true,
          images: true,
          category: { select: { slug: true, name: true } },
        },
      },
    },
    take: 500, // safety cap
  });

  // Filter out rows where the discount isn't real
  const live = candidates.filter(
    (v) => typeof v.mrpAmount === 'number' && v.mrpAmount > v.priceAmount,
  );

  // Sort: pct (default) | savings | rating
  const sorted = live.sort((a, b) => {
    if (sort === 'savings') {
      return (b.mrpAmount! - b.priceAmount) - (a.mrpAmount! - a.priceAmount);
    }
    if (sort === 'rating') {
      return (b.product.ratingAvg ?? 0) - (a.product.ratingAvg ?? 0);
    }
    // pct
    const aPct = (a.mrpAmount! - a.priceAmount) / a.mrpAmount!;
    const bPct = (b.mrpAmount! - b.priceAmount) / b.mrpAmount!;
    return bPct - aPct;
  });

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const items = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="bg-stone-50">
      <section className="container-page py-12 md:py-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500">
          Today&rsquo;s deals
        </p>
        <h1 className="mt-4 font-display text-4xl font-medium leading-tight tracking-tight text-stone-950 md:text-6xl">
          Discounts that <em className="italic">actually</em> stick.
        </h1>
        <p className="mt-4 max-w-2xl text-sm text-stone-600">
          Every item here is sold below its MRP. Sorted by % off so the deepest
          cuts surface first.
        </p>

        {/* Sort pills */}
        <div className="mt-8 flex flex-wrap gap-2">
          <SortPill href={`/${params.locale}/deals?sort=pct`} label="Biggest % off" active={sort === 'pct'} />
          <SortPill href={`/${params.locale}/deals?sort=savings`} label="Most savings" active={sort === 'savings'} />
          <SortPill href={`/${params.locale}/deals?sort=rating`} label="Top rated" active={sort === 'rating'} />
        </div>
      </section>

      <section className="container-page pb-24">
        {items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-12 text-center">
            <p className="font-display text-2xl font-medium text-stone-950">
              No deals right now
            </p>
            <p className="mt-2 text-sm text-stone-600">
              When sellers run promotions (set an MRP higher than the live price), they
              show up here automatically.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {items.map((v) => {
                const mrp = v.mrpAmount!;
                const pct = Math.round(((mrp - v.priceAmount) / mrp) * 100);
                const cover = (v.product.images as string[])[0] ?? null;
                const lowStock = v.stockQty > 0 && v.stockQty <= 5;
                return (
                  <Link
                    key={v.id}
                    href={`/${params.locale}/product/${v.product.slug}`}
                    className="group block overflow-hidden rounded-2xl border border-stone-200/60 bg-white transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.04)]"
                  >
                    <div className="relative aspect-square overflow-hidden bg-stone-100">
                      {cover && (
                        <Image
                          src={cover}
                          alt=""
                          fill
                          sizes={CARD_SIZES}
                          className="object-cover transition-transform group-hover:scale-105"
                        />
                      )}
                      <span className="absolute right-2 top-2 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        -{pct}%
                      </span>
                      {lowStock && (
                        <span className="absolute left-2 top-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-950">
                          Only {v.stockQty} left
                        </span>
                      )}
                      {v.stockQty === 0 && (
                        <span className="absolute inset-x-2 bottom-2 rounded-full bg-stone-900/80 py-1 text-center text-[11px] font-semibold text-white backdrop-blur">
                          Out of stock
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5 p-3">
                      {v.product.category && (
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                          {v.product.category.name}
                        </p>
                      )}
                      <p className="line-clamp-2 text-sm font-medium text-stone-900">
                        {v.product.title}
                      </p>
                      {v.product.ratingCount > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-stone-500">
                          <span className="flex items-center text-amber-500">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                size={11}
                                strokeWidth={0}
                                fill={i < Math.round(v.product.ratingAvg ?? 0) ? 'currentColor' : 'none'}
                                stroke="currentColor"
                                className={i < Math.round(v.product.ratingAvg ?? 0) ? '' : 'text-stone-300'}
                              />
                            ))}
                          </span>
                          ({v.product.ratingCount.toLocaleString()})
                        </div>
                      )}
                      <div className="flex items-baseline gap-2 pt-1">
                        <span className="text-base font-bold text-stone-950">
                          {formatMoney(v.priceAmount, v.currency)}
                        </span>
                        <span className="text-xs text-stone-400 line-through">
                          {formatMoney(mrp, v.currency)}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {totalPages > 1 && (
              <nav className="mt-12 flex items-center justify-center gap-3 text-sm">
                {page > 1 && (
                  <Link
                    href={`/${params.locale}/deals?sort=${sort}&page=${page - 1}`}
                    className="rounded-full border border-stone-300 px-4 py-2 hover:border-stone-500"
                  >
                    ← Prev
                  </Link>
                )}
                <span className="text-stone-500">
                  Page {page} of {totalPages} · {total.toLocaleString()} deals
                </span>
                {page < totalPages && (
                  <Link
                    href={`/${params.locale}/deals?sort=${sort}&page=${page + 1}`}
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

function SortPill({ href, label, active }: { href: string; label: string; active: boolean }) {
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
