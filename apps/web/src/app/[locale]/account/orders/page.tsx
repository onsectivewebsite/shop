import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge, Card, CardContent } from '@onsective/ui';
import { getSession } from '@/server/auth';
import { prisma } from '@/server/db';
import { formatMoney } from '@/lib/utils';

export const metadata = { title: 'Your orders' };
export const dynamic = 'force-dynamic';

export default async function BuyerOrdersPage({ params }: { params: { locale: string } }) {
  const session = await getSession();
  if (!session) redirect(`/${params.locale}/login`);

  const orders = await prisma.order.findMany({
    where: { buyerId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      currency: true,
      totalAmount: true,
      createdAt: true,
      items: { select: { productTitle: true, qty: true } },
    },
  });

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Your orders</h1>
        {orders.length === 0 ? (
          <Card className="mt-6">
            <CardContent className="p-12 text-center text-sm text-slate-500">
              You haven&apos;t placed an order yet.
            </CardContent>
          </Card>
        ) : (
          <ul className="mt-6 space-y-3">
            {orders.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/${params.locale}/account/orders/${o.orderNumber}`}
                  className="block rounded-lg border border-slate-200 bg-white p-5 hover:border-brand-400"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-slate-500">{o.orderNumber}</p>
                      <p className="truncate text-sm font-medium">
                        {o.items.map((i) => `${i.productTitle} × ${i.qty}`).join(', ')}
                      </p>
                      <p className="text-xs text-slate-500">
                        {o.createdAt.toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge>{o.status}</Badge>
                      <p className="mt-1 text-sm font-semibold tabular-nums">
                        {formatMoney(o.totalAmount, o.currency)}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
