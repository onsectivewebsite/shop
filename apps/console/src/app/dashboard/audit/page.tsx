import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@onsective/db';
import type { Prisma } from '@onsective/db';
import { Card, CardContent, Badge } from '@onsective/ui';
import { getConsoleSession } from '@/server/auth';

export const metadata = { title: 'Audit log · Console' };

const PER_PAGE = 50;

function actionTone(action: string): 'success' | 'error' | 'warning' | undefined {
  if (action.endsWith('.approve') || action.endsWith('.reactivate') || action === 'console.login') {
    return 'success';
  }
  if (
    action.endsWith('.reject') ||
    action.endsWith('.suspend') ||
    action.endsWith('.delete') ||
    action.endsWith('.refund')
  ) {
    return 'error';
  }
  if (action.endsWith('.view') || action.endsWith('.send') || action.endsWith('.update')) {
    return 'warning';
  }
  return undefined;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: {
    actor?: string;
    action?: string;
    target?: string;
    targetType?: string;
    from?: string;
    to?: string;
    page?: string;
  };
}) {
  const session = await getConsoleSession();
  if (!session) redirect('/login');

  const page = Math.max(1, Number(searchParams.page) || 1);
  const where: Prisma.AuditLogWhereInput = {};

  if (searchParams.actor) where.actorId = searchParams.actor;
  if (searchParams.action) where.action = { contains: searchParams.action, mode: 'insensitive' };
  if (searchParams.target) where.targetId = searchParams.target;
  if (searchParams.targetType) where.targetType = searchParams.targetType;

  const dateFilter: Prisma.DateTimeFilter = {};
  if (searchParams.from) {
    const d = new Date(searchParams.from);
    if (!isNaN(d.getTime())) dateFilter.gte = d;
  }
  if (searchParams.to) {
    const d = new Date(searchParams.to);
    if (!isNaN(d.getTime())) dateFilter.lte = d;
  }
  if (dateFilter.gte || dateFilter.lte) where.createdAt = dateFilter;

  const [items, total, distinctActions] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.auditLog.count({ where }),
    // Top-50 distinct actions for the dropdown — fast even with millions of rows
    prisma.auditLog.groupBy({
      by: ['action'],
      orderBy: { _count: { action: 'desc' } },
      take: 50,
    }),
  ]);

  // Resolve actor IDs to emails in one batch
  const actorIds = Array.from(new Set(items.map((i) => i.actorId).filter(Boolean) as string[]));
  const actors = actorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, email: true, fullName: true },
      })
    : [];
  const actorById = new Map(actors.map((a) => [a.id, a]));

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit log</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every action a console user takes. {total.toLocaleString()} events match.
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <form className="mt-6 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-3 lg:grid-cols-6">
        <Field label="Actor user ID">
          <input
            name="actor"
            defaultValue={searchParams.actor ?? ''}
            placeholder="user_…"
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm font-mono"
          />
        </Field>
        <Field label="Action contains">
          <input
            name="action"
            defaultValue={searchParams.action ?? ''}
            placeholder="seller.kyc"
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
            list="action-suggestions"
          />
          <datalist id="action-suggestions">
            {distinctActions.map((a) => (
              <option key={a.action} value={a.action} />
            ))}
          </datalist>
        </Field>
        <Field label="Target type">
          <select
            name="targetType"
            defaultValue={searchParams.targetType ?? ''}
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
          >
            <option value="">Any</option>
            <option value="user">user</option>
            <option value="seller">seller</option>
            <option value="kycDocument">kycDocument</option>
            <option value="order">order</option>
            <option value="orderItem">orderItem</option>
            <option value="return">return</option>
            <option value="ticket">ticket</option>
            <option value="organization">organization</option>
          </select>
        </Field>
        <Field label="Target ID">
          <input
            name="target"
            defaultValue={searchParams.target ?? ''}
            placeholder="cuid"
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm font-mono"
          />
        </Field>
        <Field label="From">
          <input
            type="date"
            name="from"
            defaultValue={searchParams.from ?? ''}
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
          />
        </Field>
        <Field label="To">
          <input
            type="date"
            name="to"
            defaultValue={searchParams.to ?? ''}
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
          />
        </Field>
        <div className="sm:col-span-3 lg:col-span-6 flex justify-end gap-2">
          <Link
            href="/dashboard/audit"
            className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:border-slate-500"
          >
            Reset
          </Link>
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
          >
            Search
          </button>
        </div>
      </form>

      {/* Results */}
      {items.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-12 text-center text-sm text-slate-500">
            No events match these filters.
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((row) => {
                const actor = row.actorId ? actorById.get(row.actorId) : null;
                const tone = actionTone(row.action);
                return (
                  <tr key={row.id} className="align-top hover:bg-slate-50">
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                      {row.createdAt.toUTCString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {actor ? (
                        <Link
                          href={`/dashboard/users/${actor.id}`}
                          className="font-medium text-brand-700 hover:underline"
                        >
                          {actor.fullName ?? actor.email}
                        </Link>
                      ) : (
                        <span className="text-slate-400">{row.actorType}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={tone}>{row.action}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {row.targetType && row.targetId ? (
                        <>
                          <p className="text-slate-500">{row.targetType}</p>
                          <p className="font-mono">{row.targetId}</p>
                        </>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {row.metadata ? (
                        <details>
                          <summary className="cursor-pointer text-slate-600">view</summary>
                          <pre className="mt-2 max-w-md whitespace-pre-wrap break-all rounded bg-slate-100 p-2 font-mono text-[11px] text-slate-700">
                            {JSON.stringify(row.metadata, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="mt-6 flex items-center justify-between text-sm">
          <p className="text-slate-500">
            Page {page} of {totalPages} · {PER_PAGE} per page
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={pageUrl(searchParams, page - 1)}
                className="rounded-md border border-slate-300 px-3 py-1.5 hover:border-slate-500"
              >
                ← Prev
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={pageUrl(searchParams, page + 1)}
                className="rounded-md border border-slate-300 px-3 py-1.5 hover:border-slate-500"
              >
                Next →
              </Link>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-slate-700">
      <span className="block">{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function pageUrl(
  params: Record<string, string | undefined>,
  page: number,
): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k === 'page' || !v) continue;
    search.set(k, v);
  }
  search.set('page', String(page));
  return `/dashboard/audit?${search.toString()}`;
}
