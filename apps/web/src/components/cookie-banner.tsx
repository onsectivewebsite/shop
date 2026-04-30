'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

const COOKIE_NAME = 'cookie_consent';
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

type Consent = 'accepted' | 'essential';

function readConsent(): Consent | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  const value = match.slice(COOKIE_NAME.length + 1);
  return value === 'accepted' || value === 'essential' ? (value as Consent) : null;
}

function writeConsent(value: Consent): void {
  // Lax + non-Secure works on http://localhost during dev; the browser
  // upgrades to Secure automatically on https.
  document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}

export function CookieBanner() {
  const t = useTranslations('cookieBanner');
  // Render nothing on first paint — we only know whether the cookie is set
  // after mount. Avoids a flash for users who already chose, and a hydration
  // mismatch from reading document.cookie during SSR.
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(readConsent() === null);
  }, []);

  if (!show) return null;

  function decide(value: Consent) {
    writeConsent(value);
    setShow(false);
  }

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={t('headline')}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur md:px-8"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1 text-sm">
          <p className="font-medium text-slate-900">{t('headline')}</p>
          <p className="text-slate-600">
            {t('body')}{' '}
            <Link
              href="/legal/cookies"
              className="font-medium text-slate-900 underline-offset-4 hover:underline"
            >
              {t('learnMore')}
            </Link>
          </p>
        </div>
        <div className="flex flex-shrink-0 gap-2">
          <button
            type="button"
            onClick={() => decide('essential')}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
          >
            {t('essentialOnly')}
          </button>
          <button
            type="button"
            onClick={() => decide('accepted')}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
          >
            {t('acceptAll')}
          </button>
        </div>
      </div>
    </div>
  );
}
