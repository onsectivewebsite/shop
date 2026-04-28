/**
 * Next.js calls this once on server boot. Conventional location for runtime
 * observability init (Sentry, OpenTelemetry, etc).
 *
 * Sentry is initialized lazily — the package is in deps but only imported
 * when SENTRY_DSN is set, so dev runs without DSN don't pay the bundle cost.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  const Sentry = await import('@sentry/nextjs');
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    // Don't ship default PII — orderIds and userIds are explicit on tags.
    sendDefaultPii: false,
  });
}
