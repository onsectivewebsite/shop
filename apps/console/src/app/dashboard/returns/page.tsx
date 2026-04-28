import Link from 'next/link';
import { prisma } from '@onsective/db';
import { Badge, Card, CardContent } from '@onsective/ui';

export const metadata = { title: 'Returns · Console' };

const STATUS_LABELS: Record<string, { variant: 'warning' | 'success' | 'error' | 'default' }> = {
  REQUESTED: { variant: 'warning' },
  APPROVED: { variant: 'default' },
  REJECTED: { variant: 'error' },
  RECEIVED: { variant: 'default' },
  REFUNDED: { variant: 'success' },
  CANCELLED: { variant: 'default' },
};

export default async function ConsoleReturnsPage() {
  const open = await prisma.return.findMany({
    where: { status: { in: ['REQUESTED', 'APPROVED', 'RECEIVED'] } },
    orderBy: { createdAt: 'asc' },
    include: {
      buyer: { select: { email: true, fullName: true } },
      seller: { select: { displayName: true } },
      orderItem: {
        select: {
          productTitle: true,
          qty: true,
          unitPrice: true,
          order: { select: { orderNumber: true } },
        },
      },
    },
    take: 100,
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Returns — Open ({open.length})</h1>

      {open.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-12 text-center text-sm text-slate-500">
            No open returns. ✅
          </CardContent>
        </Card>
      ) : (
        <ul className="mt-6 space-y-3">
          {open.map((r) => (
            <li key={r.id}>
              <Link
                href={`/dashboard/returns/${r.id}`}
                className="block rounded-lg border border-slate-200 bg-white p-5 hover:border-brand-400"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-slate-500">{r.rmaNumber}</p>
                    <p className="truncate text-sm font-semibold">{r.orderItem.productTitle}</p>
                    <p className="text-xs text-slate-600">
                      Order {r.orderItem.order.orderNumber} · qty {r.qty}/{r.orderItem.qty}
                      {' · '}
                      Reason: {r.reason}
                    </p>
                    <p className="text-xs text-slate-500">
                      Buyer {r.buyer.email} · Seller {r.seller.displayName}
                    </p>
                  </div>
                  <Badge variant={STATUS_LABELS[r.status]?.variant ?? 'default'}>
                    {r.status}
                  </Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
