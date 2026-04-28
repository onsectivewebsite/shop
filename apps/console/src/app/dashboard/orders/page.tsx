import Link from 'next/link';
import { prisma } from '@onsective/db';
import { Card, CardContent, Badge } from '@onsective/ui';

function formatMoney(amount: number, currency: string) {
  const major = currency === 'JPY' ? amount : amount / 100;
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(major);
}

export const metadata = { title: 'Orders · Console' };

export default async function ConsoleOrders({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = searchParams.q ?? '';
  const orders = await prisma.order.findMany({
    where: q ? { orderNumber: { contains: q, mode: 'insensitive' } } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { buyer: { select: { email: true } } },
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
      <form className="mt-4 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by order number…"
          className="h-10 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm"
        />
        <button className="h-10 rounded-md bg-brand-600 px-4 text-sm font-medium text-white">
          Search
        </button>
      </form>

      {orders.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-12 text-center text-sm text-slate-500">
            No orders.
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Buyer</th>
                <th className="px-4 py-3 tabular-nums">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3 font-mono text-xs">{o.orderNumber}</td>
                  <td className="px-4 py-3 text-slate-600">{o.buyer.email}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatMoney(o.totalAmount, o.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge>{o.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/dashboard/orders/${o.id}`} className="text-brand-600 hover:underline">
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
