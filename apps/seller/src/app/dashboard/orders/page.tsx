import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Receipt } from 'lucide-react';
import { getSellerSession } from '@/server/auth';
import { prisma } from '@/server/db';
import { SellerShell } from '@/components/seller-shell';
import { formatMoney } from '@/lib/format';

export const metadata = { title: 'Orders' };

const STATUS_BADGE: Record<string, { bg: string; fg: string }> = {
  CREATED: { bg: 'bg-stone-100', fg: 'text-stone-700' },
  PAYMENT_PENDING: { bg: 'bg-amber-100', fg: 'text-amber-900' },
  PAID: { bg: 'bg-sky-100', fg: 'text-sky-900' },
  CONFIRMED: { bg: 'bg-sky-100', fg: 'text-sky-900' },
  PARTIALLY_SHIPPED: { bg: 'bg-violet-100', fg: 'text-violet-900' },
  SHIPPED: { bg: 'bg-emerald-100', fg: 'text-emerald-900' },
  PARTIALLY_DELIVERED: { bg: 'bg-emerald-100', fg: 'text-emerald-900' },
  DELIVERED: { bg: 'bg-emerald-100', fg: 'text-emerald-900' },
  COMPLETED: { bg: 'bg-emerald-100', fg: 'text-emerald-900' },
  CANCELLED: { bg: 'bg-stone-200', fg: 'text-stone-700' },
  REFUNDED: { bg: 'bg-rose-100', fg: 'text-rose-900' },
  PARTIALLY_REFUNDED: { bg: 'bg-rose-100', fg: 'text-rose-900' },
  FAILED: { bg: 'bg-red-100', fg: 'text-red-900' },
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: { page?: string; filter?: string };
}) {
  const session = await getSellerSession();
  if (!session) redirect('/login');
  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } });
  if (!seller) redirect('/apply');

  const page = Math.max(1, Number(searchParams.page) || 1);
  const perPage = 20;
  const filter = searchParams.filter ?? 'open';

  const baseWhere = { sellerId: seller.id };
  const filterClause =
    filter === 'open'
      ? { status: { in: ['CREATED', 'PAID', 'CONFIRMED', 'PARTIALLY_SHIPPED'] as const } }
      : filter === 'shipped'
      ? { status: { in: ['SHIPPED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'COMPLETED'] as const } }
      : filter === 'cancelled'
      ? { status: { in: ['CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'FAILED'] as const } }
      : {};
  const where = { ...baseWhere, ...filterClause };

  const [items, total, openCount, shippedCount, cancelledCount] = await Promise.all([
    prisma.orderItem.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { order: { select: { orderNumber: true, currency: true, placedAt: true } } },
    }),
    prisma.orderItem.count({ where }),
    prisma.orderItem.count({
      where: { ...baseWhere, status: { in: ['CREATED', 'PAID', 'CONFIRMED', 'PARTIALLY_SHIPPED'] } },
    }),
    prisma.orderItem.count({
      where: { ...baseWhere, status: { in: ['SHIPPED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'COMPLETED'] } },
    }),
    prisma.orderItem.count({
      where: { ...baseWhere, status: { in: ['CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'FAILED'] } },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <SellerShell email={session.user.email} name={session.user.fullName ?? undefined}>
      <div className="container-page py-10 md:py-14">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900"
        >
          <ArrowLeft size={14} /> Back to dashboard
        </Link>

        <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-stone-950 md:text-5xl">
          Orders
        </h1>

        {/* Filter pills */}
        <div className="mt-8 flex flex-wrap gap-2">
          <FilterPill href="/dashboard/orders?filter=open" label="To ship" count={openCount} active={filter === 'open'} />
          <FilterPill href="/dashboard/orders?filter=shipped" label="Shipped" count={shippedCount} active={filter === 'shipped'} />
          <FilterPill href="/dashboard/orders?filter=cancelled" label="Cancelled / refunded" count={cancelledCount} active={filter === 'cancelled'} />
          <FilterPill href="/dashboard/orders?filter=all" label="All" count={openCount + shippedCount + cancelledCount} active={filter === 'all'} />
        </div>

        {items.length === 0 ? (
          <div className="mt-12 flex flex-col items-center justify-center rounded-3xl border border-dashed border-stone-300 bg-white px-8 py-20 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-stone-100 text-stone-700">
              <Receipt size={22} strokeWidth={1.75} />
            </span>
            <h2 className="mt-6 font-display text-2xl font-medium text-stone-950">
              {filter === 'open' ? 'Nothing to ship' : 'No orders'}
            </h2>
            <p className="mt-2 max-w-md text-sm text-stone-600">
              {filter === 'open'
                ? "When buyers purchase your products, the orders that need shipping will appear here."
                : 'No orders match this filter.'}
            </p>
          </div>
        ) : (
          <>
            <div className="mt-10 overflow-hidden rounded-2xl border border-stone-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 text-left text-xs uppercase tracking-[0.12em] text-stone-500">
                  <tr>
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3 tabular-nums">Qty</th>
                    <th className="px-4 py-3 tabular-nums">Net to you</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {items.map((it) => {
                    const badge = STATUS_BADGE[it.status] ?? STATUS_BADGE.CREATED;
                    return (
                      <tr key={it.id} className="hover:bg-stone-50">
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs text-stone-700">{it.order.orderNumber}</p>
                          {it.order.placedAt && (
                            <p className="text-[11px] text-stone-500">
                              {it.order.placedAt.toLocaleDateString()}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="line-clamp-1 font-medium text-stone-900">{it.productTitle}</p>
                          {it.variantTitle && (
                            <p className="text-xs text-stone-500">{it.variantTitle}</p>
                          )}
                          <p className="mt-0.5 text-[11px] font-mono text-stone-400">{it.sku}</p>
                        </td>
                        <td className="px-4 py-3 tabular-nums">{it.qty}</td>
                        <td className="px-4 py-3 tabular-nums font-medium">
                          {formatMoney(it.sellerNetAmount, it.order.currency)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge?.bg} ${badge?.fg}`}>
                            {it.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/dashboard/orders/${it.id}`}
                            className="text-sm font-medium text-stone-700 hover:text-stone-950"
                          >
                            Open →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <nav className="mt-12 flex items-center justify-center gap-3 text-sm">
                {page > 1 && (
                  <Link
                    href={`/dashboard/orders?filter=${filter}&page=${page - 1}`}
                    className="rounded-full border border-stone-300 px-4 py-2 hover:border-stone-500"
                  >
                    ← Prev
                  </Link>
                )}
                <span className="text-stone-500">
                  Page {page} of {totalPages}
                </span>
                {page < totalPages && (
                  <Link
                    href={`/dashboard/orders?filter=${filter}&page=${page + 1}`}
                    className="rounded-full border border-stone-300 px-4 py-2 hover:border-stone-500"
                  >
                    Next →
                  </Link>
                )}
              </nav>
            )}
          </>
        )}
      </div>
    </SellerShell>
  );
}

function FilterPill({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
        active
          ? 'bg-stone-900 text-white'
          : 'border border-stone-300 bg-white text-stone-700 hover:border-stone-500'
      }`}
    >
      {label}
      <span
        className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
          active ? 'bg-white/15' : 'bg-stone-100 text-stone-600'
        }`}
      >
        {count}
      </span>
    </Link>
  );
}
