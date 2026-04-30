import { redirect } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { getSellerSession } from '@/server/auth';
import { prisma } from '@/server/db';
import { refreshAccountStatus } from '@/server/connect';
import { SellerShell } from '@/components/seller-shell';

export const metadata = { title: 'Stripe onboarding complete' };

export default async function OnboardingReturnPage() {
  const session = await getSellerSession();
  if (!session) redirect('/login');
  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } });
  if (!seller) redirect('/apply');
  if (!seller.stripeAccountId) redirect('/dashboard/connect');

  let payoutsEnabled = false;
  let dueRequirements: string[] = [];
  try {
    const status = await refreshAccountStatus(seller.id);
    payoutsEnabled = status.payoutsEnabled;
    dueRequirements = status.requirementsCurrentlyDue;
  } catch {
    // Fall through to a generic message
  }

  return (
    <SellerShell email={session.user.email} name={session.user.fullName ?? undefined}>
      <div className="container-page py-16 md:py-24">
        <div className="mx-auto max-w-2xl rounded-3xl border border-stone-200 bg-white p-8 sm:p-10">
          {payoutsEnabled ? (
            <>
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 size={22} strokeWidth={2} />
              </span>
              <h1 className="mt-6 font-display text-3xl font-medium tracking-tight text-stone-950">
                Stripe is connected.
              </h1>
              <p className="mt-3 text-sm text-stone-600">
                Your bank account is verified and payouts are enabled. The first transfer fires
                7 days after your first paid order.
              </p>
              <Link
                href="/dashboard"
                className="mt-8 inline-flex h-11 items-center rounded-full bg-stone-900 px-6 text-sm font-semibold text-white transition-colors hover:bg-stone-800"
              >
                Back to dashboard
              </Link>
            </>
          ) : (
            <>
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-800">
                <AlertCircle size={22} strokeWidth={2} />
              </span>
              <h1 className="mt-6 font-display text-3xl font-medium tracking-tight text-stone-950">
                Almost there — Stripe needs more.
              </h1>
              <p className="mt-3 text-sm text-stone-600">
                Stripe still needs the following before your account is fully verified:
              </p>
              {dueRequirements.length > 0 && (
                <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-stone-700">
                  {dueRequirements.map((r) => (
                    <li key={r} className="font-mono text-xs">
                      {r}
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href="/dashboard/connect"
                className="mt-8 inline-flex h-11 items-center rounded-full bg-stone-900 px-6 text-sm font-semibold text-white transition-colors hover:bg-stone-800"
              >
                Resume onboarding
              </Link>
            </>
          )}
        </div>
      </div>
    </SellerShell>
  );
}
