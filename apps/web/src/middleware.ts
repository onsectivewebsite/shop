import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from './i18n/config';

const intl = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

const SELLER_SUBDOMAIN = 'seller.itsnottechy.cloud';

// Routes a seller is allowed to use under seller.itsnottechy.cloud.
// Anything else gets rewritten to land them on /seller/...
const SELLER_ALLOWED = [
  /^\/[a-z]{2}\/seller(?:\/.*)?$/,
  /^\/[a-z]{2}\/login(?:\/.*)?$/,
  /^\/[a-z]{2}\/signup(?:\/.*)?$/,
  /^\/[a-z]{2}\/verify-email(?:\/.*)?$/,
  /^\/[a-z]{2}\/verify-2fa(?:\/.*)?$/,
  /^\/[a-z]{2}\/reset(?:\/.*)?$/,
  /^\/[a-z]{2}\/forgot(?:\/.*)?$/,
  /^\/[a-z]{2}\/sell(?:\/.*)?$/,
  /^\/[a-z]{2}\/account(?:\/.*)?$/,
  /^\/[a-z]{2}\/impersonate(?:\/.*)?$/,
];

function isSellerHost(host: string | null): boolean {
  if (!host) return false;
  return host.split(':')[0]?.toLowerCase() === SELLER_SUBDOMAIN;
}

export default function middleware(req: NextRequest) {
  const host = req.headers.get('host');

  // On seller.itsnottechy.cloud, the root path goes straight to the seller
  // dashboard. Everything outside the seller surface gets redirected to the
  // primary marketplace host so we don't fragment the buyer experience.
  if (isSellerHost(host)) {
    const url = req.nextUrl.clone();

    // Bare / on seller subdomain -> /<locale>/seller
    if (url.pathname === '/' || /^\/[a-z]{2}\/?$/.test(url.pathname)) {
      const locale = url.pathname.split('/')[1] || defaultLocale;
      url.pathname = `/${locale}/seller`;
      return NextResponse.redirect(url);
    }

    // Anything not in the seller-allowed list gets bounced to the buyer host.
    const allowed = SELLER_ALLOWED.some((rx) => rx.test(url.pathname));
    if (!allowed) {
      const buyerHost = host?.replace(/^seller\./, '') ?? 'itsnottechy.cloud';
      return NextResponse.redirect(`https://${buyerHost}${url.pathname}${url.search}`);
    }
  }

  return intl(req);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
