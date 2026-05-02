'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const MESSAGE_MAX = 500;

export function VacationCard({
  initial,
}: {
  initial: { vacationMode: boolean; vacationMessage: string; vacationUntil: string };
}) {
  const router = useRouter();
  const [vacationMode, setVacationMode] = useState(initial.vacationMode);
  const [vacationMessage, setVacationMessage] = useState(initial.vacationMessage);
  const [vacationUntil, setVacationUntil] = useState(initial.vacationUntil);
  const [submitting, setSubmitting] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <h2 className="font-display text-2xl font-medium tracking-tight text-stone-950">
        Vacation mode
      </h2>
      <p className="mt-2 text-sm text-stone-600">
        Pause new orders without unpublishing your listings. Buyers see a banner
        on your storefront and product pages and can&apos;t add items to cart
        until you&apos;re back. Wishlist saves still work — buyers can come back
        for a price-drop ping later.
      </p>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSubmitting(true);
          setError(null);
          try {
            const res = await fetch('/api/seller/vacation', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                vacationMode,
                vacationMessage: vacationMessage.trim() || undefined,
                vacationUntil: vacationUntil || undefined,
              }),
            });
            if (!res.ok) {
              const j = (await res.json().catch(() => ({}))) as { error?: string };
              setError(j.error ?? 'Could not save.');
              return;
            }
            setSavedAt(new Date());
            router.refresh();
          } finally {
            setSubmitting(false);
          }
        }}
        className="mt-6 space-y-4"
      >
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={vacationMode}
            onChange={(e) => setVacationMode(e.target.checked)}
            className="mt-1"
          />
          <div className="flex-1">
            <p className="text-sm font-medium text-stone-900">
              I&apos;m on vacation — pause new orders
            </p>
            <p className="text-xs text-stone-500">
              You can flip this off any time. If you set an end date below, the
              banner clears automatically once it passes.
            </p>
          </div>
        </label>

        <label className="block text-sm font-medium text-stone-900">
          Message to buyers <span className="font-normal text-stone-500">(optional)</span>
          <textarea
            value={vacationMessage}
            onChange={(e) => setVacationMessage(e.target.value.slice(0, MESSAGE_MAX))}
            rows={3}
            placeholder="I'm at a craft fair through May 15. Orders placed after I'm back ship within 48h."
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
          />
          <p className="mt-0.5 text-right text-xs text-stone-400 tabular-nums">
            {vacationMessage.length}/{MESSAGE_MAX}
          </p>
        </label>

        <label className="block text-sm font-medium text-stone-900">
          Back by <span className="font-normal text-stone-500">(optional)</span>
          <input
            type="datetime-local"
            value={vacationUntil}
            onChange={(e) => setVacationUntil(e.target.value)}
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {savedAt && (
          <p className="text-sm text-emerald-700">Saved at {savedAt.toLocaleTimeString()}.</p>
        )}

        <div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-emerald-700 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Save vacation settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
