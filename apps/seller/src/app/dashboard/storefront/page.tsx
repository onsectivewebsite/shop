import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getSellerSession } from '@/server/auth';
import { prisma } from '@/server/db';
import { SellerShell } from '@/components/seller-shell';
import { StorefrontForm } from './storefront-form';
import { VacationCard } from './vacation-card';

export const metadata = { title: 'Storefront' };

export default async function StorefrontPage() {
  const session = await getSellerSession();
  if (!session) redirect('/login');
  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } });
  if (!seller) redirect('/apply');

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
          Storefront profile
        </h1>
        <p className="mt-3 max-w-xl text-sm text-stone-600">
          What buyers see on product pages and your seller storefront. Changes are
          live immediately on listings.
        </p>

        <div className="mt-10 max-w-3xl rounded-3xl border border-stone-200 bg-white p-8 sm:p-10">
          <StorefrontForm
            initial={{
              legalName: seller.legalName,
              displayName: seller.displayName,
              description: seller.description ?? '',
              countryCode: seller.countryCode,
              taxId: seller.taxId ?? '',
            }}
            approved={seller.status === 'APPROVED'}
          />
        </div>

        <div className="mt-6 max-w-3xl rounded-3xl border border-stone-200 bg-white p-8 sm:p-10">
          <VacationCard
            initial={{
              vacationMode: seller.vacationMode,
              vacationMessage: seller.vacationMessage ?? '',
              // <input type="datetime-local"> wants YYYY-MM-DDTHH:MM
              vacationUntil: seller.vacationUntil
                ? seller.vacationUntil.toISOString().slice(0, 16)
                : '',
            }}
          />
        </div>
      </div>
    </SellerShell>
  );
}
