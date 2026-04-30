/* eslint-disable no-restricted-globals */
/**
 * Onsective service worker.
 *
 * Strategy is conservative on purpose:
 *   - Precache nothing beyond the offline shell — every page change can roll
 *     out without bumping a version hash.
 *   - HTML and JSON responses always go to the network. Caching them would
 *     leak logged-out HTML to logged-in users (and vice-versa) and stale
 *     order/cart state.
 *   - Versioned static assets under /_next/static/* and /icon* are
 *     immutable, so they get a stale-while-revalidate cache.
 *   - When the network fails on a navigation we fall back to /offline.html
 *     (a tiny static page in /public). All other requests bubble the error.
 *
 * Bump SW_VERSION when changing this file so the new worker activates and
 * old caches are dropped.
 */

const SW_VERSION = 'v1';
const STATIC_CACHE = `onsective-static-${SW_VERSION}`;
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll([OFFLINE_URL])),
  );
  // Activate immediately so the first navigation after install benefits.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith('onsective-') && k !== STATIC_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icon') ||
    url.pathname === '/manifest.webmanifest'
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Skip cross-origin (Stripe, Sentry, S3 images) — let the browser handle.
  if (url.origin !== self.location.origin) return;

  if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(networkFirstWithOfflineFallback(req));
  }
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached ?? fetchPromise;
}

async function networkFirstWithOfflineFallback(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(STATIC_CACHE);
    const offline = await cache.match(OFFLINE_URL);
    return offline ?? new Response('Offline.', { status: 503 });
  }
}
