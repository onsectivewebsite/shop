import { notFound } from 'next/navigation';
import { prisma } from '@onsective/db';
import { Badge, Card, CardContent, Button } from '@onsective/ui';
import {
  approveOrgAction,
  suspendOrgAction,
  approveTaxExemptionAction,
} from './actions';

export const metadata = { title: 'Organization · Console' };

export default async function ConsoleOrgDetail({ params }: { params: { id: string } }) {
  const org = await prisma.organization.findUnique({
    where: { id: params.id },
    include: {
      members: {
        orderBy: { invitedAt: 'asc' },
        include: { user: { select: { email: true, fullName: true } } },
      },
      taxExemptions: { orderBy: { createdAt: 'desc' } },
      _count: { select: { orders: true, invoices: true, members: true } },
    },
  });
  if (!org) notFound();

  const isPending = !org.approvedAt;
  const isSuspended = !!org.suspendedAt;

  return (
    <div className="p-8">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{org.legalName}</h1>
          <p className="text-sm text-slate-500">
            {org.countryCode}
            {org.taxId ? ` · ${org.taxId}` : ''} · {org._count.members} member
            {org._count.members === 1 ? '' : 's'}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge
              variant={
                isSuspended ? 'error' : isPending ? 'warning' : 'success'
              }
            >
              {isSuspended ? 'SUSPENDED' : isPending ? 'PENDING' : 'APPROVED'}
            </Badge>
            <Badge variant="outline">{org.paymentTerms}</Badge>
            {org.discountPctBps > 0 && (
              <Badge variant="outline">{(org.discountPctBps / 100).toFixed(2)}% discount</Badge>
            )}
          </div>
        </div>

        {isPending && (
          <form
            action={approveOrgAction.bind(null, org.id)}
            className="space-y-2 rounded-md border border-slate-200 bg-white p-4 text-sm"
          >
            <p className="font-semibold">Approve organization</p>
            <label className="flex items-center gap-2 text-xs">
              Payment terms:
              <select
                name="paymentTerms"
                className="rounded-md border border-slate-300 px-2 py-1 text-xs"
              >
                <option value="STRIPE_IMMEDIATE">Stripe immediate</option>
                <option value="NET_30">Net-30</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs">
              Credit limit (USD, optional):
              <input
                name="creditLimit"
                type="number"
                step="0.01"
                placeholder="e.g. 50000"
                className="w-32 rounded-md border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="flex items-center gap-2 text-xs">
              Discount %:
              <input
                name="discountPct"
                type="number"
                step="0.01"
                placeholder="0"
                className="w-20 rounded-md border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <Button type="submit" variant="cta" size="sm">
              Approve
            </Button>
          </form>
        )}
      </header>

      {!isPending && !isSuspended && (
        <details className="mt-6 rounded-md border border-slate-200 bg-white p-3 text-sm">
          <summary className="cursor-pointer font-medium text-error-700">Suspend…</summary>
          <form action={suspendOrgAction.bind(null, org.id)} className="mt-2 space-y-2">
            <textarea
              name="reason"
              required
              rows={2}
              maxLength={500}
              placeholder="Reason"
              className="w-full rounded-md border border-slate-300 p-2 text-xs"
            />
            <Button type="submit" variant="destructive" size="sm">
              Confirm suspend
            </Button>
          </form>
        </details>
      )}

      <h2 className="mt-12 text-xl font-semibold">Members</h2>
      <ul className="mt-4 divide-y rounded-lg border border-slate-200 bg-white">
        {org.members.map((m) => (
          <li key={m.id} className="flex items-center justify-between p-4 text-sm">
            <div>
              <p className="font-medium">{m.user.fullName ?? m.user.email}</p>
              <p className="text-xs text-slate-500">{m.user.email}</p>
            </div>
            <Badge>{m.role}</Badge>
          </li>
        ))}
      </ul>

      <h2 className="mt-12 text-xl font-semibold">Tax exemptions</h2>
      {org.taxExemptions.length === 0 ? (
        <Card className="mt-4">
          <CardContent className="p-8 text-center text-sm text-slate-500">
            No tax certificates uploaded.
          </CardContent>
        </Card>
      ) : (
        <ul className="mt-4 space-y-3">
          {org.taxExemptions.map((tx) => (
            <li key={tx.id}>
              <Card>
                <CardContent className="flex items-start justify-between gap-4 p-4">
                  <div>
                    <p className="text-sm font-medium">
                      {tx.jurisdiction ?? 'Federal/National'}
                      {tx.certificateNumber ? ` · ${tx.certificateNumber}` : ''}
                    </p>
                    <p className="font-mono text-xs text-slate-500">{tx.certificateKey}</p>
                    <p className="text-xs text-slate-500">
                      Valid from {tx.validFrom.toLocaleDateString()}
                      {tx.validUntil ? ` until ${tx.validUntil.toLocaleDateString()}` : ' (no expiry)'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        tx.status === 'APPROVED'
                          ? 'success'
                          : tx.status === 'REJECTED'
                            ? 'error'
                            : 'warning'
                      }
                    >
                      {tx.status}
                    </Badge>
                    {tx.status === 'PENDING' && (
                      <form
                        action={approveTaxExemptionAction.bind(null, org.id, tx.id)}
                      >
                        <Button type="submit" variant="cta" size="sm">
                          Approve cert
                        </Button>
                      </form>
                    )}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
