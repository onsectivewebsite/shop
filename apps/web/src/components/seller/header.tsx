import Link from 'next/link';
import { LayoutDashboard, Package, Receipt, Wallet, BarChart3 } from 'lucide-react';
import { getSession } from '@/server/auth/session';
import { UserMenu } from '@/components/user-menu';

export async function SellerHeader() {
  const session = await getSession();
  const user = session?.user ?? null;

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur">
      <div className="container-page">
        <div className="flex h-16 items-center gap-6">
          <Link
            href="/"
            className="flex items-baseline gap-2 font-display text-xl font-medium tracking-tight text-stone-950"
          >
            <span className="rounded-md bg-emerald-700 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
              Sellers
            </span>
            <span>Onsective</span>
          </Link>

          {user && (
            <nav className="ml-2 hidden items-center gap-5 text-sm font-medium text-stone-700 md:flex">
              <Link href="/seller" className="inline-flex items-center gap-1.5 hover:text-stone-950">
                <LayoutDashboard size={14} strokeWidth={1.75} /> Dashboard
              </Link>
              <Link href="/seller/products" className="inline-flex items-center gap-1.5 hover:text-stone-950">
                <Package size={14} strokeWidth={1.75} /> Products
              </Link>
              <Link href="/seller/orders" className="inline-flex items-center gap-1.5 hover:text-stone-950">
                <Receipt size={14} strokeWidth={1.75} /> Orders
              </Link>
              <Link href="/seller/payouts" className="inline-flex items-center gap-1.5 hover:text-stone-950">
                <Wallet size={14} strokeWidth={1.75} /> Payouts
              </Link>
              <Link href="/seller/analytics" className="inline-flex items-center gap-1.5 hover:text-stone-950">
                <BarChart3 size={14} strokeWidth={1.75} /> Analytics
              </Link>
            </nav>
          )}

          <nav className="ml-auto flex items-center gap-1">
            <a
              href="https://itsnottechy.cloud"
              className="hidden h-10 items-center rounded-full px-4 text-sm font-medium text-stone-600 transition-colors hover:text-stone-900 sm:inline-flex"
            >
              ← Back to marketplace
            </a>
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
                  className="inline-flex h-10 items-center rounded-full bg-emerald-700 px-5 text-sm font-medium text-white transition-colors hover:bg-emerald-800"
                >
                  Become a seller
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
