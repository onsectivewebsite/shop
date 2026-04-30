import { notFound, redirect } from 'next/navigation';
import Image from 'next/image';
import { Badge, Card, CardContent } from '@onsective/ui';
import { getSession } from '@/server/auth';
import { prisma } from '@/server/db';
import { formatMoney } from '@/lib/utils';
import { RequestReturnButton } from '@/components/account/request-return-button';

export const metadata = { title: 'Order details' };
export const dynamic = 'force-dynamic';

export default async function BuyerOrderDetailPage({
  params,
}: {
  params: { locale: string; orderNumber: string };
}) {
  const session = await getSession();
  if (!session) redirect(`/${params.locale}/login`);

  const order = await prisma.order.findFirst({
    where: { orderNumber: params.orderNumber, buyerId: session.user.id },
    include: {
      items: {
        include: {
          variant: { select: { product: { select: { slug: true, images: true } } } },
          returns: { select: { id: true, status: true, rmaNumber: true } },
        },
      },
      shippingAddress: true,
    },
  });
  if (!order) notFound();

  const eligibleStatuses = ['PAID', 'CONFIRMED', 'SHIPPED', 'DELIVERED'];

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <p className="font-mono text-xs text-slate-500">{order.orderNumber}</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Order details</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge>{order.status}</Badge>
            <p className="text-sm text-slate-600">
              Placed {(order.placedAt ?? order.createdAt).toLocaleString()}
            </p>
          </div>
        </header>

        <Card>
          <CardContent className="space-y-4 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Items
            </h2>
            <ul className="divide-y divide-slate-100">
              {order.items.map((item) => {
                const cover = item.variant.product.images[0];
                const hasOpenReturn = item.returns.some((r) =>
                  ['REQUESTED', 'APPROVED', 'RECEIVED'].includes(r.status),
                );
                const completedReturn = item.returns.find((r) => r.status === 'REFUNDED');
                const canRequest =
                  eligibleStatuses.includes(item.status) &&
                  !hasOpenReturn &&
                  !completedReturn;

                return (
                  <li key={item.id} className="flex flex-col gap-3 py-4 sm:flex-row">
                    {cover ? (
                      <div className="relative h-20 w-20 flex-none overflow-hidden rounded-md border border-slate-100">
                        <Image
                          src={cover}
                          alt=""
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="h-20 w-20 flex-none rounded-md bg-slate-100" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900">{item.productTitle}</p>
                      <p className="text-xs text-slate-500">
                        Qty {item.qty} · {formatMoney(item.unitPrice, order.currency)} each
                      </p>
                      <p className="mt-1 text-xs">
                        <Badge>{item.status}</Badge>
                      </p>
                      {hasOpenReturn && (
                        <p className="mt-2 text-xs text-cta-700">
                          Return in progress:{' '}
                          {item.returns
                            .filter((r) =>
                              ['REQUESTED', 'APPROVED', 'RECEIVED'].includes(r.status),
                            )
                            .map((r) => `${r.rmaNumber} (${r.status})`)
                            .join(', ')}
                        </p>
                      )}
                      {completedReturn && (
                        <p className="mt-2 text-xs text-success-700">
                          Refunded under {completedReturn.rmaNumber}
                        </p>
                      )}
                      {canRequest && (
                        <div className="mt-3">
                          <RequestReturnButton orderItemId={item.id} maxQty={item.qty} />
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-6 text-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Total
            </h2>
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="tabular-nums">
                {formatMoney(order.subtotalAmount, order.currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Shipping</span>
              <span className="tabular-nums">
                {formatMoney(order.shippingAmount, order.currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Tax</span>
              <span className="tabular-nums">
                {formatMoney(order.taxAmount, order.currency)}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold">
              <span>Total</span>
              <span className="tabular-nums">
                {formatMoney(order.totalAmount, order.currency)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
