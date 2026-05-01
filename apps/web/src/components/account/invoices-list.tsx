'use client';

import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { formatMoney } from '@/lib/utils';

type Tone = 'amber' | 'emerald' | 'rose' | 'slate';

const STATUS_TONE: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Draft', tone: 'slate' },
  ISSUED: { label: 'Issued', tone: 'amber' },
  PAID: { label: 'Paid', tone: 'emerald' },
  OVERDUE: { label: 'Overdue', tone: 'rose' },
  VOIDED: { label: 'Voided', tone: 'slate' },
  WRITTEN_OFF: { label: 'Written off', tone: 'slate' },
};

const TONE_CLASS: Record<Tone, string> = {
  amber: 'bg-amber-100 text-amber-900',
  emerald: 'bg-emerald-100 text-emerald-900',
  rose: 'bg-rose-100 text-rose-900',
  slate: 'bg-slate-100 text-slate-700',
};

export function InvoicesList({
  organizationId,
  locale,
}: {
  organizationId: string;
  locale: string;
}) {
  const list = trpc.organizations.invoices.list.useQuery({ organizationId });

  if (list.isLoading) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }
  if (list.error) {
    return <p className="text-sm text-error-600">{list.error.message}</p>;
  }
  if (!list.data || list.data.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
        No invoices yet. Once your team places NET-30 orders, invoices show up here.
      </div>
    );
  }

  return (
    <ul className="divide-y rounded-lg border border-slate-200 bg-white">
      {list.data.map((inv) => {
        const effectiveStatus = inv.isOverdue ? 'OVERDUE' : inv.status;
        const tone = STATUS_TONE[effectiveStatus] ?? STATUS_TONE.DRAFT!;
        return (
          <li key={inv.id}>
            <Link
              href={`/${locale}/account/organization/invoices/${inv.id}`}
              className="flex items-center justify-between gap-4 p-4 hover:bg-stone-50"
            >
              <div className="min-w-0">
                <p className="font-mono text-sm text-slate-900">{inv.invoiceNumber}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {inv._count.orders} {inv._count.orders === 1 ? 'order' : 'orders'}
                  {inv.issuedAt && (
                    <> · issued {new Date(inv.issuedAt).toLocaleDateString()}</>
                  )}
                  {inv.dueAt && !inv.paidAt && (
                    <> · due {new Date(inv.dueAt).toLocaleDateString()}</>
                  )}
                  {inv.paidAt && (
                    <> · paid {new Date(inv.paidAt).toLocaleDateString()}</>
                  )}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <p className="text-sm font-semibold tabular-nums text-slate-900">
                  {formatMoney(inv.totalMinor, inv.currency)}
                </p>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${TONE_CLASS[tone.tone]}`}
                >
                  {tone.label}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
