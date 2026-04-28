import { redirect } from 'next/navigation';
import { Badge, Card, CardContent } from '@onsective/ui';
import { getSession } from '@/server/auth';
import { prisma } from '@/server/db';
import { formatMoney } from '@/lib/utils';

export const metadata = { title: 'Orders' };

export default async function SellerOrders() {
  const session = await getSession();
  if (!session) redirect('/login');

  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } });
  if (!seller) redirect('/seller');

  const items = await prisma.orderItem.findMany({
    where: { sellerId: seller.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { order: { select: { orderNumber: true, currency: true } } },
  });

  return (
    <div className="p-6 md:p-10">
      <h1 className="text-2xl font-bold text-slate-900">Orders ({items.length})</h1>

      {items.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-12 text-center">
            <p className="text-slate-600">No orders yet — once buyers purchase, they show up here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3 tabular-nums">Qty</th>
                <th className="px-4 py-3 tabular-nums">Total</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((it) => (
                <tr key={it.id}>
                  <td className="px-4 py-3 font-medium">{it.order.orderNumber}</td>
                  <td className="px-4 py-3">{it.productTitle}</td>
                  <td className="px-4 py-3 tabular-nums">{it.qty}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatMoney(it.lineSubtotal, it.order.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge>{it.status}</Badge>
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
