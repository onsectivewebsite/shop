'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Inbox,
  Users,
  Store,
  Package,
  ShoppingBag,
  AlertTriangle,
  RotateCcw,
  Wrench,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@onsective/ui';

const SECTIONS = [
  {
    title: 'Work',
    items: [
      { href: '/dashboard', label: 'Inbox', icon: Inbox, exact: true },
      { href: '/dashboard/users', label: 'Users', icon: Users },
      { href: '/dashboard/sellers', label: 'Sellers', icon: Store },
      { href: '/dashboard/products', label: 'Catalog', icon: Package },
      { href: '/dashboard/orders', label: 'Orders', icon: ShoppingBag },
    ],
  },
  {
    title: 'Resolve',
    items: [
      { href: '/dashboard/tickets', label: 'Tickets', icon: Inbox },
      { href: '/dashboard/disputes', label: 'Disputes', icon: AlertTriangle },
      { href: '/dashboard/returns', label: 'Returns', icon: RotateCcw },
      { href: '/dashboard/approvals', label: 'Approvals', icon: ShieldCheck },
    ],
  },
  {
    title: 'System',
    items: [{ href: '/dashboard/tools', label: 'Tools', icon: Wrench }],
  },
];

export function ConsoleSidebar({
  user,
}: {
  user: { email: string; fullName: string | null };
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 flex-shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
      <div className="border-b border-slate-200 p-4">
        <Link href="/dashboard" className="text-lg font-bold text-brand-700">
          Onsective Console
        </Link>
      </div>
      <nav className="flex-1 p-3">
        {SECTIONS.map((section) => (
          <div key={section.title} className="mb-6">
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              {section.title}
            </p>
            <ul className="space-y-1">
              {section.items.map(({ href, label, icon: Icon, exact }) => {
                const active = exact
                  ? pathname === href
                  : pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                        active
                          ? 'bg-brand-50 text-brand-700 font-medium'
                          : 'text-slate-600 hover:bg-slate-100',
                      )}
                    >
                      <Icon size={18} />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-slate-200 p-4 text-xs">
        <p className="font-medium text-slate-700">{user.fullName ?? user.email}</p>
        <p className="text-slate-500 truncate">{user.email}</p>
        <form action="/api/auth/logout" method="post">
          <button className="mt-2 text-brand-600 hover:underline">Sign out</button>
        </form>
      </div>
    </aside>
  );
}
