'use client';

import { useState } from 'react';

const HINTS = [
  'Electronics',
  'Fashion',
  'Beauty',
  'Home & Kitchen',
  'Books',
  'Toys & Kids',
  'Grocery',
  'Sports & Outdoor',
];

export function ApplyForm({ defaultCountry }: { defaultCountry: string }) {
  const [form, setForm] = useState({
    legalName: '',
    displayName: '',
    countryCode: defaultCountry,
    website: '',
    taxId: '',
    description: '',
  });
  const [hints, setHints] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleHint(h: string) {
    setHints((prev) => (prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await fetch('/api/seller/apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, categoryHints: hints }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? 'Submission failed.');
        return;
      }
      window.location.href = '/dashboard';
    } catch {
      setError('Network error.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-stone-700">Legal business name</label>
          <input
            required
            value={form.legalName}
            onChange={(e) => setForm({ ...form, legalName: e.target.value })}
            placeholder="As registered with tax authority"
            className="mt-1 h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700">Storefront name</label>
          <input
            required
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            placeholder="What buyers see"
            className="mt-1 h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-stone-700">Country of operation</label>
          <select
            required
            value={form.countryCode}
            onChange={(e) => setForm({ ...form, countryCode: e.target.value })}
            className="mt-1 h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
          >
            <option value="US">United States</option>
            <option value="IN">India</option>
            <option value="GB">United Kingdom</option>
            <option value="CA">Canada</option>
            <option value="AU">Australia</option>
            <option value="DE">Germany</option>
            <option value="FR">France</option>
            <option value="JP">Japan</option>
            <option value="SG">Singapore</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700">Tax ID (optional)</label>
          <input
            value={form.taxId}
            onChange={(e) => setForm({ ...form, taxId: e.target.value })}
            placeholder="GSTIN / EIN / VAT"
            className="mt-1 h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700">Website (optional)</label>
        <input
          type="url"
          value={form.website}
          onChange={(e) => setForm({ ...form, website: e.target.value })}
          placeholder="https://"
          className="mt-1 h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700">What do you sell?</label>
        <textarea
          rows={4}
          maxLength={2000}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Tell us about your products, where you source them, what makes them special."
          className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700">Categories you plan to sell</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {HINTS.map((h) => {
            const active = hints.includes(h);
            return (
              <button
                key={h}
                type="button"
                onClick={() => toggleHint(h)}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  active
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-300 bg-white text-stone-700 hover:border-stone-500'
                }`}
              >
                {h}
              </button>
            );
          })}
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-error-600">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="h-11 w-full rounded-full bg-emerald-700 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
      >
        {busy ? 'Submitting…' : 'Submit application'}
      </button>
    </form>
  );
}
