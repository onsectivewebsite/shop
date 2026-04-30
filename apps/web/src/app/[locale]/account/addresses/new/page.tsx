import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getSession } from '@/server/auth/session';
import { AddressForm } from '@/components/account/address-form';
import { createAddressAction } from '../actions';

export const metadata = { title: 'New address' };

export default async function NewAddressPage({ params }: { params: { locale: string } }) {
  const session = await getSession();
  if (!session) redirect(`/${params.locale}/login`);

  return (
    <div className="container-page py-12 md:py-16">
      <Link
        href={`/${params.locale}/account/addresses`}
        className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900"
      >
        <ArrowLeft size={14} /> Back to addresses
      </Link>

      <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-stone-950 md:text-5xl">
        New address
      </h1>

      <div className="mt-10 max-w-2xl rounded-3xl border border-stone-200 bg-white p-8 sm:p-10">
        <AddressForm action={createAddressAction} submitLabel="Save address" />
      </div>
    </div>
  );
}
