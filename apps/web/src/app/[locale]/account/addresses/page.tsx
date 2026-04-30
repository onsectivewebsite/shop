import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MapPin, Plus, Star, Pencil, Trash2 } from 'lucide-react';
import { prisma } from '@/server/db';
import { getSession } from '@/server/auth/session';
import { deleteAddressAction, setDefaultAddressAction } from './actions';
import { DeleteAddressButton } from './delete-button';

export const metadata = { title: 'Addresses' };

export default async function AddressesPage({ params }: { params: { locale: string } }) {
  const session = await getSession();
  if (!session) redirect(`/${params.locale}/login`);

  const addresses = await prisma.address.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: 'desc' }, { type: 'asc' }, { createdAt: 'desc' }],
  });

  const shipping = addresses.filter((a) => a.type === 'SHIPPING');
  const billing = addresses.filter((a) => a.type === 'BILLING');

  return (
    <div className="container-page py-12 md:py-16">
      <Link
        href={`/${params.locale}/account`}
        className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900"
      >
        <ArrowLeft size={14} /> Back to account
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl font-medium tracking-tight text-stone-950 md:text-5xl">
            Addresses
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            Saved for faster checkout. The default one auto-fills the shipping step.
          </p>
        </div>
        <Link
          href={`/${params.locale}/account/addresses/new`}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-stone-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-stone-800"
        >
          <Plus size={16} strokeWidth={2} />
          Add new address
        </Link>
      </div>

      <Section title="Shipping addresses">
        {shipping.length === 0 ? (
          <Empty />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {shipping.map((a) => (
              <AddressCard key={a.id} addr={a} locale={params.locale} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Billing addresses" optional>
        {billing.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-stone-300 bg-white p-6 text-sm text-stone-500">
            No separate billing addresses. We use your shipping address for billing
            unless you add a different one.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {billing.map((a) => (
              <AddressCard key={a.id} addr={a} locale={params.locale} />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  optional,
  children,
}: {
  title: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl font-medium tracking-tight text-stone-950">
        {title}
        {optional && <span className="ml-2 text-xs uppercase tracking-wider text-stone-500">optional</span>}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Empty() {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-700">
        <MapPin size={20} strokeWidth={1.75} />
      </span>
      <p className="mt-4 font-display text-xl font-medium text-stone-950">No addresses yet</p>
      <p className="mt-2 text-sm text-stone-600">
        Add one to skip retyping at checkout next time.
      </p>
    </div>
  );
}

function AddressCard({
  addr,
  locale,
}: {
  addr: {
    id: string;
    type: string;
    label: string | null;
    recipient: string;
    phone: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postalCode: string;
    countryCode: string;
    isDefault: boolean;
  };
  locale: string;
}) {
  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          {addr.label && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
              {addr.label}
            </p>
          )}
          <p className="mt-1 font-medium text-stone-900">{addr.recipient}</p>
        </div>
        {addr.isDefault && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-900">
            <Star size={10} strokeWidth={2.5} fill="currentColor" /> Default
          </span>
        )}
      </div>
      <p className="mt-3 text-sm text-stone-700">
        {addr.line1}
        {addr.line2 && <>, {addr.line2}</>}
      </p>
      <p className="text-sm text-stone-700">
        {addr.city}, {addr.state} {addr.postalCode}
      </p>
      <p className="text-xs uppercase tracking-wider text-stone-500">{addr.countryCode}</p>
      <p className="mt-2 text-xs text-stone-500">{addr.phone}</p>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href={`/${locale}/account/addresses/${addr.id}/edit`}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 text-xs font-semibold text-stone-700 hover:border-stone-500"
        >
          <Pencil size={11} strokeWidth={2} /> Edit
        </Link>
        {!addr.isDefault && (
          <form action={setDefaultAddressAction.bind(null, addr.id)}>
            <button
              type="submit"
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 text-xs font-semibold text-stone-700 hover:border-stone-500"
            >
              <Star size={11} strokeWidth={2} /> Set default
            </button>
          </form>
        )}
        <DeleteAddressButton addressId={addr.id} />
      </div>
    </article>
  );
}
