import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@onsective/db';
import type { Prisma } from '@onsective/db';
import { Card, CardContent, Badge } from '@onsective/ui';
import { getConsoleSession } from '@/server/auth';
import { retryWebhookAction, markResolvedAction } from './actions';

export const metadata = { title: 'Webhooks · Console' };

const PER_PAGE = 50;

export default async function WebhooksPage({
  searchParams,
}: {
  searchParams: { source?: string; status?: string; eventType?: string; page?: string };
}) {
  const session = await getConsoleSession();
  if (!session) redirect('/login');

  const page = Math.max(1, Number(searchParams.page) || 1);
  const where: Prisma.WebhookEventWhereInput = {};

  if (searchParams.source) where.source = searchParams.source;
  if (searchParams.eventType) {
    where.eventType = { contains: searchParams.eventType, mode: 'insensitive' };
  }

  // Tri-state status filter:
  // - 'failed': has error AND not processed
  // - 'pending': not processed AND no error
  // - 'processed': processed
  const status = searchParams.status ?? 'all';
  if (status === 'failed') {
    where.processedAt = null;
    where.error = { not: null };
  } else if (status === 'pending') {
    where.processedAt = null;
    where.error = null;
  } else if (status === 'processed') {
    where.processedAt = { not: null };
  }

  const [items, total, counts, distinctTypes] = await Promise.all([
    prisma.webhookEvent.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.webhookEvent.count({ where }),
    Promise.all([
      prisma.webhookEvent.count({ where: { processedAt: null, error: { not: null } } }),
      prisma.webhookEvent.count({ where: { processedAt: null, error: null } }),
      prisma.webhookEvent.count({ where: { processedAt: { not: null } } }),
    ]),
    prisma.webhookEvent.groupBy({
      by: ['eventType'],
      orderBy: { _count: { eventType: 'desc' } },
      take: 50,
    }),
  ]);
  const [failedCount, pendingCount, processedCount] = counts;

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-900">Webhook events</h1>
      <p className="mt-1 text-sm text-slate-500">
        Stripe + EasyPost ingress, deduped by externalId. Retry stuck events here.
      </p>

      {/* Status pills */}
      <div className="mt-6 flex flex-wrap gap-2">
        <StatusPill href="/dashboard/webhooks?status=failed" label="Failed" count={failedCount} active={status === 'failed'} tone="error" />
        <StatusPill href="/dashboard/webhooks?status=pending" label="Pending" count={pendingCount} active={status === 'pending'} tone="warning" />
        <StatusPill href="/dashboard/webhooks?status=processed" label="Processed" count={processedCount} active={status === 'processed'} tone="success" />
        <StatusPill href="/dashboard/webhooks" label="All" count={failedCount + pendingCount + processedCount} active={status === 'all'} />
      </div>

      {/* Filters */}
      <form className="mt-6 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-3">
        <input type="hidden" name="status" value={status === 'all' ? '' : status} />
        <Field label="Source">
          <select
            name="source"
            defaultValue={searchParams.source ?? ''}
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
          >
            <option value="">Any</option>
            <option value="stripe">stripe</option>
            <option value="easypost">easypost</option>
            <option value="shippo">shippo</option>
          </select>
        </Field>
        <Field label="Event type contains">
          <input
            name="eventType"
            defaultValue={searchParams.eventType ?? ''}
            placeholder="payment_intent.succeeded"
            list="webhook-types"
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm font-mono"
          />
          <datalist id="webhook-types">
            {distinctTypes.map((t) => (
              <option key={t.eventType} value={t.eventType} />
            ))}
          </datalist>
        </Field>
        <div className="flex items-end justify-end gap-2">
          <Link
            href="/dashboard/webhooks"
            className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:border-slate-500"
          >
            Reset
          </Link>
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
          >
            Filter
          </button>
        </div>
      </form>

      {/* Results */}
      {items.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-12 text-center text-sm text-slate-500">
            No webhook events match.
          </CardContent>
        </Card>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((evt) => {
            const isFailed = !evt.processedAt && !!evt.error;
            const isPending = !evt.processedAt && !evt.error;
            return (
              <li key={evt.id}>
                <Card>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{evt.source}</Badge>
                          <span className="font-mono text-sm font-medium">{evt.eventType}</span>
                          {isFailed && <Badge variant="error">Failed · {evt.attempts} attempts</Badge>}
                          {isPending && <Badge variant="warning">Pending</Badge>}
                          {evt.processedAt && <Badge variant="success">Processed</Badge>}
                        </div>
                        <p className="mt-1 font-mono text-xs text-slate-500 break-all">
                          {evt.externalId}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Received {evt.receivedAt.toUTCString()}
                          {evt.processedAt && (
                            <>
                              {' · '}processed {evt.processedAt.toUTCString()}
                            </>
                          )}
                        </p>
                        {evt.error && (
                          <p className="mt-2 rounded border border-error-200 bg-error-50 p-2 font-mono text-xs text-error-700 break-all">
                            {evt.error}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        {isFailed && (
                          <form action={retryWebhookAction.bind(null, evt.id)}>
                            <button
                              type="submit"
                              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-500"
                            >
                              Reset for retry
                            </button>
                          </form>
                        )}
                        {!evt.processedAt && (
                          <form action={markResolvedAction.bind(null, evt.id)}>
                            <button
                              type="submit"
                              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-500"
                            >
                              Mark resolved
                            </button>
                          </form>
                        )}
                      </div>
                    </div>
                    <details>
                      <summary className="cursor-pointer text-xs text-slate-600">
                        View payload
                      </summary>
                      <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-100 p-3 font-mono text-[11px] text-slate-700">
                        {JSON.stringify(evt.payload, null, 2)}
                      </pre>
                    </details>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
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

function StatusPill({
  href,
  label,
  count,
  active,
  tone,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
  tone?: 'error' | 'warning' | 'success';
}) {
  const activeClass = active
    ? tone === 'error'
      ? 'bg-error-600 text-white'
      : tone === 'warning'
        ? 'bg-amber-500 text-white'
        : tone === 'success'
          ? 'bg-success-600 text-white'
          : 'bg-slate-900 text-white'
    : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-500';
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold ${activeClass}`}
    >
      {label}
      <span
        className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
          active ? 'bg-white/15' : 'bg-slate-100 text-slate-600'
        }`}
      >
        {count.toLocaleString()}
      </span>
    </Link>
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

function pageUrl(params: Record<string, string | undefined>, page: number): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k === 'page' || !v) continue;
    search.set(k, v);
  }
  search.set('page', String(page));
  return `/dashboard/webhooks?${search.toString()}`;
}
