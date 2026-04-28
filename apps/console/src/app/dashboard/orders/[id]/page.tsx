import { notFound } from 'next/navigation';
import { prisma } from '@onsective/db';
import { Card, CardContent, Badge, Button } from '@onsective/ui';
import { refundOrderAction, cancelOrderAction } from './actions';

function formatMoney(amount: number, currency: string) {
  const major = currency === 'JPY' ? amount : amount / 100;
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(major);
}

export default async function OrderDetail({ params }: { params: { id: string } }) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      buyer: { select: { id: true, email: true, fullName: true } },
      items: {
        include: { variant: { include: { product: { select: { title: true } } } }, seller: true },
      },
      shipments: { include: { trackingEvents: { orderBy: { occurredAt: 'desc' } } } },
      payments: true,
      shippingAddress: true,
      events: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
  });
  if (!order) notFound();

  const REFUND_DIRECT_LIMIT = 50_000;

  return (
    <div className="grid grid-cols-[1fr_320px]">
      <div className="p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-mono text-lg text-slate-500">{order.orderNumber}</h1>
            <p className="mt-1 text-sm text-slate-600">{order.buyer.email}</p>
          </div>
          <Badge>{order.status}</Badge>
        </div>

        <Card className="mt-8">
          <CardContent className="p-6">
            <h2 className="font-semibold">Items</h2>
            <ul className="mt-4 divide-y divide-slate-100">
              {order.items.map((it) => (
                <li key={it.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium">{it.productTitle}</p>
                    <p className="text-xs text-slate-500">
                      Seller: {it.seller.displayName} · qty {it.qty}
                    </p>
                  </div>
                  <span className="font-medium tabular-nums">
                    {formatMoney(it.lineSubtotal, order.currency)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 grid grid-cols-2 gap-y-1 text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="text-right tabular-nums">
                {formatMoney(order.subtotalAmount, order.currency)}
              </span>
              <span className="text-slate-500">Shipping</span>
              <span className="text-right tabular-nums">
                {formatMoney(order.shippingAmount, order.currency)}
              </span>
              <span className="text-slate-500">Tax</span>
              <span className="text-right tabular-nums">
                {formatMoney(order.taxAmount, order.currency)}
              </span>
              <span className="font-semibold">Total</span>
              <span className="text-right font-semibold tabular-nums">
                {formatMoney(order.totalAmount, order.currency)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardContent className="p-6">
            <h2 className="font-semibold">Shipping</h2>
            {order.shippingAddress && (
              <p className="mt-2 text-sm text-slate-700">
                {order.shippingAddress.recipient}, {order.shippingAddress.line1},{' '}
                {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
                {order.shippingAddress.postalCode}
              </p>
            )}
            {order.shipments.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No shipments yet.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {order.shipments.map((s) => (
                  <li key={s.id} className="flex justify-between rounded-md border border-slate-200 p-3">
                    <span>
                      {s.carrier ?? '—'} · {s.awbNumber ?? 'no AWB'}
                    </span>
                    <Badge>{s.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardContent className="p-6">
            <h2 className="font-semibold">Activity</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {order.events.map((e) => (
                <li key={e.id} className="flex justify-between">
                  <span>{e.type}</span>
                  <span className="text-slate-500">
                    {new Date(e.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Actions panel */}
      <aside className="border-l border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase text-slate-500">Actions</h2>
        <div className="mt-4 space-y-3">
          {order.shipments.length === 0 && order.status !== 'CANCELLED' && (
            <form action={cancelOrderAction.bind(null, order.id, 'console cancel pre-ship')}>
              <Button variant="outline" type="submit" size="sm" className="w-full">
                Cancel order
              </Button>
            </form>
          )}
          {order.status !== 'REFUNDED' && (
            <form action={refundOrderAction.bind(null, order.id, 'console refund')}>
              <Button variant="destructive" type="submit" size="sm" className="w-full">
                Issue refund {formatMoney(order.totalAmount, order.currency)}
              </Button>
              {order.totalAmount > REFUND_DIRECT_LIMIT && (
                <p className="mt-1 text-center text-xs text-warning-500">
                  ⚠ Requires 4-eyes approval (above limit)
                </p>
              )}
            </form>
          )}
          <p className="pt-4 text-xs text-slate-500">
            Re-deliver, weight override, and dispute response actions land in Phase 3.
          </p>
        </div>
      </aside>
    </div>
  );
}
