import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Clock, CheckCircle2, ArrowUpRight, Store, FileCheck2, CreditCard, Package, Receipt, Wallet, BarChart3 } from 'lucide-react';
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

        {/* Quick actions — onboarding tools always visible */}
        <div className="mt-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500">
            Manage your storefront
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ActionTile
              href="/dashboard/storefront"
              icon={Store}
              title="Storefront profile"
              sub="Edit name, description, country, tax id"
            />
            <ActionTile
              href="/dashboard/kyc"
              icon={FileCheck2}
              title="KYC documents"
              sub="Submit identity + business proof"
            />
            <ActionTile
              href="/dashboard/connect"
              icon={CreditCard}
              title="Stripe payouts"
              sub={seller.stripePayoutsEnabled ? 'Connected · ready' : 'Connect bank account'}
            />
          </div>
        </div>

        {/* Day-to-day operations — placeholders until next deploy */}
        {seller.status === 'APPROVED' && (
          <div className="mt-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500">
              Day-to-day operations · coming next deploy
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SoonTile icon={Package} title="Products" />
              <SoonTile icon={Receipt} title="Orders" />
              <SoonTile icon={Wallet} title="Payouts ledger" />
              <SoonTile icon={BarChart3} title="Analytics" />
            </div>
          </div>
        )}
      </div>
    </SellerShell>
  );
}

function ActionTile({
  href,
  icon: Icon,
  title,
  sub,
}: {
  href: string;
  icon: typeof Store;
  title: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="group relative block rounded-3xl border border-stone-200 bg-white p-6 transition-all hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-[0_8px_24px_rgba(0,0,0,0.04)]"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
        <Icon size={18} strokeWidth={1.75} />
      </span>
      <p className="mt-5 font-display text-lg font-medium tracking-tight text-stone-950">{title}</p>
      <p className="mt-1 text-sm text-stone-600">{sub}</p>
      <ArrowUpRight
        size={14}
        strokeWidth={1.75}
        className="absolute right-5 top-5 text-stone-300 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-stone-900"
      />
    </Link>
  );
}

function SoonTile({ icon: Icon, title }: { icon: typeof Store; title: string }) {
  return (
    <div className="rounded-3xl border border-stone-200 bg-white/60 p-5 opacity-70">
      <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-stone-100 text-stone-500">
        <Icon size={16} strokeWidth={1.75} />
      </span>
      <p className="mt-4 font-display text-base font-medium text-stone-700">{title}</p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-stone-400">Soon</p>
    </div>
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
