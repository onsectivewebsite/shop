import type { Metadata } from 'next';
import { Inter, Fraunces } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { Header } from '@/components/header';
import { SellerHeader } from '@/components/seller/header';
import { Footer } from '@/components/footer';
import { TRPCProvider } from '@/components/trpc-provider';
import { ImpersonationBanner } from '@/components/impersonation-banner';
import { locales, type Locale } from '@/i18n/config';
import '../globals.css';

function isSellerHost(): boolean {
  const h = headers();
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? '').split(':')[0]?.toLowerCase();
  return host === 'seller.itsnottechy.cloud';
}

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
  const sellerSurface = isSellerHost();

  return (
    <html lang={locale} className={`${inter.variable} ${display.variable}`}>
      <body>
        <TRPCProvider>
          <NextIntlClientProvider messages={messages}>
            <ImpersonationBanner />
            {sellerSurface ? <SellerHeader /> : <Header />}
            <main>{children}</main>
            {!sellerSurface && <Footer />}
          </NextIntlClientProvider>
        </TRPCProvider>
      </body>
    </html>
  );
}
