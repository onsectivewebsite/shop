'use client';

import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { formatMoney } from '@/lib/utils';

/**
 * Print-friendly invoice detail. The grid layout collapses on print via
 * the `print:` Tailwind variants so the buyer can save a PDF directly
 * from the browser without us hosting a real PDF service yet.
 */
export function InvoiceDetail({
  organizationId,
  invoiceId,
  locale,
}: {
  organizationId: string;
  invoiceId: string;
  locale: string;
}) {
  const q = trpc.organizations.invoices.get.useQuery({ organizationId, invoiceId });

  if (q.isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (q.error) return <p className="text-sm text-error-600">{q.error.message}</p>;
  if (!q.data) return null;

  const inv = q.data;
  const status = inv.isOverdue ? 'OVERDUE' : inv.status;

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500">
            Invoice
          </p>
          <p className="mt-2 font-mono text-xl text-slate-900">{inv.invoiceNumber}</p>
          {inv.issuedAt && (
            <p className="mt-1 text-xs text-slate-500">
              Issued {new Date(inv.issuedAt).toLocaleDateString()}
              {inv.dueAt && (
                <> · Due {new Date(inv.dueAt).toLocaleDateString()}</>
              )}
            </p>
          )}
        </div>
        <StatusPill status={status} />
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Bill to
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {inv.organization.legalName}
          </p>
          {inv.organization.taxId && (
            <p className="text-xs text-slate-500">Tax ID: {inv.organization.taxId}</p>
          )}
          <p className="text-xs text-slate-500">{inv.organization.countryCode}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            From
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900">Onsective</p>
          <p className="text-xs text-slate-500">billing@onsective.com</p>
        </div>
      </div>

      <div className="mt-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Orders on this invoice
        </p>
        <ul className="mt-3 divide-y border-y border-slate-200">
          {inv.orders.map((o) => (
            <li key={o.id} className="space-y-3 py-4">
              <div className="flex items-center justify-between gap-3">
                <Link
                  href={`/${locale}/account/orders/${o.orderNumber}`}
                  className="font-mono text-sm text-slate-900 hover:underline"
                >
                  {o.orderNumber}
                </Link>
                <span className="text-sm tabular-nums text-slate-700">
                  {formatMoney(o.totalAmount, o.currency)}
                </span>
              </div>
              <ul className="space-y-1 text-xs text-slate-600">
                {o.items.map((it) => (
                  <li key={it.id} className="flex justify-between gap-3">
                    <span>
                      {it.productTitle}
                      {it.variantTitle ? ` · ${it.variantTitle}` : ''} × {it.qty}
                    </span>
                    <span className="tabular-nums">
                      {formatMoney(it.lineSubtotal, o.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>

      <dl className="ml-auto mt-8 max-w-xs space-y-2 text-sm">
        <Row label="Subtotal" value={formatMoney(inv.subtotalMinor, inv.currency)} />
        <Row label="Tax" value={formatMoney(inv.taxMinor, inv.currency)} />
        <div className="border-t border-slate-200 pt-2">
          <Row
            label="Total"
            value={formatMoney(inv.totalMinor, inv.currency)}
            bold
          />
        </div>
        {inv.paidAt && (
          <p className="pt-2 text-right text-xs text-emerald-700">
            Paid {new Date(inv.paidAt).toLocaleDateString()}
          </p>
        )}
      </dl>

      <div className="mt-10 flex flex-wrap gap-3 print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Print / save as PDF
        </button>
        {inv.pdfUrl && (
          <a
            href={inv.pdfUrl}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Download PDF
          </a>
        )}
      </div>
    </article>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd
        className={`tabular-nums ${
          bold ? 'font-semibold text-slate-900' : 'text-slate-700'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

const STATUS_CLASS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  ISSUED: 'bg-amber-100 text-amber-900',
  PAID: 'bg-emerald-100 text-emerald-900',
  OVERDUE: 'bg-rose-100 text-rose-900',
  VOIDED: 'bg-slate-100 text-slate-700',
  WRITTEN_OFF: 'bg-slate-100 text-slate-700',
};

function StatusPill({ status }: { status: string }) {
  const label = status === 'WRITTEN_OFF' ? 'Written off' : status.toLowerCase();
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium capitalize ${
        STATUS_CLASS[status] ?? STATUS_CLASS.DRAFT
      }`}
    >
      {label}
    </span>
  );
}
