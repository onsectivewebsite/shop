import Link from 'next/link';
import { ArrowUpRight, Truck, ShieldCheck, Globe, Wallet, Clock, CheckCircle2 } from 'lucide-react';
import { getSession } from '@/server/auth/session';
import { prisma } from '@/server/db';
import { SellerApplyForm } from '@/components/seller/apply-form';

export const metadata = { title: 'Sell on Onsective' };

export default async function SellPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { status?: string };
}) {
  const session = await getSession();
  const seller = session
    ? await prisma.seller.findUnique({
        where: { userId: session.user.id },
        select: {
          id: true,
          status: true,
          displayName: true,
          slug: true,
          createdAt: true,
          stripePayoutsEnabled: true,
        },
      })
    : null;

  // Branch 1: signed-in seller already exists — show status panel
  if (seller) {
    return (
      <div className="bg-stone-50">
        <div className="container-page py-20 md:py-28">
          <div className="mx-auto max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500">
              Your application
            </p>
            <h1 className="mt-6 font-display text-5xl font-medium leading-tight tracking-tight text-stone-950 md:text-6xl">
              {seller.displayName}
            </h1>
            <StatusBadge status={seller.status} stripeReady={seller.stripePayoutsEnabled} />

            <div className="mt-12 grid gap-px overflow-hidden rounded-3xl bg-stone-200">
              <Step
                done
                title="Application submitted"
                sub={`Submitted ${seller.createdAt.toUTCString()}`}
              />
              <Step
                done={seller.status === 'KYC_SUBMITTED' || seller.status === 'APPROVED'}
                active={seller.status === 'PENDING_KYC'}
                title="KYC review"
                sub="Onsective ops reviews your application + identity docs. Usually within 1 business day."
              />
              <Step
                done={seller.status === 'APPROVED' && seller.stripePayoutsEnabled}
                active={seller.status === 'APPROVED' && !seller.stripePayoutsEnabled}
                title="Connect Stripe Express"
                sub="Required before your first payout."
              />
              <Step
                done={false}
                active={seller.status === 'APPROVED' && seller.stripePayoutsEnabled}
                title="List your first product"
                sub="5-step wizard. Listings go live after a quick approval."
              />
            </div>

            {seller.status === 'APPROVED' && (
              <Link
                href="/seller"
                className="group mt-12 inline-flex items-center gap-2 rounded-full bg-stone-900 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-stone-800"
              >
                Go to seller dashboard
                <ArrowUpRight size={14} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            )}
            {seller.status === 'SUSPENDED' && (
              <p className="mt-12 rounded-2xl bg-red-50 p-6 text-sm text-red-900">
                Your seller account is currently <strong>suspended</strong>. Reach out to{' '}
                <a href="mailto:help@onsective.com" className="underline">
                  help@onsective.com
                </a>
                {' '}to resolve.
              </p>
            )}
            {seller.status === 'REJECTED' && (
              <p className="mt-12 rounded-2xl bg-stone-100 p-6 text-sm text-stone-700">
                Your application was not approved at this time. We&rsquo;re happy to
                revisit if your business circumstances change — write to{' '}
                <a href="mailto:help@onsective.com" className="underline">
                  help@onsective.com
                </a>
                .
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Branch 2: signed-in but no seller row — show apply form
  if (session) {
    return (
      <div className="bg-stone-50">
        <div className="container-page py-20 md:py-28">
          <div className="mx-auto max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500">
              Apply to sell
            </p>
            <h1 className="mt-6 font-display text-5xl font-medium leading-tight tracking-tight text-stone-950 md:text-6xl">
              Tell us about your business.
            </h1>
            <p className="mt-6 max-w-xl text-base text-stone-600">
              We review every application by hand. We get back within one business day.
              You&rsquo;ll be asked for KYC docs (ID, business registration) once we open
              the next step.
            </p>

            {searchParams.status === 'submitted' && (
              <div className="mt-10 rounded-2xl bg-emerald-50 p-6 text-sm text-emerald-900">
                Application received. We&rsquo;ll email you the moment review is done.
              </div>
            )}

            <div className="mt-12 rounded-3xl border border-stone-200 bg-white p-8 sm:p-10">
              <SellerApplyForm />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Branch 3: not signed in — marketing page with signup CTA
  return (
    <div className="bg-stone-50">
      <section className="relative overflow-hidden">
        <div className="container-page pt-16 pb-12 md:pt-24 md:pb-20">
          <div className="grid gap-12 md:grid-cols-12">
            <div className="md:col-span-7">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500">
                Sell on Onsective
              </p>
              <h1 className="mt-6 font-display text-5xl font-medium leading-[1.02] tracking-tight text-stone-950 md:text-7xl">
                Reach buyers across <em className="italic text-emerald-700">80+ countries</em>.
              </h1>
              <p className="mt-8 max-w-lg text-lg text-stone-600">
                A small commission, weekly payouts, and a global checkout that handles tax,
                fraud, and shipping. You stay focused on what you make.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <Link
                  href={`/${params.locale}/signup?next=${encodeURIComponent(`/${params.locale}/sell`)}`}
                  className="group inline-flex items-center gap-2 rounded-full bg-stone-900 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-stone-800"
                >
                  Create an account to apply
                  <ArrowUpRight size={14} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href={`/${params.locale}/login?next=${encodeURIComponent(`/${params.locale}/sell`)}`}
                  className="text-sm font-medium text-stone-700 underline-offset-4 transition-colors hover:text-stone-950 hover:underline"
                >
                  Already have an account? Sign in →
                </Link>
              </div>
            </div>
            <div className="md:col-span-5">
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Commission" value="8 — 15%" sub="Tiered by category" />
                <Stat label="Payouts" value="Weekly" sub="To your bank, via Stripe" />
                <Stat label="Markets" value="80+" sub="Customs handled centrally" />
                <Stat label="Listing fees" value="$0" sub="No subscription" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-20 md:py-28">
        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500">
          What you get
        </p>
        <h2 className="mt-6 font-display text-4xl font-medium leading-tight tracking-tight text-stone-950 md:text-5xl">
          Everything except the part you actually own.
        </h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <Perk icon={Globe} title="Global checkout" sub="Multi-currency, multi-language, Stripe-secured." />
          <Perk icon={Truck} title="Logistics layer" sub="EasyPost rates, label printing, tracking webhooks." />
          <Perk icon={ShieldCheck} title="Fraud + buyer protection" sub="We handle disputes and chargebacks." />
          <Perk icon={Wallet} title="Weekly Stripe payouts" sub="Direct deposit, transparent fee breakdown." />
        </div>
      </section>

      <section className="container-page pb-24 md:pb-32">
        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500">
          How it works
        </p>
        <h2 className="mt-6 font-display text-4xl font-medium leading-tight tracking-tight text-stone-950 md:text-5xl">
          Four steps. No surprises.
        </h2>
        <ol className="mt-12 grid gap-px overflow-hidden rounded-3xl bg-stone-200">
          <Step done title="01 · Apply" sub="Tell us about your business and categories." />
          <Step done title="02 · KYC + identity" sub="Upload ID and business docs. Reviewed in ≤ 1 business day." />
          <Step done title="03 · Connect Stripe" sub="Express onboarding — bank account, ID verification." />
          <Step done title="04 · List & sell" sub="5-step wizard. Listings go live after approval." />
        </ol>
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex flex-col justify-between rounded-2xl bg-white p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
        {label}
      </p>
      <p className="mt-4 font-display text-3xl font-medium tracking-tight text-stone-950">
        {value}
      </p>
      <p className="mt-1 text-xs text-stone-500">{sub}</p>
    </div>
  );
}

function Perk({
  icon: Icon,
  title,
  sub,
}: {
  icon: typeof Truck;
  title: string;
  sub: string;
}) {
  return (
    <div className="rounded-3xl bg-white p-6">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
        <Icon size={20} strokeWidth={1.75} />
      </span>
      <p className="mt-6 font-display text-xl font-medium tracking-tight text-stone-950">
        {title}
      </p>
      <p className="mt-1 text-sm text-stone-600">{sub}</p>
    </div>
  );
}

function Step({
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

function StatusBadge({ status, stripeReady }: { status: string; stripeReady: boolean }) {
  const variants: Record<string, { bg: string; fg: string; label: string }> = {
    PENDING_KYC: { bg: 'bg-amber-100', fg: 'text-amber-900', label: 'Under review' },
    KYC_SUBMITTED: { bg: 'bg-amber-100', fg: 'text-amber-900', label: 'Docs received, in review' },
    APPROVED: stripeReady
      ? { bg: 'bg-emerald-100', fg: 'text-emerald-900', label: 'Approved · ready to sell' }
      : { bg: 'bg-sky-100', fg: 'text-sky-900', label: 'Approved · connect Stripe to start' },
    SUSPENDED: { bg: 'bg-red-100', fg: 'text-red-900', label: 'Suspended' },
    REJECTED: { bg: 'bg-stone-200', fg: 'text-stone-700', label: 'Not approved' },
  };
  const v = variants[status] ?? variants.PENDING_KYC;
  return (
    <span
      className={`mt-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold ${v?.bg} ${v?.fg}`}
    >
      <span className="inline-flex h-2 w-2 rounded-full bg-current opacity-70" />
      {v?.label}
    </span>
  );
}
