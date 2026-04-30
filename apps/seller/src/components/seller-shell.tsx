import Link from 'next/link';
import { LayoutDashboard, Package, Receipt, Wallet, BarChart3, MessageSquare, LogOut } from 'lucide-react';

export function SellerShell({
  children,
  email,
  name,
  fullChrome = true,
}: {
  children: React.ReactNode;
  email?: string;
  name?: string;
  fullChrome?: boolean;
}) {
  return (
    <div className="min-h-screen bg-stone-50">
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

            {fullChrome && email && (
              <nav className="ml-2 hidden items-center gap-5 text-sm font-medium text-stone-700 md:flex">
                <Link href="/dashboard" className="inline-flex items-center gap-1.5 hover:text-stone-950">
                  <LayoutDashboard size={14} strokeWidth={1.75} /> Dashboard
                </Link>
                <Link href="/dashboard/products" className="inline-flex items-center gap-1.5 hover:text-stone-950">
                  <Package size={14} strokeWidth={1.75} /> Products
                </Link>
                <Link href="/dashboard/orders" className="inline-flex items-center gap-1.5 hover:text-stone-950">
                  <Receipt size={14} strokeWidth={1.75} /> Orders
                </Link>
                <Link href="/dashboard/payouts" className="inline-flex items-center gap-1.5 hover:text-stone-950">
                  <Wallet size={14} strokeWidth={1.75} /> Payouts
                </Link>
                <Link href="/dashboard/reviews" className="inline-flex items-center gap-1.5 hover:text-stone-950">
                  <MessageSquare size={14} strokeWidth={1.75} /> Reviews
                </Link>
                <Link href="/dashboard/analytics" className="inline-flex items-center gap-1.5 hover:text-stone-950">
                  <BarChart3 size={14} strokeWidth={1.75} /> Analytics
                </Link>
              </nav>
            )}

            <nav className="ml-auto flex items-center gap-3">
              <a
                href="https://itsnottechy.cloud"
                className="hidden text-sm font-medium text-stone-600 transition-colors hover:text-stone-900 sm:inline-flex"
              >
                ← Marketplace
              </a>
              {email ? (
                <div className="flex items-center gap-3">
                  <span className="hidden text-right sm:block">
                    <span className="block text-xs text-stone-500">Signed in as</span>
                    <span className="block text-sm font-medium text-stone-900">
                      {name ?? email.split('@')[0]}
                    </span>
                  </span>
                  <form action="/api/auth/logout" method="POST">
                    <button
                      type="submit"
                      title="Sign out"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900"
                    >
                      <LogOut size={15} strokeWidth={1.75} />
                    </button>
                  </form>
                </div>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="hidden h-9 items-center rounded-full px-4 text-sm font-medium text-stone-700 transition-colors hover:text-stone-950 sm:inline-flex"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/signup"
                    className="inline-flex h-9 items-center rounded-full bg-emerald-700 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-800"
                  >
                    Become a seller
                  </Link>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}
