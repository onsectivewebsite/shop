import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  Package,
  CreditCard,
  Truck,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react';
import { prisma } from '@/server/db';

export const metadata = { title: 'Order tracking' };
export const dynamic = 'force-dynamic';

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

const STATUS_LABEL: Record<string, string> = {
  CREATED: 'Order placed',
  PAYMENT_PENDING: 'Awaiting payment',
  PAID: 'Payment received',
  CONFIRMED: 'Confirmed by seller',
  PARTIALLY_SHIPPED: 'Partially shipped',
  SHIPPED: 'Shipped',
  PARTIALLY_DELIVERED: 'Partially delivered',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
  PARTIALLY_REFUNDED: 'Partially refunded',
  FAILED: 'Failed',
};

const STATUS_TONE: Record<string, 'amber' | 'sky' | 'emerald' | 'rose' | 'stone'> = {
  CREATED: 'stone',
  PAYMENT_PENDING: 'amber',
  PAID: 'sky',
  CONFIRMED: 'sky',
  PARTIALLY_SHIPPED: 'sky',
  SHIPPED: 'emerald',
  PARTIALLY_DELIVERED: 'emerald',
  DELIVERED: 'emerald',
  COMPLETED: 'emerald',
  CANCELLED: 'stone',
  REFUNDED: 'rose',
  PARTIALLY_REFUNDED: 'rose',
  FAILED: 'rose',
};

const TONE_CLASS: Record<string, string> = {
  stone: 'bg-stone-100 text-stone-700',
  amber: 'bg-amber-100 text-amber-900',
  sky: 'bg-sky-100 text-sky-900',
  emerald: 'bg-emerald-100 text-emerald-900',
  rose: 'bg-rose-100 text-rose-900',
};

export default async function TrackOrderPage({
  params,
  searchParams,
}: {
  params: { locale: string; orderNumber: string };
  searchParams: { email?: string };
}) {
  const email = searchParams.email?.toLowerCase().trim();
  if (!email) {
    redirect(`/${params.locale}/track`);
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber: params.orderNumber },
    include: {
      buyer: { select: { email: true } },
      shippingAddress: true,
      items: {
        include: {
          variant: { select: { title: true } },
        },
      },
      shipments: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
      events: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  // Defence-in-depth: don't leak existence. Email must match the buyer on file.
  if (!order || order.buyer.email.toLowerCase() !== email) {
    redirect(`/${params.locale}/track?error=not-found`);
  }

  const tone = STATUS_TONE[order.status] ?? 'stone';
  const toneCls = TONE_CLASS[tone];

  return (
    <div className="bg-stone-50">
      <section className="container-page py-12 md:py-16">
        <Link
          href={`/${params.locale}/track`}
          className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900"
        >
          <ArrowLeft size={14} /> Track another order
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-sm text-stone-500">{order.orderNumber}</p>
            <h1 className="mt-2 font-display text-4xl font-medium leading-tight tracking-tight text-stone-950 md:text-5xl">
              {STATUS_LABEL[order.status] ?? order.status}
            </h1>
            {order.placedAt && (
              <p className="mt-2 text-sm text-stone-500">
                Placed {order.placedAt.toUTCString()}
              </p>
            )}
          </div>
          <span
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold ${toneCls}`}
          >
            {STATUS_LABEL[order.status] ?? order.status}
          </span>
        </div>
      </section>

      <section className="container-page pb-16">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Timeline */}
          <div className="lg:col-span-2">
            <div className="rounded-3xl border border-stone-200 bg-white p-8">
              <h2 className="font-display text-2xl font-medium tracking-tight text-stone-950">
                Order timeline
              </h2>

              {order.events.length === 0 ? (
                <p className="mt-4 text-sm text-stone-500">
                  No timeline events yet. Once your seller confirms or ships, we&rsquo;ll
                  update you here.
                </p>
              ) : (
                <ol className="mt-6 space-y-5">
                  {order.events.map((evt, i) => {
                    const Icon = iconFor(evt.type);
                    const isLast = i === order.events.length - 1;
                    return (
                      <li key={evt.id} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <span
                            className={`flex h-9 w-9 items-center justify-center rounded-full ${
                              isLast
                                ? 'bg-stone-900 text-white'
                                : 'bg-stone-100 text-stone-600'
                            }`}
                          >
                            <Icon size={14} strokeWidth={2} />
                          </span>
                          {i < order.events.length - 1 && (
                            <span className="mt-1 h-full w-px flex-1 bg-stone-200" />
                          )}
                        </div>
                        <div className="flex-1 pb-1">
                          <p className="font-medium text-stone-900">
                            {humanType(evt.type)}
                          </p>
                          {evt.fromStatus && evt.toStatus && (
                            <p className="text-xs text-stone-500">
                              {STATUS_LABEL[evt.fromStatus] ?? evt.fromStatus} →{' '}
                              {STATUS_LABEL[evt.toStatus] ?? evt.toStatus}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-stone-500">
                            {evt.createdAt.toUTCString()}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            {/* Shipments */}
            {order.shipments.length > 0 && (
              <div className="mt-6 rounded-3xl border border-stone-200 bg-white p-8">
                <h2 className="font-display text-2xl font-medium tracking-tight text-stone-950">
                  Shipments
                </h2>
                <ul className="mt-6 space-y-5">
                  {order.shipments.map((s) => (
                    <li
                      key={s.id}
                      className="rounded-2xl border border-stone-200 p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-mono text-xs text-stone-500">
                            {s.shipmentNumber}
                          </p>
                          <p className="mt-1 font-medium text-stone-900">
                            {s.carrier ?? 'Carrier not assigned'}
                            {s.awbNumber && ` · ${s.awbNumber}`}
                          </p>
                        </div>
                        <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
                          {s.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      {s.expectedDeliveryAt && !s.deliveredAt && (
                        <p className="mt-2 text-xs text-stone-500">
                          Expected delivery {s.expectedDeliveryAt.toUTCString()}
                        </p>
                      )}
                      {s.deliveredAt && (
                        <p className="mt-2 text-xs text-emerald-700">
                          Delivered {s.deliveredAt.toUTCString()}
                        </p>
                      )}
                      {s.trackingUrl && (
                        <a
                          href={s.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-stone-300 px-4 py-1.5 text-xs font-semibold text-stone-700 hover:border-stone-500"
                        >
                          Open carrier tracking
                          <ExternalLink size={11} strokeWidth={2} />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Right column */}
          <aside className="space-y-6">
            <div className="rounded-3xl border border-stone-200 bg-white p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                Order summary
              </p>
              <dl className="mt-5 space-y-2 text-sm">
                <Row label="Subtotal" value={formatMoney(order.subtotalAmount, order.currency)} />
                <Row label="Shipping" value={formatMoney(order.shippingAmount, order.currency)} />
                <Row label="Tax" value={formatMoney(order.taxAmount, order.currency)} />
                {order.discountAmount > 0 && (
                  <Row
                    label="Discount"
                    value={`-${formatMoney(order.discountAmount, order.currency)}`}
                    muted
                  />
                )}
                <hr className="border-stone-200" />
                <Row
                  label="Total"
                  value={formatMoney(order.totalAmount, order.currency)}
                  strong
                />
              </dl>
            </div>

            <div className="rounded-3xl border border-stone-200 bg-white p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                Ship to
              </p>
              <div className="mt-4 space-y-1 text-sm text-stone-700">
                <p className="font-medium text-stone-900">{order.shippingAddress.recipient}</p>
                <p>{order.shippingAddress.line1}</p>
                {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                <p>
                  {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
                  {order.shippingAddress.postalCode}
                </p>
                <p className="text-xs uppercase tracking-wider text-stone-500">
                  {order.shippingAddress.countryCode}
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-stone-200 bg-white p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                Items ({order.items.length})
              </p>
              <ul className="mt-4 space-y-3 text-sm">
                {order.items.map((it) => (
                  <li key={it.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 font-medium text-stone-900">
                        {it.productTitle}
                      </p>
                      {it.variantTitle && (
                        <p className="text-xs text-stone-500">{it.variantTitle}</p>
                      )}
                      <p className="mt-0.5 text-xs text-stone-500">
                        Qty {it.qty} · {it.status.replace(/_/g, ' ').toLowerCase()}
                      </p>
                    </div>
                    <p className="text-sm font-medium tabular-nums text-stone-900">
                      {formatMoney(it.lineSubtotal, order.currency)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-stone-600">{label}</dt>
      <dd
        className={`tabular-nums ${
          strong
            ? 'text-base font-bold text-stone-950'
            : muted
              ? 'text-stone-500'
              : 'text-stone-900'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function iconFor(type: string) {
  if (type.includes('paid')) return CreditCard;
  if (type.includes('shipped')) return Truck;
  if (type.includes('delivered')) return CheckCircle2;
  if (type.includes('cancel') || type.includes('failed') || type.includes('reject')) return XCircle;
  if (type.includes('placed')) return Package;
  return Clock;
}

function humanType(type: string): string {
  return type
    .replace(/[._-]/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
}
