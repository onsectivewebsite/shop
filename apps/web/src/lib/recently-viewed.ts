/**
 * Cookie-backed recently-viewed-product list. Pure functions over a
 * comma-separated cuid string so the same code can serialise on the client
 * and deserialise from `cookies()` on the server.
 *
 * Length cap is 20 — over that and the cookie starts threatening UA limits,
 * and signal-wise the user has long since stopped caring about the 21st item.
 */

export const RECENTLY_VIEWED_COOKIE = 'onsective_recent';
export const RECENTLY_VIEWED_TTL_DAYS = 30;
export const RECENTLY_VIEWED_MAX = 20;

export function parseRecentlyViewed(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^[a-z0-9]{20,30}$/i.test(s)) // cuid-ish guard
    .slice(0, RECENTLY_VIEWED_MAX);
}

export function pushRecentlyViewed(ids: string[], next: string): string[] {
  const filtered = ids.filter((id) => id !== next);
  return [next, ...filtered].slice(0, RECENTLY_VIEWED_MAX);
}

export function serialiseRecentlyViewed(ids: string[]): string {
  return ids.slice(0, RECENTLY_VIEWED_MAX).join(',');
}
