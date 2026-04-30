import type { Metadata } from 'next';
import { Inter, Fraunces } from 'next/font/google';
import { SentryInit } from '@/components/sentry-init';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const display = Fraunces({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Onsective Sellers', template: '%s · Onsective Sellers' },
  description: 'Sell to a worldwide marketplace. Onsective handles payments, fraud, and shipping.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`}>
      <body>
        <SentryInit />
        {children}
      </body>
    </html>
  );
}
