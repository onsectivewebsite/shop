import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/server/auth';
import { OrgInvoices } from '@/components/account/org-invoices';

export const metadata = { title: 'Invoices' };
export const dynamic = 'force-dynamic';

export default async function InvoicesIndexPage({ params }: { params: { locale: string } }) {
  const session = await getSession();
  if (!session) redirect(`/${params.locale}/login`);

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-baseline justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Invoices</h1>
            <p className="mt-2 text-sm text-slate-500">
              NET-30 invoices for your organisations. Issued the day an order
              ships; due 30 days from issuance unless your payment terms differ.
            </p>
          </div>
          <Link
            href={`/${params.locale}/account/organization`}
            className="text-sm font-medium text-slate-700 underline-offset-4 hover:text-slate-900 hover:underline"
          >
            ← Organization
          </Link>
        </header>
        <OrgInvoices locale={params.locale} />
      </div>
    </div>
  );
}
