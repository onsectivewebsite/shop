import type { Metadata, Viewport } from 'next';
import { Inter, Fraunces } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { TRPCProvider } from '@/components/trpc-provider';
import { ImpersonationBanner } from '@/components/impersonation-banner';
import { SentryInit } from '@/components/sentry-init';
import { CookieBanner } from '@/components/cookie-banner';
import { ServiceWorkerRegister } from '@/components/sw-register';
import { locales, type Locale } from '@/i18n/config';
import '../globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const display = Fraunces({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Onsective — A worldwide marketplace',
    template: '%s · Onsective',
  },
  description: 'Trusted sellers, fast delivery, the best of the world.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  manifest: '/manifest.webmanifest',
  // iOS doesn't read manifest.webmanifest for the "Add to Home Screen"
  // experience — the apple-* hints below cover Safari + ipados.
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Onsective',
  },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icon.svg' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
  // Allow the user-agent to honour native pinch-zoom — important for
  // accessibility on small product images and dense text content.
  width: 'device-width',
  initialScale: 1,
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const dynamic = 'force-dynamic';

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!locales.includes(locale as Locale)) notFound();

  const messages = await getMessages();

  return (
    <html lang={locale} className={`${inter.variable} ${display.variable}`}>
      <body>
        <SentryInit />
        <ServiceWorkerRegister />
        <TRPCProvider>
          <NextIntlClientProvider messages={messages}>
            <ImpersonationBanner />
            <Header locale={locale} />
            <main>{children}</main>
            <Footer />
            <CookieBanner />
          </NextIntlClientProvider>
        </TRPCProvider>
      </body>
    </html>
  );
}
