import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const isProd = process.env.NODE_ENV === 'production';

// Buyer app CSP. 'unsafe-inline' for scripts + styles is pragmatic — Next 14
// inlines RSC payloads and Tailwind injects style elements, both of which
// would require nonces threaded through every page to remove. Tighten once
// we move to nonce-based CSP.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' https://js.stripe.com https://*.sentry.io",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://api.stripe.com https://m.stripe.network https://*.sentry.io",
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@onsective/ui', '@onsective/db'],
  experimental: {
    // Required on Next 14 for instrumentation.ts to fire on server boot.
    // Stable in 15.x — drop this flag when we upgrade.
    instrumentationHook: true,
  },
  images: {
    remotePatterns: [
      // S3 + CloudFront for product images. Lock down by exact host in prod.
      { protocol: 'https', hostname: '*.amazonaws.com' },
      { protocol: 'https', hostname: '*.cloudfront.net' },
    ],
  },
  async headers() {
    const security = [
      // CSP frame-ancestors supersedes X-Frame-Options on modern browsers,
      // but we keep XFO for legacy UAs.
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Content-Security-Policy', value: csp },
      ...(isProd
        ? [
            // 2-year max-age + preload — only in prod since dev runs http.
            {
              key: 'Strict-Transport-Security',
              value: 'max-age=63072000; includeSubDomains; preload',
            },
          ]
        : []),
    ];
    return [{ source: '/:path*', headers: security }];
  },
};

export default withNextIntl(nextConfig);
