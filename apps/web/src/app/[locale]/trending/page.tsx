import Link from 'next/link';
import Image from 'next/image';
import { Star, TrendingUp, ArrowUp, ArrowDown, Minus } from 'lucide-react';

const CARD_SIZES = '(min-width: 1024px) 16vw, (min-width: 768px) 33vw, 50vw';
import { prisma } from '@/server/db';
import { pageReadLimit } from '@/server/page-rate-limit';
import { RateLimited } from '@/components/rate-limited';

export const metadata = { title: 'Trending now' };
export const dynamic = 'force-dynamic';

const PER_PAGE = 24;
const HOUR = 60 * 60 * 1000;

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

export default async function TrendingPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { page?: string; window?: string };
}) {
  const limit = await pageReadLimit();
  if (!limit.ok) return <RateLimited retryAfter={limit.retryAfterSeconds} />;

  const page = Math.max(1, Number(searchParams.page) || 1);
  const windowHours = searchParams.window === '6h' ? 6 : searchParams.window === '7d' ? 168 : 24;

  const now = Date.now();
  const since = new Date(now - windowHours * HOUR);
  const priorSince = new Date(now - 2 * windowHours * HOUR);
  const priorUntil = since;

  // Two windows in parallel: current & prior (for rank-change deltas).
  // Filter on PAID/CONFIRMED/SHIPPED/DELIVERED so abandoned cart items
  // don't pollute the signal.
  const ACTIVE_STATUS = ['PAID', 'CONFIRMED', 'SHIPPED', 'DELIVERED'] as const;

  const [current, prior] = await Promise.all([
    prisma.orderItem.groupBy({
      by: ['variantId'],
      where: { createdAt: { gte: since }, status: { in: ACTIVE_STATUS } },
      _sum: { qty: true },
      _count: { _all: true },
      orderBy: { _sum: { qty: 'desc' } },
      take: 200,
    }),
    prisma.orderItem.groupBy({
      by: ['variantId'],
      where: {
        createdAt: { gte: priorSince, lt: priorUntil },
        status: { in: ACTIVE_STATUS },
      },
      _sum: { qty: true },
      orderBy: { _sum: { qty: 'desc' } },
      take: 200,
    }),
  ]);

  // Map variant -> rank in prior window (1-indexed). Missing = wasn't on the
  // leaderboard last window, treat as a fresh debut.
  const priorRankByVariant = new Map<string, number>();
  prior.forEach((g, idx) => priorRankByVariant.set(g.variantId, idx + 1));

  // Pull variant + product details for the top current results
  const variantIds = current.map((g) => g.variantId);
  const variants = variantIds.length
    ? await prisma.variant.findMany({
        where: { id: { in: variantIds } },
        select: {
          id: true,
          priceAmount: true,
          mrpAmount: true,
          currency: true,
          stockQty: true,
          product: {
            select: {
              id: true,
              slug: true,
              title: true,
              ratingAvg: true,
              ratingCount: true,
              images: true,
              status: true,
              category: { select: { name: true, slug: true } },
            },
          },
        },
      })
    : [];

  const variantById = new Map(variants.map((v) => [v.id, v]));

  // Build the ranked list, keeping only products that are still ACTIVE.
  const ranked = current
    .map((g, idx) => {
      const v = variantById.get(g.variantId);
      if (!v || v.product.status !== 'ACTIVE') return null;
      const currentRank = idx + 1;
      const priorRank = priorRankByVariant.get(g.variantId) ?? null;
      const delta = priorRank ? priorRank - currentRank : null; // positive = moved up
      return {
        variant: v,
        unitsSold: g._sum.qty ?? 0,
        rank: currentRank,
        priorRank,
        delta,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // Re-rank after filtering inactive products so display ranks are contiguous.
  ranked.forEach((r, idx) => (r.rank = idx + 1));

  const total = ranked.length;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const items = ranked.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const windowLabel =
    windowHours === 6 ? 'past 6 hours' : windowHours === 168 ? 'past 7 days' : 'past 24 hours';

  return (
    <div className="bg-stone-50">
      <section className="container-page py-12 md:py-16">
        <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500">
          <TrendingUp size={12} className="text-emerald-700" /> Trending now
        </p>
        <h1 className="mt-4 font-display text-4xl font-medium leading-tight tracking-tight text-stone-950 md:text-6xl">
          What&rsquo;s <em className="italic">moving</em> right now.
        </h1>
        <p className="mt-4 max-w-2xl text-sm text-stone-600">
          Products ranked by units sold in the {windowLabel}. The arrows show how each
          item moved relative to the prior window — momentum, not just volume.
        </p>

        {/* Window pills */}
        <div className="mt-8 flex flex-wrap gap-2">
          <WindowPill href={`/${params.locale}/trending?window=6h`} label="6 hours" active={windowHours === 6} />
          <WindowPill href={`/${params.locale}/trending`} label="24 hours" active={windowHours === 24} />
          <WindowPill href={`/${params.locale}/trending?window=7d`} label="7 days" active={windowHours === 168} />
        </div>
      </section>

      <section className="container-page pb-24">
        {items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-12 text-center">
            <p className="font-display text-2xl font-medium text-stone-950">
              Nothing trending yet
            </p>
            <p className="mt-2 text-sm text-stone-600">
              When orders flow in the {windowLabel}, the leaderboard fills in.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {items.map((r) => {
                const v = r.variant;
                const cover = (v.product.images as string[])[0] ?? null;
                const hasMrp = v.mrpAmount && v.mrpAmount > v.priceAmount;
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
                      <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-stone-900 px-2 py-0.5 text-[10px] font-bold text-white">
                        #{r.rank}
                      </span>
                      <RankDeltaBadge delta={r.delta} priorRank={r.priorRank} />
                      {hasMrp && (
                        <span className="absolute right-2 bottom-2 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">
                          -{Math.round(((v.mrpAmount! - v.priceAmount) / v.mrpAmount!) * 100)}%
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
                      <div className="flex items-center justify-between gap-2 text-xs text-stone-500">
                        <span className="font-semibold text-emerald-700">
                          {r.unitsSold} sold
                        </span>
                        {v.product.ratingCount > 0 && (
                          <span className="flex items-center gap-1">
                            <span className="flex items-center text-amber-500">
                              {Array.from({ length: 5 }).map((_, idx) => (
                                <Star
                                  key={idx}
                                  size={10}
                                  strokeWidth={0}
                                  fill={idx < Math.round(v.product.ratingAvg ?? 0) ? 'currentColor' : 'none'}
                                  stroke="currentColor"
                                  className={idx < Math.round(v.product.ratingAvg ?? 0) ? '' : 'text-stone-300'}
                                />
                              ))}
                            </span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-baseline gap-2 pt-1">
                        <span className="text-base font-bold text-stone-950">
                          {formatMoney(v.priceAmount, v.currency)}
                        </span>
                        {hasMrp && (
                          <span className="text-xs text-stone-400 line-through">
                            {formatMoney(v.mrpAmount!, v.currency)}
                          </span>
                        )}
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
                    href={pageUrl(params.locale, searchParams, page - 1, windowHours)}
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
                    href={pageUrl(params.locale, searchParams, page + 1, windowHours)}
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

function RankDeltaBadge({ delta, priorRank }: { delta: number | null; priorRank: number | null }) {
  if (priorRank === null) {
    // Wasn't on the prior leaderboard at all — debut
    return (
      <span className="absolute right-2 top-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
        NEW
      </span>
    );
  }
  if (delta === null || delta === 0) {
    return (
      <span className="absolute right-2 top-2 inline-flex items-center gap-0.5 rounded-full bg-stone-200 px-1.5 py-0.5 text-[10px] font-bold text-stone-700">
        <Minus size={9} strokeWidth={3} />
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span
      className={`absolute right-2 top-2 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
        up ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
      }`}
    >
      {up ? <ArrowUp size={9} strokeWidth={3} /> : <ArrowDown size={9} strokeWidth={3} />}
      {Math.abs(delta)}
    </span>
  );
}

function WindowPill({ href, label, active }: { href: string; label: string; active: boolean }) {
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
  windowHours: number,
): string {
  const search = new URLSearchParams();
  if (windowHours === 6) search.set('window', '6h');
  if (windowHours === 168) search.set('window', '7d');
  search.set('page', String(page));
  return `/${locale}/trending?${search.toString()}`;
}
