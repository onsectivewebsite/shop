'use client';

import Link from 'next/link';
import { Card, CardContent } from '@onsective/ui';
import { trpc } from '@/lib/trpc';
import { InvoicesList } from './invoices-list';

/**
 * Per-organization invoice surface for buyers. Shows one section per org the
 * user belongs to. Each section reuses `<InvoicesList>` which fetches its own
 * data — keeps the parent simple and lets React Query cache per-org.
 */
export function OrgInvoices({ locale }: { locale: string }) {
  const list = trpc.organizations.my.useQuery();

  if (list.isLoading) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }
  if (!list.data || list.data.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6">
          <p className="text-sm text-slate-700">
            You're not a member of any organization yet.
          </p>
          <Link
            href={`/${locale}/account/organization`}
            className="text-sm font-medium text-slate-900 underline-offset-4 hover:underline"
          >
            Create one →
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {list.data.map((m) => (
        <section key={m.organization.id} className="space-y-3">
          <header className="flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {m.organization.legalName}
              </h2>
              <p className="text-xs text-slate-500">
                {m.organization.paymentTerms?.toLowerCase().replace(/_/g, ' ') ?? 'standard payment terms'}
                {' · '}
                you are {m.role.toLowerCase()}
              </p>
            </div>
          </header>
          <InvoicesList organizationId={m.organization.id} locale={locale} />
        </section>
      ))}
    </div>
  );
}
