'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@onsective/ui';

const STEPS = [
  { href: '/checkout/address', label: 'Address' },
  { href: '/checkout/shipping', label: 'Shipping' },
  { href: '/checkout/pay', label: 'Pay' },
] as const;

export function CheckoutStepper() {
  const pathname = usePathname();
  const stripped = pathname.replace(/^\/[a-z]{2}(-[A-Z]{2})?/, '');
  const currentIndex = STEPS.findIndex((s) => stripped.startsWith(s.href));

  return (
    <ol className="mb-8 flex items-center justify-center gap-3 text-sm">
      {STEPS.map((s, i) => {
        const active = i === currentIndex;
        const done = currentIndex > i;
        return (
          <li key={s.href} className="flex items-center gap-3">
            <span
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold tabular-nums',
                done && 'border-success-500 bg-success-500 text-white',
                active && 'border-brand-600 bg-brand-600 text-white',
                !active && !done && 'border-slate-300 text-slate-400',
              )}
            >
              {done ? '✓' : i + 1}
            </span>
            <span
              className={cn(
                'font-medium',
                active ? 'text-slate-900' : done ? 'text-slate-700' : 'text-slate-400',
              )}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && <span className="h-px w-8 bg-slate-200" />}
          </li>
        );
      })}
    </ol>
  );
}
