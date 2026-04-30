import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/server/db';
import { getSession } from '@/server/auth/session';
import { AddressForm } from '@/components/account/address-form';
import { updateAddressAction } from '../../actions';

export const metadata = { title: 'Edit address' };

export default async function EditAddressPage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  const session = await getSession();
  if (!session) redirect(`/${params.locale}/login`);

  const addr = await prisma.address.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!addr) notFound();

  return (
    <div className="container-page py-12 md:py-16">
      <Link
        href={`/${params.locale}/account/addresses`}
        className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900"
      >
        <ArrowLeft size={14} /> Back to addresses
      </Link>

      <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-stone-950 md:text-5xl">
        Edit address
      </h1>

      <div className="mt-10 max-w-2xl rounded-3xl border border-stone-200 bg-white p-8 sm:p-10">
        <AddressForm
          action={updateAddressAction.bind(null, addr.id)}
          submitLabel="Save changes"
          defaults={{
            type: addr.type as 'SHIPPING' | 'BILLING',
            label: addr.label,
            recipient: addr.recipient,
            phone: addr.phone,
            line1: addr.line1,
            line2: addr.line2,
            city: addr.city,
            state: addr.state,
            postalCode: addr.postalCode,
            countryCode: addr.countryCode,
            isDefault: addr.isDefault,
          }}
        />
      </div>
    </div>
  );
}
