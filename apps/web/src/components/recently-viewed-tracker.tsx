'use client';

import { useEffect } from 'react';
import {
  RECENTLY_VIEWED_COOKIE,
  RECENTLY_VIEWED_TTL_DAYS,
  parseRecentlyViewed,
  pushRecentlyViewed,
  serialiseRecentlyViewed,
} from '@/lib/recently-viewed';

/**
 * Mounts on every PDP. Reads the recent-viewed cookie, prepends the current
 * product id, dedupes, writes back with a 30-day max-age. No render output.
 *
 * Functional cookie — covered by the Essential bucket on the consent banner;
 * no opt-in needed (see /legal/cookies).
 */
export function RecentlyViewedTracker({ productId }: { productId: string }) {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const match = document.cookie
      .split('; ')
      .find((c) => c.startsWith(`${RECENTLY_VIEWED_COOKIE}=`));
    const current = match ? parseRecentlyViewed(match.slice(RECENTLY_VIEWED_COOKIE.length + 1)) : [];
    const next = pushRecentlyViewed(current, productId);
    if (next[0] === current[0] && next.length === current.length) return;
    document.cookie = `${RECENTLY_VIEWED_COOKIE}=${serialiseRecentlyViewed(next)}; path=/; max-age=${
      RECENTLY_VIEWED_TTL_DAYS * 24 * 60 * 60
    }; samesite=lax`;
  }, [productId]);
  return null;
}
