import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Search, ShoppingBag, Globe } from 'lucide-react';
import { getSession } from '@/server/auth/session';
import { UserMenu } from './user-menu';

const MOODS = [
  { label: 'Quiet luxury', href: '/mood/quiet-luxury' },
  { label: 'Wabi-sabi', href: '/mood/wabi-sabi' },
  { label: 'Y2K revival', href: '/mood/y2k' },
  { label: 'Cyber utility', href: '/mood/cyber-utility' },
  { label: 'Soft minimal', href: '/mood/soft-minimal' },
  { label: 'Maximalist', href: '/mood/maximalist' },
];

export async function Header() {
  const t = await getTranslations('nav');
  const session = await getSession();
  const user = session?.user ?? null;

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200/50 bg-stone-50/70 backdrop-blur-xl">
      <div className="container-page">
        <div className="flex h-16 items-center gap-4">
          {/* Wordmark */}
          <Link
            href="/"
            className="font-display text-2xl font-medium tracking-tight text-stone-900"
          >
            on<span className="italic text-emerald-700">sective</span>
          </Link>

          {/* Pill search */}
          <div className="relative ml-2 hidden flex-1 md:block">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
              size={16}
              strokeWidth={1.75}
              aria-hidden
            />
            <input
              type="search"
              placeholder="Search · objects, makers, moods…"
              className="h-11 w-full rounded-full border border-stone-200 bg-white/90 pl-11 pr-4 text-sm text-stone-900 placeholder:text-stone-400 transition-all focus:border-stone-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-stone-900/5"
            />
          </div>

          {/* Right cluster */}
          <nav className="ml-auto flex items-center gap-1">
            <Link
              href="/sell"
              className="hidden h-10 items-center rounded-full px-4 text-sm font-medium text-stone-700 transition-colors hover:text-stone-900 sm:inline-flex"
            >
              Sell
            </Link>
            <button
              aria-label="Region"
              className="hidden h-10 w-10 items-center justify-center rounded-full text-stone-700 transition-colors hover:bg-stone-100 sm:inline-flex"
            >
              <Globe size={18} strokeWidth={1.5} />
            </button>
            <Link
              href="/cart"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-stone-700 transition-colors hover:bg-stone-100"
              aria-label={t('cart')}
            >
              <ShoppingBag size={18} strokeWidth={1.5} />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-emerald-700" />
            </Link>
            <span className="mx-1 hidden h-6 w-px bg-stone-200 sm:block" aria-hidden />

            {user ? (
              <UserMenu name={user.fullName ?? user.email} email={user.email} />
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden h-10 items-center rounded-full px-4 text-sm font-medium text-stone-700 transition-colors hover:text-stone-900 sm:inline-flex"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex h-10 items-center rounded-full bg-stone-900 px-5 text-sm font-medium text-white transition-colors hover:bg-stone-800"
                >
                  Join
                </Link>
              </>
            )}
          </nav>
        </div>

        {/* Mood pills row */}
        <div className="hidden h-12 items-center gap-2 overflow-x-auto pb-2 md:flex">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
            Shop by mood
          </span>
          <span className="h-3 w-px bg-stone-300" aria-hidden />
          {MOODS.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="shrink-0 rounded-full border border-stone-300 bg-white px-3 py-1 text-xs text-stone-700 transition-colors hover:border-stone-900 hover:bg-stone-900 hover:text-white"
            >
              {m.label}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
