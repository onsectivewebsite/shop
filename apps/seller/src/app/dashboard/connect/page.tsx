import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Wallet, Globe } from 'lucide-react';
import { getSellerSession } from '@/server/auth';
import { prisma } from '@/server/db';
import { SellerShell } from '@/components/seller-shell';
import { ConnectButton } from './connect-button';

export const metadata = { title: 'Connect Stripe' };

export default async function ConnectPage() {
  const session = await getSellerSession();
  if (!session) redirect('/login');
  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } });
  if (!seller) redirect('/apply');

  const isApproved = seller.status === 'APPROVED';
  const isReady = isApproved && seller.stripePayoutsEnabled;

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
          Payments & payouts
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-stone-600">
          Buyers pay <strong>Onsective</strong>, never you directly. We collect, hold for the return
          window, then transfer your earnings (net of commission) to your bank weekly via Stripe Express.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <Perk icon={Globe} title="Onsective is the merchant of record" sub="You never touch a credit card." />
          <Perk icon={ShieldCheck} title="Fraud + chargebacks on us" sub="We absorb dispute risk." />
          <Perk icon={Wallet} title="Weekly bank deposits" sub="ACH or bank wire via Stripe Connect." />
        </div>

        <div className="mt-10 max-w-2xl rounded-3xl border border-stone-200 bg-white p-8 sm:p-10">
          {!isApproved && (
            <>
              <p className="font-display text-2xl font-medium text-stone-950">
                Locked until KYC approval
              </p>
              <p className="mt-2 text-sm text-stone-600">
                Stripe Connect onboarding unlocks once Onsective ops review your application
                and KYC documents. Current status: <strong>{seller.status}</strong>.
              </p>
            </>
          )}

          {isApproved && !isReady && (
            <>
              <p className="font-display text-2xl font-medium text-stone-950">
                Connect your bank account
              </p>
              <p className="mt-2 mb-6 text-sm text-stone-600">
                Stripe Express handles bank verification + ID confirmation. Takes about 3 minutes.
                You can leave and resume from this page if you need a doc.
              </p>
              <ConnectButton />
            </>
          )}

          {isReady && (
            <>
              <p className="font-display text-2xl font-medium text-stone-950">
                Ready to receive payouts.
              </p>
              <p className="mt-2 text-sm text-stone-600">
                Your Stripe account is verified and payouts are enabled. The first transfer fires
                7 days after the first paid order (return window).
              </p>
              <p className="mt-4 text-xs text-stone-500">
                Stripe account ID: <code className="text-stone-700">{seller.stripeAccountId}</code>
              </p>
            </>
          )}
        </div>
      </div>
    </SellerShell>
  );
}

function Perk({
  icon: Icon,
  title,
  sub,
}: {
  icon: typeof Globe;
  title: string;
  sub: string;
}) {
  return (
    <div className="rounded-3xl bg-white p-6">
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
        <Icon size={18} strokeWidth={1.75} />
      </span>
      <p className="mt-5 font-display text-lg font-medium tracking-tight text-stone-950">{title}</p>
      <p className="mt-1 text-sm text-stone-600">{sub}</p>
    </div>
  );
}
