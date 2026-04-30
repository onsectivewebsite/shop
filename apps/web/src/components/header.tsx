import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Search, ShoppingBag, Heart } from 'lucide-react';
import { getSession } from '@/server/auth/session';
import { UserMenu } from './user-menu';
import { MobileMenu } from './mobile-menu';

const DEPARTMENTS = [
  'electronics',
  'fashion',
  'beauty',
  'home',
  'books',
  'toys',
  'grocery',
  'sports',
] as const;

export async function Header({ locale }: { locale: string }) {
  const t = await getTranslations('nav');
  const session = await getSession();
  const user = session?.user ?? null;

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200/70 bg-white/80 backdrop-blur-xl">
      <div className="container-page">
        <div className="flex h-16 items-center gap-2 sm:gap-3">
          <MobileMenu locale={locale} isAuthed={Boolean(user)} />

          <Link
            href={`/${locale}`}
            className="flex items-center gap-1 font-display text-2xl font-medium tracking-tight text-stone-950"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-950 text-sm font-bold text-white">
              O
            </span>
            <span className="hidden sm:inline">onsective</span>
          </Link>

          {/* Pill search — desktop only; mobile uses the menu sheet */}
          <form action={`/${locale}/search`} method="get" className="relative ml-1 hidden flex-1 sm:block">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
              size={16}
              strokeWidth={2}
              aria-hidden
            />
            <input
              type="search"
              name="q"
              placeholder={t('search')}
              className="h-11 w-full rounded-full border border-stone-200 bg-stone-50 pl-11 pr-4 text-sm text-stone-900 placeholder:text-stone-400 transition-all focus:border-stone-950 focus:bg-white focus:outline-none focus:ring-4 focus:ring-stone-950/5"
            />
          </form>

          <nav className="ml-auto flex items-center gap-1">
            <a
              href="https://seller.itsnottechy.cloud"
              className="hidden h-10 items-center rounded-full px-4 text-sm font-medium text-stone-700 transition-colors hover:text-stone-950 sm:inline-flex"
            >
              {t('sellOnOnsective')}
            </a>
            <Link
              href={`/${locale}/account/wishlist`}
              aria-label={t('wishlist')}
              className="hidden h-10 w-10 items-center justify-center rounded-full text-stone-700 transition-colors hover:bg-stone-100 sm:inline-flex"
            >
              <Heart size={18} strokeWidth={1.75} />
            </Link>
            <Link
              href={`/${locale}/cart`}
              aria-label={t('cart')}
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-stone-700 transition-colors hover:bg-stone-100"
            >
              <ShoppingBag size={18} strokeWidth={1.75} />
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-stone-950 text-[10px] font-bold text-white">
                0
              </span>
            </Link>
            <span className="mx-1 hidden h-6 w-px bg-stone-200 sm:block" aria-hidden />

            {user ? (
              <UserMenu name={user.fullName ?? user.email} email={user.email} />
            ) : (
              <>
                <Link
                  href={`/${locale}/login`}
                  className="hidden h-10 items-center rounded-full px-4 text-sm font-medium text-stone-700 transition-colors hover:text-stone-950 sm:inline-flex"
                >
                  {t('login')}
                </Link>
                <Link
                  href={`/${locale}/signup`}
                  className="hidden h-10 items-center rounded-full bg-stone-950 px-5 text-sm font-medium text-white transition-colors hover:bg-stone-800 sm:inline-flex"
                >
                  {t('joinFree')}
                </Link>
              </>
            )}
          </nav>
        </div>

        {/* Department strip — desktop only */}
        <nav className="hidden h-10 items-center gap-6 overflow-x-auto pb-1 text-[13px] font-medium text-stone-700 md:flex">
          {DEPARTMENTS.map((slug) => (
            <Link
              key={slug}
              href={`/${locale}/category/${slug}`}
              className="hover:text-stone-950"
            >
              {t(`categories.${slug}`)}
            </Link>
          ))}
          <Link
            href={`/${locale}/deals`}
            className="ml-auto rounded-full bg-rose-100 px-3 py-1 text-[12px] font-semibold text-rose-700 hover:bg-rose-200"
          >
            🔥 {t('todaysDeals')}
          </Link>
        </nav>
      </div>
    </header>
  );
}
