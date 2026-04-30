'use client';

import { useEffect } from 'react';

/**
 * Registers the buyer-app service worker once after first paint. Skips dev so
 * HMR isn't shadowed by a stale cache, and skips when the SW API isn't
 * available (very old browsers, or Safari with the feature disabled).
 *
 * The SW itself lives at /sw.js so the scope can be the whole site (`/`).
 * Browsers reject scopes broader than the worker's own URL.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('[sw] registration failed:', err);
      });
    };
    if (document.readyState === 'complete') onLoad();
    else window.addEventListener('load', onLoad, { once: true });
    return () => window.removeEventListener('load', onLoad);
  }, []);
  return null;
}
