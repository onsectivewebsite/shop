import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { getSellerSession } from '@/server/auth';
import { prisma } from '@/server/db';
import { SellerShell } from '@/components/seller-shell';
import { KycUploader } from './kyc-uploader';

export const metadata = { title: 'KYC documents' };

const REQUIRED_DOCS: { type: string; label: string; example: string }[] = [
  { type: 'GOVT_ID', label: 'Government-issued ID', example: 'Passport, driver license, national ID' },
  { type: 'BUSINESS_REGISTRATION', label: 'Business registration', example: 'Certificate of incorporation, sole-prop registration' },
  { type: 'TAX_CERTIFICATE', label: 'Tax certificate', example: 'GSTIN / EIN / VAT registration' },
  { type: 'BANK_STATEMENT', label: 'Bank statement', example: 'Last 3 months — redactions are fine' },
  { type: 'ADDRESS_PROOF', label: 'Address proof', example: 'Utility bill / lease, less than 3 months old' },
];

export default async function KycPage() {
  const session = await getSellerSession();
  if (!session) redirect('/login');
  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    include: { kycDocuments: { orderBy: { createdAt: 'desc' } } },
  });
  if (!seller) redirect('/apply');

  // Latest submission per doc type
  const latest = new Map<string, (typeof seller.kycDocuments)[number]>();
  for (const d of seller.kycDocuments) {
    if (!latest.has(d.type)) latest.set(d.type, d);
  }

  const submittedCount = REQUIRED_DOCS.filter((d) => {
    const cur = latest.get(d.type);
    return cur && (cur.status === 'PENDING' || cur.status === 'APPROVED');
  }).length;
  const approvedCount = REQUIRED_DOCS.filter((d) => latest.get(d.type)?.status === 'APPROVED').length;

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
          Upload the five documents below so Onsective ops can verify your identity, business
          registration, and bank ownership. Files are stored privately — only Onsective ops can
          read them.
        </p>

        <div className="mt-6 inline-flex items-center gap-3 rounded-full bg-stone-100 px-4 py-1.5 text-xs font-semibold text-stone-700">
          <span>
            {approvedCount} approved · {submittedCount - approvedCount} in review · {REQUIRED_DOCS.length - submittedCount} remaining
          </span>
        </div>

        <div className="mt-10 max-w-3xl space-y-3">
          {REQUIRED_DOCS.map((d) => {
            const cur = latest.get(d.type);
            return (
              <div
                key={d.type}
                className="flex items-start justify-between gap-6 rounded-2xl border border-stone-200 bg-white p-5"
              >
                <div className="flex-1">
                  <p className="font-display text-lg font-medium text-stone-950">{d.label}</p>
                  <p className="mt-1 text-sm text-stone-500">{d.example}</p>
                  {cur && (
                    <p className="mt-2 text-xs text-stone-500">
                      Last submitted {cur.createdAt.toUTCString()}
                      {cur.notes && (
                        <span className="ml-2 italic text-rose-700">· {cur.notes}</span>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge status={cur?.status ?? null} />
                  <KycUploader docType={d.type} label={cur ? 'replace' : 'doc'} />
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-10 max-w-2xl text-xs text-stone-500">
          Accepted formats: JPEG, PNG, WebP, or PDF. Max 10 MB per file. Re-uploading a doc
          supersedes the previous PENDING submission. APPROVED documents are immutable.
        </p>
      </div>
    </SellerShell>
  );
}

function Badge({ status }: { status: string | null }) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
        <Clock size={11} /> Awaiting
      </span>
    );
  }
  const v = {
    PENDING: { bg: 'bg-amber-100', fg: 'text-amber-900', icon: Clock, label: 'In review' },
    APPROVED: { bg: 'bg-emerald-100', fg: 'text-emerald-900', icon: CheckCircle2, label: 'Approved' },
    REJECTED: { bg: 'bg-rose-100', fg: 'text-rose-900', icon: XCircle, label: 'Rejected — resubmit' },
  }[status as 'PENDING' | 'APPROVED' | 'REJECTED']!;
  const Icon = v.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${v.bg} ${v.fg}`}>
      <Icon size={11} strokeWidth={2.5} />
      {v.label}
    </span>
  );
}
