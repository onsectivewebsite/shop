import Link from 'next/link';
import { prisma } from '@onsective/db';
import { Badge, Card, CardContent } from '@onsective/ui';

export const metadata = { title: 'Organizations · Console' };

export default async function ConsoleOrgsPage() {
  const [pending, approved] = await Promise.all([
    prisma.organization.findMany({
      where: { approvedAt: null, suspendedAt: null },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { members: true, taxExemptions: true } } },
      take: 100,
    }),
    prisma.organization.count({ where: { approvedAt: { not: null } } }),
  ]);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Organizations</h1>
      <p className="mt-1 text-sm text-slate-500">
        {pending.length} pending · {approved} approved
      </p>

      {pending.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-12 text-center text-sm text-slate-500">
            No pending organizations. ✅
          </CardContent>
        </Card>
      ) : (
        <ul className="mt-6 space-y-3">
          {pending.map((o) => (
            <li key={o.id}>
              <Link
                href={`/dashboard/orgs/${o.id}`}
                className="block rounded-lg border border-slate-200 bg-white p-5 hover:border-brand-400"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{o.legalName}</p>
                    <p className="text-xs text-slate-600">
                      {o.countryCode}
                      {o.taxId ? ` · Tax ID: ${o.taxId}` : ''} ·{' '}
                      {o._count.members} member{o._count.members === 1 ? '' : 's'}
                      {o._count.taxExemptions
                        ? ` · ${o._count.taxExemptions} tax cert${o._count.taxExemptions === 1 ? '' : 's'}`
                        : ''}
                    </p>
                    <p className="text-xs text-slate-500">
                      Submitted {o.createdAt.toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="warning">PENDING</Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
