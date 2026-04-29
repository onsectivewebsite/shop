import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowUpRight, Globe, Truck, ShieldCheck, Wallet } from 'lucide-react';
import { getSellerSession } from '@/server/auth';
import { prisma } from '@/server/db';
import { SellerShell } from '@/components/seller-shell';

export default async function SellerLanding() {
  const session = await getSellerSession();
  if (session) {
    const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } });
    redirect(seller ? '/dashboard' : '/apply');
  }

  return (
    <SellerShell>
      <section className="container-page pt-16 pb-12 md:pt-24 md:pb-20">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500">
              Onsective for sellers
            </p>
            <h1 className="mt-6 font-display text-5xl font-medium leading-[1.02] tracking-tight text-stone-950 md:text-7xl">
              Sell to <em className="italic text-emerald-700">80+ countries</em>.
              We handle the rest.
            </h1>
            <p className="mt-8 max-w-lg text-lg text-stone-600">
              Buyers pay <strong>Onsective</strong>, not you. We handle tax, fraud,
              chargebacks, and currency conversion. We then transfer your earnings,
              net of commission, to your bank weekly via Stripe.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="group inline-flex items-center gap-2 rounded-full bg-stone-900 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-stone-800"
              >
                Apply to sell
                <ArrowUpRight size={14} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/login"
                className="text-sm font-medium text-stone-700 underline-offset-4 transition-colors hover:text-stone-950 hover:underline"
              >
                Already a seller? Sign in →
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
      </section>

      <section className="container-page py-16 md:py-24">
        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500">
          What you get
        </p>
        <h2 className="mt-6 font-display text-4xl font-medium leading-tight tracking-tight text-stone-950 md:text-5xl">
          Everything except the part you actually own.
        </h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <Perk icon={Globe} title="Onsective is the merchant of record" sub="Buyers pay us. You never touch a credit card." />
          <Perk icon={Truck} title="Logistics layer" sub="EasyPost rates, label printing, tracking webhooks." />
          <Perk icon={ShieldCheck} title="Fraud + chargebacks on us" sub="We absorb the dispute risk on every order." />
          <Perk icon={Wallet} title="Weekly bank payouts" sub="Net of commission, via Stripe Connect." />
        </div>
      </section>
    </SellerShell>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex flex-col justify-between rounded-2xl bg-white p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">{label}</p>
      <p className="mt-4 font-display text-3xl font-medium tracking-tight text-stone-950">{value}</p>
      <p className="mt-1 text-xs text-stone-500">{sub}</p>
    </div>
  );
}

function Perk({ icon: Icon, title, sub }: { icon: typeof Truck; title: string; sub: string }) {
  return (
    <div className="rounded-3xl bg-white p-6">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
        <Icon size={20} strokeWidth={1.75} />
      </span>
      <p className="mt-6 font-display text-xl font-medium tracking-tight text-stone-950">{title}</p>
      <p className="mt-1 text-sm text-stone-600">{sub}</p>
    </div>
  );
}
