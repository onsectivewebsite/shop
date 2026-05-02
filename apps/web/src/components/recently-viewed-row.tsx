'use client';

import { useEffect, useState } from 'react';
import {
  RECENTLY_VIEWED_COOKIE,
  parseRecentlyViewed,
  serialiseRecentlyViewed,
} from '@/lib/recently-viewed';
import { trpc } from '@/lib/trpc';
import { ProductCard } from '@/components/product-card';

/**
 * Reads the recently-viewed cookie on mount and resolves the ids to cards.
 * Renders nothing when the cookie is empty (first-visit users + cleared
 * users). The "Clear" affordance flushes the cookie and the row state.
 *
 * Skips the current PDP's id when one is passed in — keeps the row useful
 * on the PDP itself ("things you also looked at") rather than echoing the
 * page you're on.
 */
export function RecentlyViewedRow({
  locale,
  excludeId,
}: {
  locale: string;
  excludeId?: string;
}) {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const match = document.cookie
      .split('; ')
      .find((c) => c.startsWith(`${RECENTLY_VIEWED_COOKIE}=`));
    const parsed = match ? parseRecentlyViewed(match.slice(RECENTLY_VIEWED_COOKIE.length + 1)) : [];
    setIds(parsed.filter((id) => id !== excludeId).slice(0, 12));
  }, [excludeId]);

  // Only fire the query once we have ids — saves a wasted round-trip on
  // first-visit users.
  const { data, isLoading } = trpc.catalog.byIds.useQuery(
    { ids: ids.length > 0 ? ids : ['placeholder'] },
    { enabled: ids.length > 0 },
  );

  if (ids.length === 0 || (data && data.length === 0)) return null;

  function clear() {
    document.cookie = `${RECENTLY_VIEWED_COOKIE}=${serialiseRecentlyViewed([])}; path=/; max-age=0; samesite=lax`;
    setIds([]);
  }

  return (
    <section className="container-page mt-12 md:mt-16">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl font-medium tracking-tight text-stone-950">
          Recently viewed
        </h2>
        <button
          onClick={clear}
          className="text-xs font-medium text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
        >
          Clear
        </button>
      </div>
      {isLoading ? (
        <p className="mt-4 text-sm text-slate-500">Loading…</p>
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {data?.map((p) => (
            <li key={p.id}>
              <ProductCard locale={locale} product={p} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
