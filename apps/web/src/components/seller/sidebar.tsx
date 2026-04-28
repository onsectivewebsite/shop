'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Package, ShoppingBag, Wallet, Settings } from 'lucide-react';
import { cn } from '@onsective/ui';

const ITEMS = [
  { href: '/seller', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/seller/products', label: 'Products', icon: Package },
  { href: '/seller/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/seller/payouts', label: 'Payouts', icon: Wallet },
  { href: '/seller/settings', label: 'Settings', icon: Settings },
];

export function SellerSidebar() {
  const pathname = usePathname();
  // Strip /[locale] prefix for matching
  const stripped = pathname.replace(/^\/[a-z]{2}(-[A-Z]{2})?/, '');

  return (
    <aside className="hidden w-60 border-r border-slate-200 bg-white md:block">
      <nav className="sticky top-16 p-4">
        <ul className="space-y-1">
          {ITEMS.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? stripped === href : stripped.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-brand-50 text-brand-700 font-medium'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  )}
                >
                  <Icon size={18} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
