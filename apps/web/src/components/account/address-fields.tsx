'use client';

import { useEffect, useRef, useState } from 'react';

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'IN', name: 'India' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'JP', name: 'Japan' },
  { code: 'SG', name: 'Singapore' },
];

type Suggestion = {
  label: string;
  line1: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
};

const DEBOUNCE_MS = 250;

/**
 * Owns the five interrelated address fields plus an autocomplete dropdown
 * on line1. On selection, every related field gets filled in one render
 * (state-driven). The form action still serializes them as form fields by
 * name — no JS submission, no reliance on React state at submit time.
 *
 * Autocomplete degrades gracefully when MAPBOX_GEOCODING_TOKEN is unset —
 * the proxy returns an empty list and the dropdown just doesn't appear.
 */
export function AddressFields({
  defaults,
}: {
  defaults?: {
    line1?: string;
    line2?: string | null;
    city?: string;
    state?: string;
    postalCode?: string;
    countryCode?: string;
  };
}) {
  const [line1, setLine1] = useState(defaults?.line1 ?? '');
  const [line2, setLine2] = useState(defaults?.line2 ?? '');
  const [city, setCity] = useState(defaults?.city ?? '');
  const [state, setState] = useState(defaults?.state ?? '');
  const [postalCode, setPostalCode] = useState(defaults?.postalCode ?? '');
  const [countryCode, setCountryCode] = useState(defaults?.countryCode ?? 'US');

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoreNext = useRef(false);

  useEffect(() => {
    if (ignoreNext.current) {
      ignoreNext.current = false;
      return;
    }
    if (line1.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const params = new URLSearchParams({ q: line1, country: countryCode.toLowerCase() });
      try {
        const res = await fetch(`/api/geocode/autocomplete?${params.toString()}`);
        if (!res.ok) return;
        const data = (await res.json()) as { features: Suggestion[] };
        setSuggestions(data.features);
        setActive(0);
        setOpen(data.features.length > 0);
      } catch {
        setSuggestions([]);
        setOpen(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [line1, countryCode]);

  const select = (s: Suggestion) => {
    // Suppress the next debounced query — the line1 we're about to write
    // shouldn't trigger another lookup that re-opens the dropdown.
    ignoreNext.current = true;
    setLine1(s.line1);
    setCity(s.city);
    setState(s.state);
    setPostalCode(s.postalCode);
    setCountryCode(s.countryCode);
    setOpen(false);
    setSuggestions([]);
  };

  return (
    <>
      <Field label="Address line 1">
        <div className="relative">
          <input
            name="line1"
            required
            value={line1}
            onChange={(e) => setLine1(e.target.value)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            onKeyDown={(e) => {
              if (!open) return;
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, suggestions.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                const s = suggestions[active];
                if (s) select(s);
              } else if (e.key === 'Escape') {
                setOpen(false);
              }
            }}
            autoComplete="address-line1"
            className="mt-1 h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
          />
          {open && suggestions.length > 0 && (
            <ul
              role="listbox"
              className="absolute left-0 right-0 z-10 mt-1 max-h-64 overflow-y-auto rounded-md border border-stone-200 bg-white shadow-lg"
            >
              {suggestions.map((s, i) => (
                <li
                  key={`${s.line1}-${s.postalCode}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  // mousedown beats blur — onBlur fires too late if we rely on click.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    select(s);
                  }}
                  className={
                    i === active
                      ? 'cursor-pointer bg-stone-100 px-3 py-2 text-sm text-stone-900'
                      : 'cursor-pointer px-3 py-2 text-sm text-stone-700 hover:bg-stone-50'
                  }
                >
                  {s.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Field>

      <Field label="Address line 2 (optional)">
        <input
          name="line2"
          value={line2}
          onChange={(e) => setLine2(e.target.value)}
          autoComplete="address-line2"
          className="mt-1 h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="City">
          <input
            name="city"
            required
            value={city}
            onChange={(e) => setCity(e.target.value)}
            autoComplete="address-level2"
            className="mt-1 h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
          />
        </Field>
        <Field label="State / region">
          <input
            name="state"
            required
            value={state}
            onChange={(e) => setState(e.target.value)}
            autoComplete="address-level1"
            className="mt-1 h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
          />
        </Field>
        <Field label="Postal code">
          <input
            name="postalCode"
            required
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            autoComplete="postal-code"
            className="mt-1 h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
          />
        </Field>
      </div>

      <Field label="Country">
        <select
          name="countryCode"
          required
          value={countryCode}
          onChange={(e) => setCountryCode(e.target.value)}
          autoComplete="country"
          className="mt-1 h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-stone-700">{label}</span>
      {children}
    </label>
  );
}
