import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Clock, CheckCircle2, ExternalLink } from 'lucide-react';
import { getSellerSession } from '@/server/auth';
import { prisma } from '@/server/db';
import { SellerShell } from '@/components/seller-shell';

export const metadata = { title: 'Dashboard' };

export default async function SellerDashboard() {
  const session = await getSellerSession();
  if (!session) redirect('/login');

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      displayName: true,
      slug: true,
      status: true,
      stripeAccountId: true,
      stripePayoutsEnabled: true,
      ratingAvg: true,
      ratingCount: true,
      _count: { select: { products: true, orderItems: true } },
      createdAt: true,
    },
  });
  if (!seller) redirect('/apply');

  return (
    <SellerShell email={session.user.email} name={session.user.fullName ?? undefined}>
      <div className="container-page py-10 md:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500">
              Your storefront
            </p>
            <h1 className="mt-3 font-display text-4xl font-medium leading-tight tracking-tight text-stone-950 md:text-5xl">
              {seller.displayName}
            </h1>
          </div>
          <StatusBadge status={seller.status} stripeReady={seller.stripePayoutsEnabled} />
        </div>

        {/* Onboarding checklist */}
        <div className="mt-10 grid gap-px overflow-hidden rounded-3xl bg-stone-200">
          <ChecklistRow
            done
            title="Application submitted"
            sub={`Submitted ${seller.createdAt.toUTCString()}`}
          />
          <ChecklistRow
            done={seller.status === 'APPROVED' || seller.status === 'KYC_SUBMITTED'}
            active={seller.status === 'PENDING_KYC'}
            title="KYC review"
            sub="Onsective ops reviews your application + identity docs. Usually within 1 business day."
          />
          <ChecklistRow
            done={seller.status === 'APPROVED' && seller.stripePayoutsEnabled}
            active={seller.status === 'APPROVED' && !seller.stripePayoutsEnabled}
            title="Connect Stripe Express"
            sub="Required before your first payout. Bank verification + ID."
          />
          <ChecklistRow
            done={seller._count.products > 0}
            active={seller.status === 'APPROVED' && seller.stripePayoutsEnabled && seller._count.products === 0}
            title="List your first product"
            sub="5-step wizard. Listings go live after approval."
          />
        </div>

        {/* Stats */}
        {seller.status === 'APPROVED' && (
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Active products" value={seller._count.products} />
            <Stat label="Total orders" value={seller._count.orderItems} />
            <Stat label="Rating" value={seller.ratingAvg.toFixed(2)} />
            <Stat label="Reviews" value={seller.ratingCount} />
          </div>
        )}

        {/* Detail pages stub — full UI moving from main app over time */}
        <div className="mt-12 rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <p className="text-sm font-semibold text-amber-900">Heads up</p>
          <p className="mt-1 text-sm text-amber-800">
            The product wizard, orders queue, payouts ledger, and analytics charts
            are still served from the main app. They&rsquo;ll move into this portal
            in the next deploy. For now:
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="https://itsnottechy.cloud/en/seller/products"
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100"
            >
              Products <ExternalLink size={11} strokeWidth={1.75} />
            </Link>
            <Link
              href="https://itsnottechy.cloud/en/seller/orders"
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100"
            >
              Orders <ExternalLink size={11} strokeWidth={1.75} />
            </Link>
            <Link
              href="https://itsnottechy.cloud/en/seller/payouts"
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100"
            >
              Payouts <ExternalLink size={11} strokeWidth={1.75} />
            </Link>
            <Link
              href="https://itsnottechy.cloud/en/seller/analytics"
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100"
            >
              Analytics <ExternalLink size={11} strokeWidth={1.75} />
            </Link>
          </div>
        </div>
      </div>
    </SellerShell>
  );
}

function ChecklistRow({
  done,
  active,
  title,
  sub,
}: {
  done?: boolean;
  active?: boolean;
  title: string;
  sub: string;
}) {
  return (
    <div className="flex items-start gap-5 bg-white p-7">
      <span
        className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
          done ? 'bg-emerald-700 text-white' : active ? 'bg-amber-300 text-amber-900' : 'bg-stone-200 text-stone-500'
        }`}
      >
        {done ? <CheckCircle2 size={14} strokeWidth={2.5} /> : <Clock size={12} strokeWidth={2} />}
      </span>
      <div>
        <p className="font-display text-lg font-medium text-stone-950">{title}</p>
        <p className="mt-1 text-sm text-stone-600">{sub}</p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl bg-white p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">{label}</p>
      <p className="mt-3 font-display text-3xl font-medium tabular-nums tracking-tight text-stone-950">
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status, stripeReady }: { status: string; stripeReady: boolean }) {
  const variants: Record<string, { bg: string; fg: string; label: string }> = {
    PENDING_KYC: { bg: 'bg-amber-100', fg: 'text-amber-900', label: 'Under review' },
    KYC_SUBMITTED: { bg: 'bg-amber-100', fg: 'text-amber-900', label: 'Docs received' },
    APPROVED: stripeReady
      ? { bg: 'bg-emerald-100', fg: 'text-emerald-900', label: 'Approved · ready to sell' }
      : { bg: 'bg-sky-100', fg: 'text-sky-900', label: 'Approved · connect Stripe' },
    SUSPENDED: { bg: 'bg-red-100', fg: 'text-red-900', label: 'Suspended' },
    REJECTED: { bg: 'bg-stone-200', fg: 'text-stone-700', label: 'Not approved' },
  };
  const v = variants[status] ?? variants.PENDING_KYC;
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold ${v?.bg} ${v?.fg}`}>
      <span className="inline-flex h-2 w-2 rounded-full bg-current opacity-70" />
      {v?.label}
    </span>
  );
}
