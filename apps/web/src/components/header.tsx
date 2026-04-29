import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Search, ShoppingBag, Heart, Globe } from 'lucide-react';
import { getSession } from '@/server/auth/session';
import { UserMenu } from './user-menu';

export async function Header() {
  const t = await getTranslations('nav');
  const session = await getSession();
  const user = session?.user ?? null;

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200/70 bg-white/80 backdrop-blur-xl">
      <div className="container-page">
        <div className="flex h-16 items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1 font-display text-2xl font-medium tracking-tight text-stone-950"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-950 text-sm font-bold text-white">
              O
            </span>
            <span className="hidden sm:inline">onsective</span>
          </Link>

          {/* Pill search */}
          <div className="relative ml-1 hidden flex-1 sm:block">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
              size={16}
              strokeWidth={2}
              aria-hidden
            />
            <input
              type="search"
              placeholder="Search for products, brands, categories…"
              className="h-11 w-full rounded-full border border-stone-200 bg-stone-50 pl-11 pr-4 text-sm text-stone-900 placeholder:text-stone-400 transition-all focus:border-stone-950 focus:bg-white focus:outline-none focus:ring-4 focus:ring-stone-950/5"
            />
          </div>

          <nav className="ml-auto flex items-center gap-1">
            <Link
              href="/sell"
              className="hidden h-10 items-center rounded-full px-4 text-sm font-medium text-stone-700 transition-colors hover:text-stone-950 sm:inline-flex"
            >
              Sell on Onsective
            </Link>
            <Link
              href="/account/wishlist"
              aria-label="Wishlist"
              className="hidden h-10 w-10 items-center justify-center rounded-full text-stone-700 transition-colors hover:bg-stone-100 sm:inline-flex"
            >
              <Heart size={18} strokeWidth={1.75} />
            </Link>
            <Link
              href="/cart"
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
                  href="/login"
                  className="hidden h-10 items-center rounded-full px-4 text-sm font-medium text-stone-700 transition-colors hover:text-stone-950 sm:inline-flex"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex h-10 items-center rounded-full bg-stone-950 px-5 text-sm font-medium text-white transition-colors hover:bg-stone-800"
                >
                  Join free
                </Link>
              </>
            )}
          </nav>
        </div>

        {/* Department strip */}
        <nav className="hidden h-10 items-center gap-6 overflow-x-auto pb-1 text-[13px] font-medium text-stone-700 md:flex">
          <Link href="/category/electronics" className="hover:text-stone-950">Electronics</Link>
          <Link href="/category/fashion" className="hover:text-stone-950">Fashion</Link>
          <Link href="/category/beauty" className="hover:text-stone-950">Beauty</Link>
          <Link href="/category/home" className="hover:text-stone-950">Home & Kitchen</Link>
          <Link href="/category/books" className="hover:text-stone-950">Books</Link>
          <Link href="/category/toys" className="hover:text-stone-950">Toys & Kids</Link>
          <Link href="/category/grocery" className="hover:text-stone-950">Grocery</Link>
          <Link href="/category/sports" className="hover:text-stone-950">Sports & Outdoor</Link>
          <span className="ml-auto rounded-full bg-rose-100 px-3 py-1 text-[12px] font-semibold text-rose-700">
            🔥 Today&rsquo;s deals
          </span>
        </nav>
      </div>
    </header>
  );
}
