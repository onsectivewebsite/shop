import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import { Prisma } from '@onsective/db';
import { getSellerSession } from '@/server/auth';
import { prisma } from '@/server/db';
import { SellerShell } from '@/components/seller-shell';
import { RangePicker } from '@/components/range-picker';
import { RevenueChart, UnitsChart } from '@/components/analytics-charts';
import { formatMoney } from '@/lib/format';

export const metadata = { title: 'Analytics' };
export const dynamic = 'force-dynamic';

const VALID_RANGES = [7, 30, 90, 365] as const;
type Range = (typeof VALID_RANGES)[number];

function parseRange(raw: string | undefined): Range {
  const n = Number(raw ?? 30);
  return (VALID_RANGES as readonly number[]).includes(n) ? (n as Range) : 30;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: { days?: string };
}) {
  const session = await getSellerSession();
  if (!session) redirect('/login');
  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } });
  if (!seller) redirect('/apply');

  const fromDays = parseRange(searchParams.days);
  const since = new Date(Date.now() - fromDays * 24 * 60 * 60 * 1000);

  const [paid, refunded, inFlight, ratings, series, topGrouped] = await Promise.all([
    prisma.orderItem.findMany({
      where: {
        sellerId: seller.id,
        createdAt: { gte: since },
        status: { in: ['PAID', 'CONFIRMED', 'SHIPPED', 'DELIVERED'] },
      },
      select: {
        lineSubtotal: true,
        commissionAmount: true,
        sellerNetAmount: true,
        qty: true,
        orderId: true,
      },
    }),
    prisma.orderItem.count({
      where: { sellerId: seller.id, createdAt: { gte: since }, status: 'REFUNDED' },
    }),
    prisma.orderItem.count({
      where: { sellerId: seller.id, createdAt: { gte: since }, status: 'CREATED' },
    }),
    prisma.review.aggregate({
      where: { orderItem: { sellerId: seller.id, createdAt: { gte: since } } },
      _avg: { rating: true },
      _count: true,
    }),
    prisma.$queryRaw<Array<{ day: Date; revenue: bigint; units: bigint; orders: bigint }>>(
      Prisma.sql`
        SELECT
          date_trunc('day', oi."createdAt") AS day,
          SUM(oi."lineSubtotal")::bigint    AS revenue,
          SUM(oi."qty")::bigint             AS units,
          COUNT(DISTINCT oi."orderId")::bigint AS orders
        FROM "OrderItem" oi
        WHERE oi."sellerId" = ${seller.id}
          AND oi."createdAt" >= ${since}
          AND oi."status" IN ('PAID', 'CONFIRMED', 'SHIPPED', 'DELIVERED')
        GROUP BY day
        ORDER BY day ASC
      `,
    ),
    prisma.orderItem.groupBy({
      by: ['variantId'],
      where: {
        sellerId: seller.id,
        createdAt: { gte: since },
        status: { in: ['PAID', 'CONFIRMED', 'SHIPPED', 'DELIVERED'] },
      },
      _sum: { lineSubtotal: true, qty: true },
      orderBy: { _sum: { lineSubtotal: 'desc' } },
      take: 10,
    }),
  ]);

  const grossRevenue = paid.reduce((acc, i) => acc + i.lineSubtotal, 0);
  const netRevenue = paid.reduce((acc, i) => acc + i.sellerNetAmount, 0);
  const unitsSold = paid.reduce((acc, i) => acc + i.qty, 0);
  const ordersCount = new Set(paid.map((i) => i.orderId)).size;
  const aov = ordersCount > 0 ? Math.round(grossRevenue / ordersCount) : 0;
  const returnsRate = paid.length > 0 ? refunded / (paid.length + refunded) : 0;
  const currency = 'USD';

  const variants = topGrouped.length
    ? await prisma.variant.findMany({
        where: { id: { in: topGrouped.map((g) => g.variantId) } },
        select: {
          id: true,
          sku: true,
          product: { select: { title: true, slug: true, images: true } },
        },
      })
    : [];
  const byId = new Map(variants.map((v) => [v.id, v]));
  const top = topGrouped.map((g) => ({
    variantId: g.variantId,
    sku: byId.get(g.variantId)?.sku ?? '',
    title: byId.get(g.variantId)?.product.title ?? '',
    slug: byId.get(g.variantId)?.product.slug ?? '',
    image: (byId.get(g.variantId)?.product.images as string[] | undefined)?.[0] ?? null,
    revenue: g._sum.lineSubtotal ?? 0,
    units: g._sum.qty ?? 0,
  }));

  const seriesData = series.map((r) => ({
    day: r.day.toISOString().slice(0, 10),
    revenue: Number(r.revenue),
    units: Number(r.units),
    orders: Number(r.orders),
  }));

  return (
    <SellerShell email={session.user.email} name={session.user.fullName ?? undefined}>
      <div className="container-page py-10 md:py-14">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900"
        >
          <ArrowLeft size={14} /> Back to dashboard
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-medium tracking-tight text-stone-950 md:text-5xl">
              Analytics
            </h1>
            <p className="mt-2 text-sm text-stone-600">Last {fromDays} days</p>
          </div>
          <RangePicker current={fromDays} />
        </div>

        {/* Stat cards */}
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Gross revenue" value={formatMoney(grossRevenue, currency)} />
          <Stat label="Net (after commission)" value={formatMoney(netRevenue, currency)} />
          <Stat label="Orders" value={ordersCount.toLocaleString()} />
          <Stat label="Units sold" value={unitsSold.toLocaleString()} />
          <Stat label="Average order value" value={formatMoney(aov, currency)} />
          <Stat label="In flight" value={inFlight.toLocaleString()} sub="Created, awaiting payment" />
          <Stat
            label="Returns rate"
            value={`${(returnsRate * 100).toFixed(1)}%`}
            sub={`${refunded} refunded items`}
          />
          <Stat
            label="Rating"
            value={ratings._avg.rating ? ratings._avg.rating.toFixed(2) : '—'}
            sub={`${ratings._count} reviews`}
          />
        </div>

        {/* Charts */}
        <section className="mt-12">
          <h2 className="font-display text-2xl font-medium tracking-tight text-stone-950">
            Revenue
          </h2>
          <div className="mt-4 rounded-3xl border border-stone-200 bg-white p-5">
            {seriesData.length === 0 ? (
              <EmptyChart label="No revenue in this window yet" />
            ) : (
              <RevenueChart data={seriesData} currency={currency} />
            )}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-2xl font-medium tracking-tight text-stone-950">
            Units sold
          </h2>
          <div className="mt-4 rounded-3xl border border-stone-200 bg-white p-5">
            {seriesData.length === 0 ? (
              <EmptyChart label="No units sold in this window yet" />
            ) : (
              <UnitsChart data={seriesData} />
            )}
          </div>
        </section>

        {/* Top products */}
        <section className="mt-12">
          <h2 className="font-display text-2xl font-medium tracking-tight text-stone-950">
            Top products
          </h2>
          {top.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-500">
              No top sellers in this window.
            </p>
          ) : (
            <ol className="mt-6 divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white">
              {top.map((p, i) => (
                <li key={p.variantId} className="flex items-center gap-4 p-4">
                  <span className="w-6 text-right font-display text-sm font-medium text-stone-400">
                    {i + 1}
                  </span>
                  {p.image ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={p.image}
                      alt=""
                      className="h-14 w-14 rounded-xl border border-stone-100 object-cover"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-xl bg-stone-100" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium text-stone-900">{p.title}</p>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-stone-500">{p.sku}</p>
                  </div>
                  <div className="text-right tabular-nums">
                    <p className="text-sm font-bold text-stone-950">
                      {formatMoney(p.revenue, currency)}
                    </p>
                    <p className="text-xs text-stone-500">{p.units} units</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <p className="mt-10 text-xs text-stone-500">
          Numbers reflect items in PAID, CONFIRMED, SHIPPED, or DELIVERED status. CREATED items
          (still awaiting payment) are tallied separately as &ldquo;In flight&rdquo;. Refunded
          items are excluded from revenue and counted toward the returns rate.
        </p>
      </div>
    </SellerShell>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
        {label}
      </p>
      <p className="mt-3 font-display text-2xl font-medium tabular-nums tracking-tight text-stone-950">
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-stone-500">{sub}</p>}
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-72 flex-col items-center justify-center gap-3 text-stone-500">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-100">
        <TrendingUp size={18} strokeWidth={1.75} />
      </span>
      <p className="text-sm">{label}</p>
    </div>
  );
}
