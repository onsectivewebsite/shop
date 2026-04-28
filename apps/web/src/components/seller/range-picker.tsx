'use client';

import { useRouter, useSearchParams } from 'next/navigation';

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 365, label: '12 months' },
] as const;

export function RangePicker({ current }: { current: number }) {
  const router = useRouter();
  const params = useSearchParams();

  function pick(days: number) {
    const next = new URLSearchParams(params?.toString() ?? '');
    next.set('days', String(days));
    router.push(`?${next.toString()}`);
  }

  return (
    <div role="radiogroup" aria-label="Date range" className="flex gap-1">
      {RANGES.map((r) => (
        <button
          key={r.days}
          type="button"
          role="radio"
          aria-checked={current === r.days}
          onClick={() => pick(r.days)}
          className={
            current === r.days
              ? 'rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white'
              : 'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-400'
          }
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
