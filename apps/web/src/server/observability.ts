import { randomBytes } from 'node:crypto';

/**
 * Lightweight observability primitives. Sentry is initialized via the SDK's
 * recommended `instrumentation.ts` hook (Next.js convention) — this module
 * owns request-id minting + structured logging helpers, plus a thin shim
 * to tag the active Sentry scope with a requestId so events and tRPC logs
 * correlate.
 *
 * Why no winston/pino: stdout JSON is enough for CloudWatch/Datadog/Loki.
 * Add structured-logging deps when we need sampling or async transport.
 */

export function newRequestId(): string {
  // 12 bytes → 16-char base64url. Short enough for trace headers, long
  // enough to dedupe at our request volume.
  return randomBytes(12).toString('base64url');
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export function log(level: LogLevel, message: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    message,
    ...fields,
  });
  // eslint-disable-next-line no-console
  if (level === 'error' || level === 'warn') console.error(line);
  else console.log(line);
}

/**
 * Tag the active Sentry scope with the requestId so any errors captured during
 * this request are filterable. Lazy import + DSN guard keeps it free when
 * Sentry isn't configured.
 */
export async function tagRequest(requestId: string, userId: string | null): Promise<void> {
  if (!process.env.SENTRY_DSN) return;
  try {
    const Sentry = await import('@sentry/nextjs');
    Sentry.getCurrentScope().setTag('requestId', requestId);
    if (userId) Sentry.getCurrentScope().setUser({ id: userId });
  } catch {
    // Sentry init failed; logging continues normally.
  }
}
