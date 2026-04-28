import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Heart, ShoppingCart, User, Search } from 'lucide-react';
import { Button } from '@onsective/ui';

export function Header() {
  const t = useTranslations('nav');

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="container-page">
        {/* Top row: logo + search + actions */}
        <div className="flex h-16 items-center gap-4">
          <Link href="/" className="text-xl font-bold tracking-tight text-brand-700">
            Onsective
          </Link>

          <div className="relative hidden flex-1 md:block">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
              aria-hidden
            />
            <input
              type="search"
              placeholder={t('search')}
              className="h-10 w-full rounded-md border border-slate-300 bg-slate-50 pl-10 pr-4 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          <nav className="flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label={t('wishlist')}>
              <Heart size={20} />
            </Button>
            <Button variant="ghost" size="icon" aria-label={t('cart')}>
              <ShoppingCart size={20} />
            </Button>
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
              <User size={18} />
              <span>{t('login')}</span>
            </Button>
          </nav>
        </div>

        {/* Category strip */}
        <nav className="hidden h-10 items-center gap-6 overflow-x-auto text-sm text-slate-600 md:flex">
          <Link href="/category/electronics" className="hover:text-brand-700">
            {t('categories.electronics')}
          </Link>
          <Link href="/category/fashion" className="hover:text-brand-700">
            {t('categories.fashion')}
          </Link>
          <Link href="/category/home" className="hover:text-brand-700">
            {t('categories.home')}
          </Link>
          <Link href="/category/beauty" className="hover:text-brand-700">
            {t('categories.beauty')}
          </Link>
          <Link href="/category/books" className="hover:text-brand-700">
            {t('categories.books')}
          </Link>
          <Link href="/category/toys" className="hover:text-brand-700">
            {t('categories.toys')}
          </Link>
          <Link href="/category/grocery" className="hover:text-brand-700">
            {t('categories.grocery')}
          </Link>
          <span className="ml-auto text-slate-400">{t('categories.more')} ▾</span>
        </nav>
      </div>
    </header>
  );
}
