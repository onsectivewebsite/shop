'use client';

import Link from 'next/link';
import { Button, Card, CardContent } from '@onsective/ui';
import { trpc } from '@/lib/trpc';

const STATUS_TONE: Record<string, string> = {
  OPEN: 'bg-cta-100 text-cta-800',
  PENDING_CUSTOMER: 'bg-amber-100 text-amber-800',
  PENDING_INTERNAL: 'bg-slate-100 text-slate-700',
  ON_HOLD: 'bg-slate-100 text-slate-700',
  RESOLVED: 'bg-emerald-100 text-emerald-800',
  CLOSED: 'bg-slate-200 text-slate-600',
  REOPENED: 'bg-cta-100 text-cta-800',
};

export default function SupportListPage() {
  const list = trpc.support.list.useQuery();

  if (list.isLoading) {
    return (
      <div className="container-page py-12">
        <p className="text-slate-500">Loading…</p>
      </div>
    );
  }

  const tickets = list.data ?? [];
  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500">
              Support
            </p>
            <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-slate-950">
              Your tickets
            </h1>
          </div>
          <Link href="/account/support/new">
            <Button variant="cta">New ticket</Button>
          </Link>
        </header>

        {tickets.length === 0 ? (
          <Card>
            <CardContent className="space-y-2 p-8 text-center">
              <p className="text-sm font-medium text-slate-900">No tickets yet.</p>
              <p className="text-sm text-slate-500">
                Got a question about an order, refund, or seller? Open a ticket and
                we&apos;ll get back to you.
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {tickets.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/account/support/${t.id}`}
                  className="flex flex-wrap items-center gap-3 p-4 transition-colors hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {t.subject}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      <span className="font-mono">{t.ticketNumber}</span>
                      {' · '}
                      Updated {new Date(t.updatedAt).toLocaleDateString()}
                      {!t.firstResponseAt && t.status === 'OPEN' && (
                        <span className="ml-2 text-amber-700">Awaiting first response</span>
                      )}
                    </p>
                  </div>
                  <span
                    className={`flex-none rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_TONE[t.status] ?? 'bg-slate-100 text-slate-700'}`}
                  >
                    {t.status.replaceAll('_', ' ')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
