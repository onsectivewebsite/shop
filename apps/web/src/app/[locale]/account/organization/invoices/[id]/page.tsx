import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/server/auth';
import { prisma } from '@/server/db';
import { InvoiceDetail } from '@/components/account/invoice-detail';

export const metadata = { title: 'Invoice' };
export const dynamic = 'force-dynamic';

export default async function InvoicePage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  const session = await getSession();
  if (!session) redirect(`/${params.locale}/login`);

  // Resolve the org from the invoice on the server so the client component
  // doesn't have to walk the org list. Membership is enforced again in the
  // tRPC query — defence in depth.
  const invoice = await prisma.b2BInvoice.findUnique({
    where: { id: params.id },
    select: { organizationId: true },
  });
  if (!invoice) notFound();

  const member = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: invoice.organizationId,
        userId: session.user.id,
      },
    },
    select: { id: true },
  });
  if (!member) notFound();

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          href={`/${params.locale}/account/organization/invoices`}
          className="text-sm font-medium text-slate-700 underline-offset-4 hover:text-slate-900 hover:underline print:hidden"
        >
          ← All invoices
        </Link>
        <InvoiceDetail
          organizationId={invoice.organizationId}
          invoiceId={params.id}
          locale={params.locale}
        />
      </div>
    </div>
  );
}
