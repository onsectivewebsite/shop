import type { MetadataRoute } from 'next';

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://itsnottechy.cloud';

/**
 * Allow general crawl; block paths that either leak session-y state or
 * have nothing useful to index. Cart/checkout/account are gated by auth
 * anyway, but blocking saves crawl budget.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/account/',
          '/cart',
          '/checkout/',
          '/security/',
          '/impersonate/',
          '/u/', // unsubscribe-token redirect
          '/r/', // referral cookie-set redirect
          '/e/', // email open/click tracking
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
