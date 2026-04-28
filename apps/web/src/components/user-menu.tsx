'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, LogOut, Package, Settings, KeyRound } from 'lucide-react';
import { trpc } from '@/lib/trpc';

function initials(nameOrEmail: string): string {
  const parts = nameOrEmail.split(/[@\s]/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function UserMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white pl-1 pr-3 text-sm font-medium text-slate-900 transition-colors hover:border-slate-300"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
          {initials(name || email)}
        </span>
        <span className="hidden max-w-[120px] truncate sm:inline">
          {name.split('@')[0]}
        </span>
        <ChevronDown size={14} className="text-slate-400" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-medium text-slate-900">{name.split('@')[0]}</p>
            <p className="truncate text-xs text-slate-500">{email}</p>
          </div>
          <div className="py-1">
            <MenuLink href="/account/orders" icon={Package}>
              Orders
            </MenuLink>
            <MenuLink href="/account/passkeys" icon={KeyRound}>
              Passkeys
            </MenuLink>
            <MenuLink href="/account" icon={Settings}>
              Account settings
            </MenuLink>
          </div>
          <div className="border-t border-slate-100 py-1">
            <button
              type="button"
              onClick={() => logout.mutate()}
              disabled={logout.isLoading}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              <LogOut size={16} strokeWidth={1.75} className="text-slate-400" />
              {logout.isLoading ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: typeof Package;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
    >
      <Icon size={16} strokeWidth={1.75} className="text-slate-400" />
      {children}
    </Link>
  );
}
