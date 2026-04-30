import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { SentryInit } from '@/components/sentry-init';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'Onsective Console',
  description: 'Internal operations console — Onsective.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <SentryInit />
        {children}
      </body>
    </html>
  );
}
