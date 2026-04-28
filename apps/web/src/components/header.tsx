import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Heart, ShoppingBag, Search, ChevronDown } from 'lucide-react';

export function Header() {
  const t = useTranslations('nav');

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur-md">
      <div className="container-page">
        <div className="flex h-20 items-center gap-6">
          <Link
            href="/"
            className="flex items-baseline gap-1 text-2xl font-semibold tracking-tight text-slate-900"
          >
            <span>Onsective</span>
            <span className="h-1.5 w-1.5 rounded-full bg-cta-500" aria-hidden />
          </Link>

          <div className="relative hidden flex-1 md:block">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
              aria-hidden
            />
            <input
              type="search"
              placeholder={t('search')}
              className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-slate-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-900/5"
            />
          </div>

          <nav className="flex items-center gap-1">
            <Link
              href="/account/wishlist"
              aria-label={t('wishlist')}
              className="hidden h-10 w-10 items-center justify-center rounded-full text-slate-700 transition-colors hover:bg-slate-100 sm:inline-flex"
            >
              <Heart size={20} strokeWidth={1.75} />
            </Link>
            <Link
              href="/cart"
              aria-label={t('cart')}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-700 transition-colors hover:bg-slate-100"
            >
              <ShoppingBag size={20} strokeWidth={1.75} />
            </Link>
            <span className="mx-2 hidden h-6 w-px bg-slate-200 sm:block" aria-hidden />
            <Link
              href="/login"
              className="hidden rounded-full px-4 text-sm font-medium text-slate-700 transition-colors hover:text-slate-900 sm:inline-flex sm:h-10 sm:items-center"
            >
              {t('login')}
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-10 items-center rounded-full bg-slate-900 px-5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
            >
              Sign up
            </Link>
          </nav>
        </div>

        <nav className="hidden h-12 items-center gap-7 overflow-x-auto text-[13px] font-medium text-slate-600 md:flex">
          <Link href="/category/electronics" className="transition-colors hover:text-slate-900">
            {t('categories.electronics')}
          </Link>
          <Link href="/category/fashion" className="transition-colors hover:text-slate-900">
            {t('categories.fashion')}
          </Link>
          <Link href="/category/home" className="transition-colors hover:text-slate-900">
            {t('categories.home')}
          </Link>
          <Link href="/category/beauty" className="transition-colors hover:text-slate-900">
            {t('categories.beauty')}
          </Link>
          <Link href="/category/books" className="transition-colors hover:text-slate-900">
            {t('categories.books')}
          </Link>
          <Link href="/category/toys" className="transition-colors hover:text-slate-900">
            {t('categories.toys')}
          </Link>
          <Link href="/category/grocery" className="transition-colors hover:text-slate-900">
            {t('categories.grocery')}
          </Link>
          <button className="ml-auto inline-flex items-center gap-1 text-slate-400 transition-colors hover:text-slate-900">
            {t('categories.more')} <ChevronDown size={14} />
          </button>
        </nav>
      </div>
    </header>
  );
}
