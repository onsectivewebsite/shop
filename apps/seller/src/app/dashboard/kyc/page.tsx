import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Mail, Clock } from 'lucide-react';
import { getSellerSession } from '@/server/auth';
import { prisma } from '@/server/db';
import { SellerShell } from '@/components/seller-shell';

export const metadata = { title: 'KYC documents' };

const REQUIRED_DOCS: { type: string; label: string; example: string }[] = [
  { type: 'GOVT_ID', label: 'Government-issued ID', example: 'Passport, driver license, national ID' },
  { type: 'BUSINESS_REGISTRATION', label: 'Business registration', example: 'Certificate of incorporation, sole-prop registration' },
  { type: 'TAX_CERTIFICATE', label: 'Tax certificate', example: 'GSTIN / EIN / VAT registration' },
  { type: 'BANK_STATEMENT', label: 'Bank statement', example: 'Last 3 months, redacted is fine' },
  { type: 'ADDRESS_PROOF', label: 'Address proof', example: 'Utility bill, lease, less than 3 months old' },
];

export default async function KycPage() {
  const session = await getSellerSession();
  if (!session) redirect('/login');
  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    include: { kycDocuments: { orderBy: { createdAt: 'desc' } } },
  });
  if (!seller) redirect('/apply');

  const docsByType = new Map(seller.kycDocuments.map((d) => [d.type, d]));

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
          KYC documents
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-stone-600">
          To approve your seller account, Onsective ops needs to verify your identity, business
          registration, and bank ownership. Send the five documents below to{' '}
          <a
            href={`mailto:help@onsective.com?subject=KYC docs for seller ${seller.id}`}
            className="font-medium text-stone-900 underline-offset-4 hover:underline"
          >
            help@onsective.com
          </a>
          . Reference your seller ID:{' '}
          <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs">{seller.id}</code>
        </p>

        <div className="mt-10 max-w-3xl space-y-3">
          {REQUIRED_DOCS.map((d) => {
            const submitted = docsByType.get(d.type);
            return (
              <div
                key={d.type}
                className="flex items-start justify-between gap-6 rounded-2xl border border-stone-200 bg-white p-5"
              >
                <div>
                  <p className="font-display text-lg font-medium text-stone-950">{d.label}</p>
                  <p className="mt-1 text-sm text-stone-500">{d.example}</p>
                  {submitted && (
                    <p className="mt-2 text-xs text-stone-500">
                      Submitted {submitted.createdAt.toUTCString()}
                    </p>
                  )}
                </div>
                <div>
                  {submitted ? (
                    <Badge status={submitted.status} />
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
                      <Clock size={11} /> Awaiting
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-10 max-w-3xl rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <Mail size={14} /> Direct upload coming soon
          </p>
          <p className="mt-2 text-sm text-amber-800">
            We&rsquo;re wiring up direct in-portal uploads. For now, email scans (or clear photos) of the
            five documents above to{' '}
            <a href="mailto:help@onsective.com" className="font-medium underline">
              help@onsective.com
            </a>{' '}
            with your seller ID in the subject line. Most reviews complete within one business day.
          </p>
        </div>
      </div>
    </SellerShell>
  );
}

function Badge({ status }: { status: string }) {
  const v = status === 'APPROVED'
    ? { bg: 'bg-emerald-100', fg: 'text-emerald-900', label: 'Approved' }
    : status === 'REJECTED'
    ? { bg: 'bg-red-100', fg: 'text-red-900', label: 'Rejected — resubmit' }
    : { bg: 'bg-amber-100', fg: 'text-amber-900', label: 'In review' };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${v.bg} ${v.fg}`}>
      {v.label}
    </span>
  );
}
