import { redirect } from 'next/navigation';
import { Card, CardContent, Badge } from '@onsective/ui';
import { Database, Activity, ListTodo, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getConsoleSession } from '@/server/auth';
import { probePostgres, probeRedis, probeAllQueues, type QueueSnapshot } from '@/server/health';

export const metadata = { title: 'System health · Console' };
export const dynamic = 'force-dynamic';

const STALE_QUEUE_MS = 5 * 60 * 1000; // queue with active jobs but nothing completed in 5min = suspicious

export default async function HealthPage() {
  const session = await getConsoleSession();
  if (!session) redirect('/login');

  const [pg, redis, queues] = await Promise.all([
    probePostgres(),
    probeRedis(),
    probeAllQueues(),
  ]);

  const overallOk =
    pg.ok && redis.ok && queues.every((q) => q.ok && q.failed === 0);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">System health</h1>
          <p className="mt-1 text-sm text-slate-500">
            Live probes against Postgres, Redis, and the BullMQ queues.
          </p>
        </div>
        <Badge variant={overallOk ? 'success' : 'warning'}>
          {overallOk ? 'All systems normal' : 'Degraded'}
        </Badge>
      </div>

      {/* Datastore probes */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <ProbeCard
          icon={Database}
          name="Postgres"
          probe={pg}
          ok={`${pg.ok && pg.latencyMs}ms round-trip`}
        />
        <ProbeCard
          icon={Activity}
          name="Redis"
          probe={redis}
          ok={`${redis.ok && redis.latencyMs}ms ping`}
        />
      </div>

      {/* Queue snapshots */}
      <h2 className="mt-12 text-lg font-semibold text-slate-900">BullMQ queues</h2>
      <p className="mt-1 text-sm text-slate-500">
        3 queues serve the worker fleet. Failed-count above zero usually means a bad job
        payload — open the failing job in <code className="font-mono">redis-cli</code> or
        clear via the seller portal.
      </p>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {queues.map((q) => (
          <QueueCard key={q.name} snapshot={q} />
        ))}
      </div>

      {/* Help */}
      <Card className="mt-12">
        <CardContent className="space-y-2 p-6 text-sm text-slate-600">
          <p className="font-semibold text-slate-900">Reading this page</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Postgres latency above ~100ms locally usually means Prisma is starting a
              cold connection — refresh once and it should drop to single-digit ms.
            </li>
            <li>
              Redis above ~10ms suggests network hops between the app and the Redis box,
              or a queue stuck holding a long-running connection.
            </li>
            <li>
              <strong>active</strong> jobs without progress for 5+ minutes likely means a
              worker crashed mid-job. Inspect with <code className="font-mono">pm2 logs</code>.
            </li>
            <li>
              <strong>failed</strong> jobs need a human. Image-variants failures are often
              S3 perm issues. Search-index failures are usually OpenSearch downtime.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function ProbeCard({
  icon: Icon,
  name,
  probe,
  ok,
}: {
  icon: typeof Database;
  name: string;
  probe: { ok: boolean; latencyMs?: number; error?: string };
  ok: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-md ${
                probe.ok ? 'bg-success-50 text-success-600' : 'bg-error-50 text-error-600'
              }`}
            >
              <Icon size={18} strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">{name}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {probe.ok ? ok : 'Unreachable'}
              </p>
            </div>
          </div>
          {probe.ok ? (
            <CheckCircle2 size={18} strokeWidth={2} className="text-success-600" />
          ) : (
            <AlertCircle size={18} strokeWidth={2} className="text-error-600" />
          )}
        </div>
        {!probe.ok && probe.error && (
          <p className="mt-3 break-all rounded bg-error-50 p-2 font-mono text-xs text-error-700">
            {probe.error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function QueueCard({ snapshot }: { snapshot: QueueSnapshot }) {
  const tone =
    !snapshot.ok || snapshot.failed > 0
      ? 'error'
      : snapshot.active > 0 && snapshot.lastCompletedAt &&
          Date.now() - snapshot.lastCompletedAt > STALE_QUEUE_MS
        ? 'warning'
        : 'success';

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-md ${
                tone === 'error'
                  ? 'bg-error-50 text-error-600'
                  : tone === 'warning'
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-success-50 text-success-600'
              }`}
            >
              <ListTodo size={18} strokeWidth={1.75} />
            </span>
            <div>
              <p className="font-mono text-sm font-semibold text-slate-900">
                {snapshot.name}
              </p>
              {snapshot.ok ? (
                <p className="text-xs text-slate-500">
                  {snapshot.waiting + snapshot.active + snapshot.delayed} in flight
                </p>
              ) : (
                <p className="text-xs text-error-600">Unreachable</p>
              )}
            </div>
          </div>
          <Badge variant={tone}>{tone === 'success' ? 'OK' : tone}</Badge>
        </div>

        {snapshot.ok && (
          <>
            <dl className="grid grid-cols-3 gap-2 text-xs">
              <Stat label="Waiting" value={snapshot.waiting} />
              <Stat label="Active" value={snapshot.active} />
              <Stat label="Delayed" value={snapshot.delayed} />
              <Stat label="Completed" value={snapshot.completed} />
              <Stat label="Failed" value={snapshot.failed} tone={snapshot.failed > 0 ? 'error' : undefined} />
              <Stat label="Paused" value={snapshot.paused} />
            </dl>

            <div className="space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
              <p>
                Last completed:{' '}
                <span className="text-slate-700">
                  {snapshot.lastCompletedAt
                    ? new Date(snapshot.lastCompletedAt).toUTCString()
                    : 'never'}
                </span>
              </p>
              <p>
                Last failed:{' '}
                <span className="text-slate-700">
                  {snapshot.lastFailedAt
                    ? new Date(snapshot.lastFailedAt).toUTCString()
                    : 'never'}
                </span>
              </p>
            </div>
          </>
        )}

        {!snapshot.ok && snapshot.error && (
          <p className="break-all rounded bg-error-50 p-2 font-mono text-xs text-error-700">
            {snapshot.error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'error';
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-slate-500">{label}</dt>
      <dd
        className={`mt-0.5 font-mono text-sm font-semibold tabular-nums ${
          tone === 'error' ? 'text-error-600' : 'text-slate-900'
        }`}
      >
        {value.toLocaleString()}
      </dd>
    </div>
  );
}
