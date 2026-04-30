'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Menu, X, Search, Heart, Package, Store, LogIn, UserPlus, Flame } from 'lucide-react';

type Props = {
  locale: string;
  isAuthed: boolean;
};

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

export function MobileMenu({ locale, isAuthed }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const t = useTranslations('nav');

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const localePath = (p: string) => `/${locale}${p}`;

  const discover = [
    { href: '/categories', label: t('allCategories') },
    { href: '/deals', label: t('todaysDeals'), accent: true },
    { href: '/best-sellers', label: t('bestSellers') },
    { href: '/trending', label: t('trending') },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('openMenu')}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-stone-700 transition-colors hover:bg-stone-100 md:hidden"
      >
        <Menu size={20} strokeWidth={1.75} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label={t('closeMenu')}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-stone-950/40 backdrop-blur-sm"
          />
          <aside className="absolute inset-y-0 left-0 flex w-[88%] max-w-[360px] flex-col overflow-y-auto bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
              <Link
                href={localePath('/')}
                className="flex items-center gap-1.5 font-display text-xl font-medium tracking-tight text-stone-950"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-950 text-sm font-bold text-white">
                  O
                </span>
                onsective
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t('closeMenu')}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-stone-700 transition-colors hover:bg-stone-100"
              >
                <X size={18} strokeWidth={1.75} />
              </button>
            </div>

            <form action={localePath('/search')} method="get" className="px-5 pb-2 pt-4">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
                  size={16}
                  strokeWidth={2}
                  aria-hidden
                />
                <input
                  type="search"
                  name="q"
                  placeholder={t('searchShort')}
                  className="h-11 w-full rounded-full border border-stone-200 bg-stone-50 pl-11 pr-4 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-950 focus:bg-white focus:outline-none focus:ring-4 focus:ring-stone-950/5"
                />
              </div>
            </form>

            <div className="px-2 pb-1 pt-2">
              <p className="px-3 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                {t('discover')}
              </p>
              {discover.map((d) => (
                <Link
                  key={d.href}
                  href={localePath(d.href)}
                  className="flex items-center justify-between rounded-xl px-3 py-2.5 text-[15px] font-medium text-stone-800 transition-colors hover:bg-stone-50"
                >
                  <span>{d.label}</span>
                  {d.accent && <Flame size={15} className="text-rose-600" strokeWidth={2} />}
                </Link>
              ))}
            </div>

            <div className="px-2 pb-1 pt-2">
              <p className="px-3 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                {t('shopByCategory')}
              </p>
              {DEPARTMENTS.map((slug) => (
                <Link
                  key={slug}
                  href={localePath(`/category/${slug}`)}
                  className="block rounded-xl px-3 py-2.5 text-[15px] text-stone-800 transition-colors hover:bg-stone-50"
                >
                  {t(`categories.${slug}`)}
                </Link>
              ))}
            </div>

            <div className="px-2 pb-2 pt-2">
              <p className="px-3 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                {t('yourAccount')}
              </p>
              {isAuthed ? (
                <>
                  <Link
                    href={localePath('/account/orders')}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] text-stone-800 transition-colors hover:bg-stone-50"
                  >
                    <Package size={17} strokeWidth={1.75} className="text-stone-500" />
                    {t('orders')}
                  </Link>
                  <Link
                    href={localePath('/account/wishlist')}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] text-stone-800 transition-colors hover:bg-stone-50"
                  >
                    <Heart size={17} strokeWidth={1.75} className="text-stone-500" />
                    {t('wishlist')}
                  </Link>
                  <Link
                    href={localePath('/track')}
                    className="block rounded-xl px-3 py-2.5 text-[15px] text-stone-800 transition-colors hover:bg-stone-50"
                  >
                    {t('trackAnOrder')}
                  </Link>
                  <Link
                    href={localePath('/account')}
                    className="block rounded-xl px-3 py-2.5 text-[15px] text-stone-800 transition-colors hover:bg-stone-50"
                  >
                    {t('accountSettings')}
                  </Link>
                </>
              ) : (
                <Link
                  href={localePath('/track')}
                  className="block rounded-xl px-3 py-2.5 text-[15px] text-stone-800 transition-colors hover:bg-stone-50"
                >
                  {t('trackAnOrder')}
                </Link>
              )}
            </div>

            <div className="mt-auto border-t border-stone-200 bg-stone-50 px-5 py-4">
              {!isAuthed && (
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <Link
                    href={localePath('/login')}
                    className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-stone-300 bg-white text-sm font-medium text-stone-900"
                  >
                    <LogIn size={15} strokeWidth={1.75} /> {t('login')}
                  </Link>
                  <Link
                    href={localePath('/signup')}
                    className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-stone-950 text-sm font-medium text-white"
                  >
                    <UserPlus size={15} strokeWidth={1.75} /> {t('joinFree')}
                  </Link>
                </div>
              )}
              <a
                href="https://seller.itsnottechy.cloud"
                className="flex items-center gap-3 rounded-xl bg-white px-3 py-3 text-sm font-medium text-stone-900 ring-1 ring-stone-200"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-950 text-white">
                  <Store size={16} strokeWidth={1.75} />
                </span>
                <span className="flex flex-col leading-tight">
                  <span>{t('sellOnOnsective')}</span>
                  <span className="text-[11px] font-normal text-stone-500">
                    {t('sellTagline')}
                  </span>
                </span>
              </a>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
