import geoip from 'geoip-lite';

/**
 * Map an IP address to an ISO 3166-1 alpha-2 country code, or null when the
 * address can't be resolved (private, IPv6 not in db, malformed). The
 * geoip-lite database ships in-process — no network call.
 *
 * `x-forwarded-for` chains are common at our edge, so callers should pass
 * either the leftmost address or the result of `splitForwardedFor()` below.
 */
export function lookupCountry(ip: string | null | undefined): string | null {
  if (!ip) return null;
  try {
    const lookup = geoip.lookup(ip);
    return lookup?.country ?? null;
  } catch {
    return null;
  }
}

/**
 * Pull the originating client IP out of an `x-forwarded-for` chain. Returns
 * the leftmost entry (the original client per RFC 7239); intermediate proxy
 * IPs are stripped.
 */
export function splitForwardedFor(value: string | null | undefined): string | null {
  if (!value) return null;
  const first = value.split(',')[0]?.trim();
  return first && first.length > 0 ? first : null;
}
