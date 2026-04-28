import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardContent } from '@onsective/ui';
import { getSession } from '@/server/auth';
import { prisma } from '@/server/db';
import { Prisma } from '@onsective/db';
import { formatMoney } from '@/lib/utils';
import { RevenueChart, UnitsChart } from '@/components/seller/analytics-charts';
import { RangePicker } from '@/components/seller/range-picker';

export const metadata = { title: 'Analytics' };
export const dynamic = 'force-dynamic';

const VALID_RANGES = [7, 30, 90, 365] as const;
type Range = (typeof VALID_RANGES)[number];

function parseRange(raw: string | undefined): Range {
  const n = Number(raw ?? 30);
  return (VALID_RANGES as readonly number[]).includes(n) ? (n as Range) : 30;
}

export default async function SellerAnalyticsPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { days?: string };
}) {
  const session = await getSession();
  if (!session) redirect(`/${params.locale}/login`);
  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } });
  if (!seller) redirect(`/${params.locale}/seller`);

  const fromDays = parseRange(searchParams.days);
  const since = new Date(Date.now() - fromDays * 24 * 60 * 60 * 1000);

  // Run all aggregations in parallel — same shape as the tRPC procs but
  // server-rendered for the initial paint. The procs stay for client-driven
  // drill-downs / refresh later.
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
    sku: byId.get(g.variantId)?.sku ?? '',
    title: byId.get(g.variantId)?.product.title ?? '',
    slug: byId.get(g.variantId)?.product.slug ?? '',
    image: byId.get(g.variantId)?.product.images[0] ?? null,
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
    <div className="p-6 md:p-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-sm text-slate-500">Last {fromDays} days</p>
        </div>
        <RangePicker current={fromDays} />
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-slate-900">Revenue</h2>
        <Card className="mt-3">
          <CardContent className="p-4">
            {seriesData.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">
                No revenue in the selected window yet.
              </p>
            ) : (
              <RevenueChart data={seriesData} currency={currency} />
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-slate-900">Units sold</h2>
        <Card className="mt-3">
          <CardContent className="p-4">
            {seriesData.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">No data.</p>
            ) : (
              <UnitsChart data={seriesData} />
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-slate-900">Top products</h2>
        {top.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No top sellers in this window.</p>
        ) : (
          <ol className="mt-4 divide-y rounded-lg border border-slate-200 bg-white">
            {top.map((p, i) => (
              <li key={p.sku} className="flex items-center gap-4 p-3">
                <span className="w-6 text-right text-sm font-semibold text-slate-400">
                  {i + 1}.
                </span>
                {p.image ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={p.image}
                    alt=""
                    className="h-12 w-12 rounded-md border border-slate-100 object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-md bg-slate-100" />
                )}
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/${params.locale}/product/${p.slug}`}
                    className="block truncate text-sm font-medium text-slate-900 hover:underline"
                  >
                    {p.title}
                  </Link>
                  <p className="truncate font-mono text-xs text-slate-500">{p.sku}</p>
                </div>
                <div className="text-right text-sm tabular-nums">
                  <p className="font-semibold">{formatMoney(p.revenue, currency)}</p>
                  <p className="text-xs text-slate-500">{p.units} units</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
        {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
      </CardContent>
    </Card>
  );
}
