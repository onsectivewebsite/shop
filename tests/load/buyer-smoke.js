// Buyer-app smoke load test. Run with k6 (https://k6.io/docs/get-started/installation/):
//
//   pnpm load:smoke                              # against http://localhost:3000
//   BASE_URL=https://itsnottechy.cloud pnpm load:smoke
//
// Exercises the read-heavy hot paths a real visitor hits in the first minute:
// homepage → search → category → PDP → best-sellers. The PDP slug is one of
// the demo-seed products; the load script assumes `pnpm db:seed:demo` has
// been run if pointing at a non-prod environment.
//
// Acceptance gate (k6 thresholds): p95 < 500ms across all stages, fewer than
// 1% non-2xx responses. The thresholds make `k6 run` exit non-zero on
// breach, which is enough for a manual or CI smoke test.

import http from 'k6/http';
import { check, sleep, group } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Stable demo seed slug — keep in sync with packages/db/prisma/demo-seed.ts.
const PDP_SLUG = __ENV.PDP_SLUG || 'lumen-aurora-wireless-headphones';
const SEARCH_QUERY = __ENV.SEARCH_QUERY || 'lumen';
const CATEGORY_SLUG = __ENV.CATEGORY_SLUG || 'electronics';

export const options = {
  // 60s ramp to 100 VUs, 5min steady, 30s ramp-down. Approximates the burst
  // pattern of a small launch (Hacker News front page or a ProductHunt slot).
  stages: [
    { duration: '60s', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    // Page p95 budget. Tighter than the Cloudflare/CDN we'll have in prod —
    // intentionally so the gate catches origin slowness early.
    http_req_duration: ['p(95)<500'],
    // Allow a tiny error rate for transient 502s during deploys; everything
    // else should be 2xx.
    http_req_failed: ['rate<0.01'],
    // Per-group thresholds let one slow page surface independently rather
    // than getting averaged out into the global stat.
    'http_req_duration{group:::homepage}': ['p(95)<400'],
    'http_req_duration{group:::pdp}': ['p(95)<500'],
    'http_req_duration{group:::search}': ['p(95)<700'],
  },
};

const HEADERS = {
  // Looks enough like a browser to dodge any future bot-blocking we add. k6
  // defaults to a generic UA string which Cloudflare's bot rules tend to flag.
  'User-Agent':
    'Mozilla/5.0 (k6-load-test) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
};

function get(path) {
  // tags arg goes to k6's metric labels — useful when the prom output is
  // sliced by URL family, not by the random query strings we tack on.
  return http.get(`${BASE_URL}${path}`, { headers: HEADERS });
}

export default function () {
  group('homepage', () => {
    const res = get('/en');
    check(res, { 'home 200': (r) => r.status === 200 });
  });
  sleep(1);

  group('search', () => {
    const res = get(`/en/search?q=${encodeURIComponent(SEARCH_QUERY)}`);
    check(res, { 'search 200': (r) => r.status === 200 });
  });
  sleep(1);

  group('category', () => {
    const res = get(`/en/category/${CATEGORY_SLUG}`);
    check(res, { 'category 200': (r) => r.status === 200 });
  });
  sleep(1);

  group('pdp', () => {
    const res = get(`/en/product/${PDP_SLUG}`);
    check(res, { 'pdp 200': (r) => r.status === 200 });
  });
  sleep(1);

  group('best-sellers', () => {
    const res = get('/en/best-sellers');
    check(res, { 'best-sellers 200': (r) => r.status === 200 });
  });
  sleep(1);
}
