import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertCircle, Wallet, Clock, CheckCircle2, XCircle, Truck } from 'lucide-react';
import { getSellerSession } from '@/server/auth';
import { prisma } from '@/server/db';
import { SellerShell } from '@/components/seller-shell';
import { formatMoney } from '@/lib/format';

export const metadata = { title: 'Payouts' };

const RETURN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export default async function PayoutsPage() {
  const session = await getSellerSession();
  if (!session) redirect('/login');
  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } });
  if (!seller) redirect('/apply');

  const sevenDaysAgo = new Date(Date.now() - RETURN_WINDOW_MS);

  // Read every SELLER_PAYABLE entry once and bucket in JS — keeps it boring +
  // currency-aware. Real volume requires Postgres aggregates, but this is
  // fine for v1 (a single seller has thousands of entries at most).
  const entries = await prisma.ledgerEntry.findMany({
    where: { sellerId: seller.id, account: 'SELLER_PAYABLE' },
    select: {
      direction: true,
      amount: true,
      currency: true,
      payoutId: true,
      createdAt: true,
    },
  });

  type Bucket = { available: number; pending: number; inTransit: number };
  const byCcy = new Map<string, Bucket>();
  function bucketFor(ccy: string): Bucket {
    let b = byCcy.get(ccy);
    if (!b) {
      b = { available: 0, pending: 0, inTransit: 0 };
      byCcy.set(ccy, b);
    }
    return b;
  }

  for (const e of entries) {
    const sign = e.direction === 'CREDIT' ? 1 : -1;
    const b = bucketFor(e.currency);
    if (!e.payoutId) {
      // Unpaid: split by age. Items shipped > 7 days ago are payable now.
      if (e.createdAt < sevenDaysAgo) b.available += sign * e.amount;
      else b.pending += sign * e.amount;
    }
  }

  // Add in-transit Payouts so the seller sees transfers en route to bank.
  const inTransitPayouts = await prisma.payout.findMany({
    where: { sellerId: seller.id, status: 'IN_TRANSIT' },
    select: { amount: true, currency: true },
  });
  for (const p of inTransitPayouts) {
    bucketFor(p.currency).inTransit += p.amount;
  }

  const payouts = await prisma.payout.findMany({
    where: { sellerId: seller.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const currencies = Array.from(byCcy.keys()).sort();
  const primaryCcy = currencies[0] ?? 'USD';
  const primary = byCcy.get(primaryCcy) ?? { available: 0, pending: 0, inTransit: 0 };

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
          Payouts
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-stone-600">
          Buyers pay Onsective. We hold for the 7-day return window, then transfer your earnings
          (net of commission) to your bank weekly via Stripe.
        </p>

        {/* Stripe Connect blocker */}
        {!seller.stripePayoutsEnabled && (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-amber-200 bg-amber-50 p-6">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} strokeWidth={1.75} className="mt-0.5 text-amber-700" />
              <div>
                <p className="font-semibold text-amber-900">Stripe Connect required</p>
                <p className="mt-1 text-sm text-amber-800">
                  Your earnings accrue here, but transfers can&rsquo;t fire until Stripe Express
                  is connected.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/connect"
              className="inline-flex h-10 items-center rounded-full bg-amber-900 px-5 text-sm font-semibold text-amber-50 hover:bg-amber-950"
            >
              Connect Stripe
            </Link>
          </div>
        )}

        {/* Summary cards */}
        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          <SummaryCard
            icon={Wallet}
            iconClass="bg-emerald-50 text-emerald-700"
            label="Available now"
            value={formatMoney(primary.available, primaryCcy)}
            sub="Past 7-day return window — eligible for next transfer"
          />
          <SummaryCard
            icon={Clock}
            iconClass="bg-amber-50 text-amber-700"
            label="Pending (T+7)"
            value={formatMoney(primary.pending, primaryCcy)}
            sub="Within return window — releases as it ages"
          />
          <SummaryCard
            icon={Truck}
            iconClass="bg-sky-50 text-sky-700"
            label="In transit"
            value={formatMoney(primary.inTransit, primaryCcy)}
            sub="Stripe transfer en route to your bank"
          />
        </div>

        {/* Multi-currency breakdown */}
        {currencies.length > 1 && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-stone-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs uppercase tracking-[0.12em] text-stone-500">
                <tr>
                  <th className="px-4 py-3">Currency</th>
                  <th className="px-4 py-3 tabular-nums">Available</th>
                  <th className="px-4 py-3 tabular-nums">Pending</th>
                  <th className="px-4 py-3 tabular-nums">In transit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {currencies.map((ccy) => {
                  const b = byCcy.get(ccy)!;
                  return (
                    <tr key={ccy}>
                      <td className="px-4 py-3 font-mono text-xs">{ccy}</td>
                      <td className="px-4 py-3 tabular-nums">{formatMoney(b.available, ccy)}</td>
                      <td className="px-4 py-3 tabular-nums">{formatMoney(b.pending, ccy)}</td>
                      <td className="px-4 py-3 tabular-nums">{formatMoney(b.inTransit, ccy)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <h2 className="mt-14 font-display text-2xl font-medium tracking-tight text-stone-950">
          Payout history
        </h2>
        {payouts.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-stone-300 bg-white p-12 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-700">
              <Wallet size={20} strokeWidth={1.75} />
            </span>
            <h3 className="mt-5 font-display text-xl font-medium text-stone-950">
              No payouts yet
            </h3>
            <p className="mt-2 mx-auto max-w-md text-sm text-stone-600">
              Your first payout fires 7 days after your first paid order, once Stripe Express is
              connected.
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl border border-stone-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs uppercase tracking-[0.12em] text-stone-500">
                <tr>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3 tabular-nums">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Scheduled / paid</th>
                  <th className="px-4 py-3">Stripe ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {payouts.map((p) => (
                  <tr key={p.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3 text-xs text-stone-700">
                      {p.periodStart.toLocaleDateString()} →{' '}
                      {p.periodEnd.toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 tabular-nums font-medium">
                      {formatMoney(p.amount, p.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <PayoutStatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-stone-600">
                      {p.paidAt
                        ? `Paid ${p.paidAt.toLocaleDateString()}`
                        : `Scheduled ${p.scheduledFor.toLocaleDateString()}`}
                      {p.failureReason && (
                        <p className="mt-1 text-[11px] text-rose-700">{p.failureReason}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-stone-500">
                      {p.gatewayRef ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-6 text-xs text-stone-500">
          Onsective takes a category-tiered 8 — 15% commission, deducted at order placement and
          frozen at that rate. The balance shown above is what you keep — net of commission and
          gateway fees, in the currency the buyer paid.
        </p>
      </div>
    </SellerShell>
  );
}

function SummaryCard({
  icon: Icon,
  iconClass,
  label,
  value,
  sub,
}: {
  icon: typeof Wallet;
  iconClass: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-3xl bg-white p-6">
      <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${iconClass}`}>
        <Icon size={18} strokeWidth={1.75} />
      </span>
      <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
        {label}
      </p>
      <p className="mt-2 font-display text-3xl font-medium tabular-nums tracking-tight text-stone-950">
        {value}
      </p>
      <p className="mt-2 text-xs text-stone-500">{sub}</p>
    </div>
  );
}

function PayoutStatusBadge({ status }: { status: string }) {
  const v: Record<string, { bg: string; fg: string; icon: typeof Clock; label: string }> = {
    PENDING: { bg: 'bg-stone-100', fg: 'text-stone-700', icon: Clock, label: 'Scheduled' },
    IN_TRANSIT: { bg: 'bg-sky-100', fg: 'text-sky-900', icon: Truck, label: 'In transit' },
    PAID: { bg: 'bg-emerald-100', fg: 'text-emerald-900', icon: CheckCircle2, label: 'Paid' },
    FAILED: { bg: 'bg-rose-100', fg: 'text-rose-900', icon: XCircle, label: 'Failed' },
    CANCELLED: { bg: 'bg-stone-200', fg: 'text-stone-700', icon: XCircle, label: 'Cancelled' },
  };
  const x = v[status] ?? v.PENDING!;
  const Icon = x.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${x.bg} ${x.fg}`}>
      <Icon size={10} strokeWidth={2.5} />
      {x.label}
    </span>
  );
}
