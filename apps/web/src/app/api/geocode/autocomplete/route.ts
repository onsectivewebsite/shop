import { NextResponse } from 'next/server';

/**
 * Server-side proxy to Mapbox Geocoding for address autocomplete.
 * Token never reaches the browser. Graceful degradation when unset:
 * returns 200 with `features: []` so the client falls through to plain
 * manual entry without surfacing an error.
 *
 * Mapbox response shape (truncated to what the client uses):
 *   features: [{
 *     place_name: "1 Infinite Loop, Cupertino, California 95014, United States",
 *     text: "1 Infinite Loop",         // street name
 *     address: "1",                    // street number
 *     center: [lng, lat],
 *     context: [
 *       { id: "postcode.…", text: "95014" },
 *       { id: "place.…",    text: "Cupertino" },
 *       { id: "region.…",   text: "California", short_code: "US-CA" },
 *       { id: "country.…",  text: "United States", short_code: "us" },
 *     ]
 *   }]
 */

type MapboxFeature = {
  place_name?: string;
  text?: string;
  address?: string;
  context?: Array<{ id: string; text: string; short_code?: string }>;
};

type ParsedSuggestion = {
  label: string;
  line1: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
};

function parseFeature(f: MapboxFeature): ParsedSuggestion | null {
  const street = f.text ?? '';
  const number = f.address ?? '';
  const line1 = number ? `${number} ${street}` : street;
  if (line1.length === 0) return null;

  const ctx = new Map<string, { text: string; shortCode?: string }>();
  for (const c of f.context ?? []) {
    const kind = c.id.split('.')[0]!;
    ctx.set(kind, { text: c.text, shortCode: c.short_code });
  }
  const city = ctx.get('place')?.text ?? ctx.get('locality')?.text ?? '';
  // region.short_code is "US-CA" — strip the "US-" so the form gets "CA".
  const region = ctx.get('region');
  const state = region?.shortCode?.split('-')[1]?.toUpperCase() ?? region?.text ?? '';
  const postalCode = ctx.get('postcode')?.text ?? '';
  const countryShort = ctx.get('country')?.shortCode?.toUpperCase() ?? '';

  if (city.length === 0 || countryShort.length === 0) return null;

  return {
    label: f.place_name ?? line1,
    line1,
    city,
    state,
    postalCode,
    countryCode: countryShort,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const country = (url.searchParams.get('country') ?? '').trim().toLowerCase();
  if (q.length < 3) {
    return NextResponse.json({ features: [] });
  }

  const token = process.env.MAPBOX_GEOCODING_TOKEN;
  if (!token) {
    // Caller treats empty list as "no autocomplete available" and falls
    // through to plain manual entry.
    return NextResponse.json({ features: [] });
  }

  const params = new URLSearchParams({
    access_token: token,
    autocomplete: 'true',
    limit: '5',
    types: 'address',
  });
  if (country) params.set('country', country);

  const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?${params.toString()}`;
  let data: { features?: MapboxFeature[] };
  try {
    const res = await fetch(endpoint, {
      // Mapbox is happy to be cached briefly per query — keystrokes that
      // produce the same prefix don't need to round-trip.
      next: { revalidate: 60 },
    });
    if (!res.ok) return NextResponse.json({ features: [] });
    data = (await res.json()) as { features?: MapboxFeature[] };
  } catch {
    return NextResponse.json({ features: [] });
  }

  const features = (data.features ?? [])
    .map(parseFeature)
    .filter((s): s is ParsedSuggestion => s !== null);

  return NextResponse.json({ features });
}
