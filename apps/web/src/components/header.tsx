import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { MapPin, Search, ShoppingCart, ChevronDown } from 'lucide-react';
import { getSession } from '@/server/auth/session';
import { UserMenu } from './user-menu';

export async function Header() {
  const t = await getTranslations('nav');
  const session = await getSession();
  const user = session?.user ?? null;

  return (
    <header className="sticky top-0 z-30">
      {/* TOP BAR — dark, dense */}
      <div className="bg-slate-950 text-white">
        <div className="container-page">
          <div className="flex h-14 items-center gap-4">
            <Link
              href="/"
              className="rounded px-2 py-1 text-2xl font-bold tracking-tight ring-white/40 hover:ring-1"
            >
              Onsective<span className="text-amber-400">.</span>
            </Link>

            <Link
              href="/account/addresses"
              className="hidden flex-col rounded px-2 py-1 ring-white/40 hover:ring-1 sm:flex"
            >
              <span className="text-[11px] text-slate-300">Deliver to</span>
              <span className="-mt-0.5 inline-flex items-center gap-1 text-sm font-bold">
                <MapPin size={14} />
                {user?.countryCode ?? 'Worldwide'}
              </span>
            </Link>

            {/* SEARCH WITH DEPARTMENT DROPDOWN */}
            <form className="flex h-10 flex-1 overflow-hidden rounded-md focus-within:ring-2 focus-within:ring-amber-400">
              <select
                className="h-full bg-slate-100 px-2 text-xs text-slate-700 focus:outline-none"
                aria-label="Department"
                defaultValue=""
              >
                <option value="">All</option>
                <option value="electronics">Electronics</option>
                <option value="fashion">Fashion</option>
                <option value="home">Home & Kitchen</option>
                <option value="beauty">Beauty</option>
                <option value="books">Books</option>
                <option value="toys">Toys</option>
                <option value="grocery">Grocery</option>
                <option value="sports">Sports</option>
              </select>
              <input
                type="search"
                placeholder={t('search')}
                className="h-full flex-1 bg-white px-3 text-sm text-slate-900 focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Search"
                className="flex h-full w-12 items-center justify-center bg-amber-400 text-slate-900 hover:bg-amber-500"
              >
                <Search size={18} strokeWidth={2.25} />
              </button>
            </form>

            <Link
              href="/account/orders"
              className="hidden rounded px-2 py-1 ring-white/40 hover:ring-1 md:block"
            >
              <span className="block text-[11px] text-slate-300">Returns</span>
              <span className="-mt-0.5 block text-sm font-bold">& Orders</span>
            </Link>

            {user ? (
              <UserMenu name={user.fullName ?? user.email} email={user.email} />
            ) : (
              <Link
                href="/login"
                className="hidden rounded px-2 py-1 ring-white/40 hover:ring-1 sm:block"
              >
                <span className="block text-[11px] text-slate-300">Hello, sign in</span>
                <span className="-mt-0.5 inline-flex items-center gap-1 text-sm font-bold">
                  Account <ChevronDown size={12} />
                </span>
              </Link>
            )}

            <Link
              href="/cart"
              className="flex items-center gap-1 rounded px-2 py-1 ring-white/40 hover:ring-1"
              aria-label={t('cart')}
            >
              <span className="relative">
                <ShoppingCart size={26} strokeWidth={1.75} />
                <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-400 px-1 text-[11px] font-bold text-slate-900">
                  0
                </span>
              </span>
              <span className="hidden text-sm font-bold sm:inline">Cart</span>
            </Link>
          </div>
        </div>

        {/* SECONDARY NAV — departments */}
        <div className="bg-slate-900">
          <div className="container-page">
            <nav className="flex h-10 items-center gap-5 overflow-x-auto text-sm font-medium text-white">
              <button className="inline-flex items-center gap-1 hover:text-amber-300">
                <span className="text-base">☰</span> All
              </button>
              <Link href="/category/electronics" className="hover:text-amber-300">Electronics</Link>
              <Link href="/category/fashion" className="hover:text-amber-300">Fashion</Link>
              <Link href="/category/home" className="hover:text-amber-300">Home</Link>
              <Link href="/category/beauty" className="hover:text-amber-300">Beauty</Link>
              <Link href="/category/books" className="hover:text-amber-300">Books</Link>
              <Link href="/category/toys" className="hover:text-amber-300">Toys</Link>
              <Link href="/category/grocery" className="hover:text-amber-300">Grocery</Link>
              <Link href="/category/sports" className="hover:text-amber-300">Sports</Link>
              <Link href="/deals" className="text-amber-300 hover:text-amber-200">Today&rsquo;s Deals</Link>
              <Link href="/sell" className="ml-auto whitespace-nowrap hover:text-amber-300">
                Sell on Onsective
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
