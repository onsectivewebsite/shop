'use client';

import { useEffect } from 'react';

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
