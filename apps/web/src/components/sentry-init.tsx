'use client';

import { useEffect } from 'react';

/**
 * Browser-side Sentry init. Mounts once at the top of the layout tree.
 * No-op when NEXT_PUBLIC_SENTRY_DSN is unset, so dev runs without a DSN
 * pay zero runtime cost beyond the empty effect.
 */
export function SentryInit() {
  useEffect(() => {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) return;
    let cancelled = false;
    import('@sentry/nextjs').then((Sentry) => {
      if (cancelled) return;
      Sentry.init({
        dsn,
        environment: process.env.NEXT_PUBLIC_SENTRY_ENV ?? 'production',
        tracesSampleRate: 0.1,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
        sendDefaultPii: false,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
