import { redirect } from 'next/navigation';
import { getSellerSession } from '@/server/auth';
import { prisma } from '@/server/db';
import { ApplyForm } from './apply-form';
import { SellerShell } from '@/components/seller-shell';

export const metadata = { title: 'Apply' };

export default async function ApplyPage() {
  const session = await getSellerSession();
  if (!session) redirect('/signup');

  const existing = await prisma.seller.findUnique({ where: { userId: session.user.id } });
  if (existing) redirect('/dashboard');

  return (
    <SellerShell email={session.user.email} name={session.user.fullName ?? undefined}>
      <div className="container-page py-12 md:py-16">
        <div className="mx-auto max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500">
            Step 2 of 4 · Tell us about your business
          </p>
          <h1 className="mt-6 font-display text-4xl font-medium leading-tight tracking-tight text-stone-950 md:text-5xl">
            Apply to sell.
          </h1>
          <p className="mt-4 max-w-xl text-base text-stone-600">
            We review every application by hand. Most decisions take less than one
            business day. KYC documents are requested in the next step.
          </p>

          <div className="mt-12 rounded-3xl border border-stone-200 bg-white p-8 sm:p-10">
            <ApplyForm defaultCountry={session.user.countryCode || 'US'} />
          </div>
        </div>
      </div>
    </SellerShell>
  );
}
