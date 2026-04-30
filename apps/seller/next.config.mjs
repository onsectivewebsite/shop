const isProd = process.env.NODE_ENV === 'production';

// Seller CSP. Stripe Connect onboarding redirects to connect.stripe.com but
// the embedded onboarding component (used inside dashboards) renders in an
// iframe — frame-src covers both. Stripe.js loaded for refresh-link flows.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' https://js.stripe.com https://*.sentry.io",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://api.stripe.com https://m.stripe.network https://*.sentry.io",
  "frame-src https://js.stripe.com https://hooks.stripe.com https://connect.stripe.com",
  "frame-ancestors 'none'",
  "form-action 'self' https://connect.stripe.com",
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@onsective/ui', '@onsective/db', '@onsective/auth'],
  experimental: {
    // Required on Next 14 for instrumentation.ts to fire on server boot.
    // Stable in 15.x — drop this flag when we upgrade.
    instrumentationHook: true,
  },
  async headers() {
    const security = [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Content-Security-Policy', value: csp },
      ...(isProd
        ? [
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

export default nextConfig;
