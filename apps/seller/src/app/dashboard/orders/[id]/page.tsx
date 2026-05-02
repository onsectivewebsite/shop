import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MapPin, Package, Truck, CheckCircle2 } from 'lucide-react';
import { getSellerSession } from '@/server/auth';
import { prisma } from '@/server/db';
import { SellerShell } from '@/components/seller-shell';
import { formatMoney } from '@/lib/format';
import { ShipButton } from './ship-button';

export const metadata = { title: 'Order' };

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const session = await getSellerSession();
  if (!session) redirect('/login');
  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } });
  if (!seller) redirect('/apply');

  const item = await prisma.orderItem.findFirst({
    where: { id: params.id, sellerId: seller.id },
    include: {
      order: {
        select: {
          orderNumber: true,
          currency: true,
          placedAt: true,
          buyerNote: true,
          buyer: { select: { fullName: true, email: true } },
          shippingAddress: true,
        },
      },
      shipment: true,
      variant: { select: { weightGrams: true, lengthMm: true, widthMm: true, heightMm: true } },
    },
  });
  if (!item) notFound();

  const ship = item.shipment;
  const canShip = ['PAID', 'CONFIRMED'].includes(item.status);
  const isShipped = ['SHIPPED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'COMPLETED'].includes(item.status);
  const isCancelled = ['CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'FAILED'].includes(item.status);

  return (
    <SellerShell email={session.user.email} name={session.user.fullName ?? undefined}>
      <div className="container-page py-10 md:py-14">
        <Link
          href="/dashboard/orders"
          className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900"
        >
          <ArrowLeft size={14} /> Back to orders
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500">
              Order {item.order.orderNumber}
            </p>
            <h1 className="mt-3 font-display text-3xl font-medium tracking-tight text-stone-950 md:text-4xl">
              {item.productTitle}
            </h1>
            {item.variantTitle && (
              <p className="mt-1 text-sm text-stone-600">{item.variantTitle}</p>
            )}
          </div>
          <StatusChip status={item.status} />
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {/* Money breakdown */}
          <div className="rounded-3xl border border-stone-200 bg-white p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
              Money
            </p>
            <dl className="mt-5 space-y-2 text-sm">
              <Row label="Item subtotal" value={formatMoney(item.lineSubtotal, item.order.currency)} />
              <Row label="Shipping (charged)" value={formatMoney(item.shippingAmount, item.order.currency)} />
              <Row label="Tax" value={formatMoney(item.taxAmount, item.order.currency)} />
              <hr className="border-stone-200" />
              <Row
                label={`Onsective commission (${item.commissionPct.toFixed(1)}%)`}
                value={`-${formatMoney(item.commissionAmount, item.order.currency)}`}
                muted
              />
              <hr className="border-stone-200" />
              <Row
                label="Net to you"
                value={formatMoney(item.sellerNetAmount, item.order.currency)}
                strong
              />
            </dl>
          </div>

          {/* Shipping address */}
          <div className="rounded-3xl border border-stone-200 bg-white p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
              Ship to
            </p>
            <div className="mt-5 space-y-1 text-sm text-stone-700">
              <p className="font-medium text-stone-900">{item.order.shippingAddress.recipient}</p>
              <p>{item.order.shippingAddress.line1}</p>
              {item.order.shippingAddress.line2 && <p>{item.order.shippingAddress.line2}</p>}
              <p>
                {item.order.shippingAddress.city}, {item.order.shippingAddress.state}{' '}
                {item.order.shippingAddress.postalCode}
              </p>
              <p className="text-xs uppercase tracking-wider text-stone-500">
                {item.order.shippingAddress.countryCode}
              </p>
            </div>
            <p className="mt-4 inline-flex items-center gap-1 text-xs text-stone-500">
              <MapPin size={11} /> Snapshot at order time
            </p>
          </div>

          {/* Buyer note (gift message / delivery instructions) */}
          {item.order.buyerNote && (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-900">
                Note from buyer
              </p>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-stone-800">
                {item.order.buyerNote}
              </p>
            </div>
          )}

          {/* Pack details */}
          <div className="rounded-3xl border border-stone-200 bg-white p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
              Pack
            </p>
            <dl className="mt-5 space-y-2 text-sm">
              <Row label="SKU" value={item.sku} mono />
              <Row label="Quantity" value={String(item.qty)} />
              <Row label="Weight" value={`${item.variant.weightGrams}g`} />
              <Row
                label="Dimensions"
                value={`${item.variant.lengthMm} × ${item.variant.widthMm} × ${item.variant.heightMm} mm`}
              />
            </dl>
          </div>
        </div>

        {/* Action area */}
        <div className="mt-10 rounded-3xl border border-stone-200 bg-white p-8">
          {isCancelled ? (
            <p className="text-sm text-stone-600">
              This order item is in <strong>{item.status.replace(/_/g, ' ').toLowerCase()}</strong>{' '}
              state. No further action available.
            </p>
          ) : isShipped ? (
            <ShippedSummary shipment={ship} currency={item.order.currency} />
          ) : canShip ? (
            <div>
              <p className="font-display text-2xl font-medium text-stone-950">Ready to ship?</p>
              <p className="mt-2 max-w-xl text-sm text-stone-600">
                Pack the item, generate a label or use your own carrier, then mark this order as
                shipped. Onsective queues your payout 7 days after shipment (return-window guard).
              </p>
              <div className="mt-6">
                <ShipButton itemId={item.id} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-stone-600">
              Waiting on payment confirmation. We&rsquo;ll mark this <strong>PAID</strong> as soon as
              Stripe captures it.
            </p>
          )}
        </div>
      </div>
    </SellerShell>
  );
}

function Row({
  label,
  value,
  muted,
  strong,
  mono,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={`text-stone-600 ${muted ? 'text-xs' : ''}`}>{label}</dt>
      <dd
        className={`tabular-nums ${strong ? 'text-base font-bold text-stone-950' : muted ? 'text-xs text-stone-500' : 'text-stone-900'} ${mono ? 'font-mono text-xs' : ''}`}
      >
        {value}
      </dd>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const variants: Record<string, { bg: string; fg: string; icon: typeof Package }> = {
    CREATED: { bg: 'bg-stone-100', fg: 'text-stone-700', icon: Package },
    PAYMENT_PENDING: { bg: 'bg-amber-100', fg: 'text-amber-900', icon: Package },
    PAID: { bg: 'bg-sky-100', fg: 'text-sky-900', icon: Package },
    CONFIRMED: { bg: 'bg-sky-100', fg: 'text-sky-900', icon: Package },
    SHIPPED: { bg: 'bg-emerald-100', fg: 'text-emerald-900', icon: Truck },
    DELIVERED: { bg: 'bg-emerald-100', fg: 'text-emerald-900', icon: CheckCircle2 },
    COMPLETED: { bg: 'bg-emerald-100', fg: 'text-emerald-900', icon: CheckCircle2 },
  };
  const v = variants[status] ?? variants.CREATED!;
  const Icon = v.icon;
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold ${v.bg} ${v.fg}`}>
      <Icon size={12} strokeWidth={2} />
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function ShippedSummary({
  shipment,
  currency,
}: {
  shipment: {
    shipmentNumber: string;
    carrier: string | null;
    awbNumber: string | null;
    trackingUrl: string | null;
    pickedUpAt: Date | null;
    deliveredAt: Date | null;
  } | null;
  currency: string;
}) {
  if (!shipment) {
    return (
      <p className="text-sm text-stone-600">
        Marked shipped, but no shipment record found. This is unusual — open a support ticket if
        the buyer reports issues.
      </p>
    );
  }
  return (
    <div>
      <p className="font-display text-2xl font-medium text-stone-950">Shipment created</p>
      <dl className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
        <Row label="Shipment number" value={shipment.shipmentNumber} mono />
        <Row label="Carrier" value={shipment.carrier ?? 'Not yet assigned'} />
        <Row label="AWB" value={shipment.awbNumber ?? '—'} mono />
        <Row label="Tracking" value={shipment.trackingUrl ? 'Available' : 'Pending'} />
      </dl>
      {shipment.trackingUrl && (
        <a
          href={shipment.trackingUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-full border border-stone-300 px-5 text-sm font-semibold text-stone-900 hover:border-stone-500"
        >
          Open tracking →
        </a>
      )}
      <p className="mt-4 text-xs text-stone-500">
        Currency: {currency}. Payout fires 7 days after shipment (return-window).
      </p>
    </div>
  );
}
