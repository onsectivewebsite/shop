import { NextResponse } from 'next/server';
import { probePostgres, probeRedis } from '@/server/health';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const [pg, rd] = await Promise.all([probePostgres(), probeRedis()]);
  const ok = pg.ok && rd.ok;
  return NextResponse.json(
    {
      ok,
      service: 'console',
      postgres: pg.ok ? { ok: true, latencyMs: pg.latencyMs } : { ok: false },
      redis: rd.ok ? { ok: true, latencyMs: rd.latencyMs } : { ok: false },
      timestamp: new Date().toISOString(),
    },
    {
      status: ok ? 200 : 503,
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    },
  );
}
