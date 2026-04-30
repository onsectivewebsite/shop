/**
 * Next.js calls this once on server boot. Conventional location for runtime
 * observability init.
 *
 * Sentry is initialized lazily — the package is in deps but only imported
 * when SENTRY_DSN is set, so dev runs without a DSN don't pay the bundle cost.
 * Both the Node.js runtime (route handlers, RSC) and Edge runtime (middleware,
 * edge routes) get the same init shape.
 */
export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  const Sentry = await import('@sentry/nextjs');
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    sendDefaultPii: false,
  });
}
