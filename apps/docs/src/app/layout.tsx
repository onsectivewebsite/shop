import type { Metadata, Viewport } from 'next';
import { Inter, Fraunces } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const display = Fraunces({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Onsective docs',
    template: '%s · Onsective docs',
  },
  description:
    'Reference for buyers, sellers, and developers building on Onsective.',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_DOCS_URL ?? 'http://localhost:3003',
  ),
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
};

const NAV: Array<{ section: string; items: Array<{ href: string; label: string }> }> = [
  {
    section: 'Getting started',
    items: [
      { href: '/', label: 'Overview' },
      { href: '/getting-started', label: 'Quickstart' },
    ],
  },
  {
    section: 'Sellers',
    items: [
      { href: '/sellers/onboarding', label: 'Onboarding' },
      { href: '/sellers/payouts', label: 'Payouts' },
    ],
  },
  {
    section: 'Buyers',
    items: [
      { href: '/buyers/orders', label: 'Orders + returns' },
      { href: '/buyers/account', label: 'Account safety' },
    ],
  },
  {
    section: 'Developers',
    items: [
      { href: '/developers/api', label: 'API overview' },
      { href: '/developers/webhooks', label: 'Webhooks' },
    ],
  },
];

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`}>
      <body>
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 md:px-8">
            <Link
              href="/"
              className="flex items-baseline gap-2 font-display text-xl font-medium tracking-tight text-slate-950"
            >
              <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
                Docs
              </span>
              <span>Onsective</span>
            </Link>
            <nav className="ml-auto flex items-center gap-5 text-sm font-medium text-slate-700">
              <a
                href="https://itsnottechy.cloud"
                className="hover:text-slate-950"
              >
                Marketplace
              </a>
              <a
                href="https://seller.itsnottechy.cloud"
                className="hover:text-slate-950"
              >
                Seller portal
              </a>
            </nav>
          </div>
        </header>

        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-12 md:grid-cols-[220px_minmax(0,1fr)] md:px-8">
          <aside className="hidden md:block">
            <nav aria-label="Docs sections" className="sticky top-24 space-y-6">
              {NAV.map((section) => (
                <div key={section.section}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {section.section}
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {section.items.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className="text-sm text-slate-700 transition-colors hover:text-slate-950"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>
          <main>
            <article className="prose-docs max-w-3xl">{children}</article>
          </main>
        </div>

        <footer className="border-t border-slate-200 bg-stone-50">
          <div className="mx-auto max-w-6xl px-4 py-8 text-xs text-slate-500 md:px-8">
            <p>Onsective docs · This is a working draft. Open an issue if you spot a gap.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
