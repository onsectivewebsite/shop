'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type NewCampaignProduct = {
  id: string;
  title: string;
};

export function NewCampaignForm({
  products,
  defaultCurrency,
}: {
  products: NewCampaignProduct[];
  defaultCurrency: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (products.length === 0) {
    return (
      <p className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
        Add a product before creating a campaign — sponsored ads need an active
        listing to point at.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
      >
        New campaign
      </button>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);

        const keywordsRaw = (fd.get('keywords') ?? '').toString();
        const totalBudgetRaw = (fd.get('totalBudget') ?? '').toString().trim();

        const payload = {
          name: (fd.get('name') ?? '').toString().trim(),
          productId: (fd.get('productId') ?? '').toString(),
          placement: (fd.get('placement') ?? '').toString(),
          bidCpc: Number(fd.get('bidCpc')),
          dailyBudget: Number(fd.get('dailyBudget')),
          totalBudget: totalBudgetRaw === '' ? null : Number(totalBudgetRaw),
          currency: (fd.get('currency') ?? defaultCurrency).toString().toUpperCase(),
          keywords: keywordsRaw
            .split(',')
            .map((k) => k.trim())
            .filter(Boolean),
          startsAt: (fd.get('startsAt') ?? '').toString(),
          endsAt: (fd.get('endsAt') ?? '').toString().trim() || null,
        };

        setBusy(true);
        setError(null);
        try {
          const res = await fetch('/api/seller/ads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            const data = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(data.error ?? 'Could not create campaign.');
          }
          form.reset();
          setOpen(false);
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not create campaign.');
        } finally {
          setBusy(false);
        }
      }}
      className="space-y-4 rounded-3xl border border-stone-200 bg-white p-6"
    >
      <div className="flex items-center justify-between">
        <p className="font-display text-lg font-medium text-stone-950">New campaign</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-stone-500 hover:text-stone-900"
        >
          Cancel
        </button>
      </div>

      <Field label="Campaign name">
        <input
          name="name"
          type="text"
          required
          maxLength={120}
          placeholder="Summer push for Aurora headphones"
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
        />
      </Field>

      <Field label="Product">
        <select
          name="productId"
          required
          defaultValue=""
          className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
        >
          <option value="" disabled>
            Choose a product…
          </option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Placement">
        <select
          name="placement"
          required
          defaultValue="SEARCH_RESULTS"
          className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
        >
          <option value="SEARCH_RESULTS">Search results</option>
          <option value="PDP_RELATED">Related products on PDPs</option>
          <option value="HOME_FEATURED">Featured on the homepage</option>
        </select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Max bid (CPC)">
          <div className="flex items-center gap-2">
            <input
              name="currency"
              type="text"
              defaultValue={defaultCurrency}
              maxLength={3}
              required
              className="w-16 rounded-md border border-stone-300 px-2 py-2 text-sm uppercase focus:border-stone-900 focus:outline-none"
            />
            <input
              name="bidCpc"
              type="number"
              min="0.01"
              step="0.01"
              required
              placeholder="0.40"
              className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
            />
          </div>
        </Field>

        <Field label="Daily budget">
          <input
            name="dailyBudget"
            type="number"
            min="1"
            step="0.01"
            required
            placeholder="20"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
          />
        </Field>

        <Field label="Lifetime budget (optional)">
          <input
            name="totalBudget"
            type="number"
            min="1"
            step="0.01"
            placeholder="No cap"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
          />
        </Field>
      </div>

      <Field
        label="Keywords (comma-separated, optional)"
        hint="Leave empty to match every search query in your placement. Up to 50."
      >
        <input
          name="keywords"
          type="text"
          maxLength={1000}
          placeholder="wireless headphones, anc earbuds, lumen"
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts">
          <input
            name="startsAt"
            type="datetime-local"
            required
            defaultValue={defaultStart()}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
          />
        </Field>
        <Field label="Ends (optional)">
          <input
            name="endsAt"
            type="datetime-local"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
          />
        </Field>
      </div>

      <p className="rounded-2xl bg-stone-50 p-3 text-xs text-stone-600">
        New campaigns start as <strong>DRAFT</strong> and go live once Onsective ops
        approves them. Approval is usually inside one business day.
      </p>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="rounded-full bg-emerald-700 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        {busy ? 'Submitting…' : 'Submit for approval'}
      </button>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium text-stone-900">{label}</span>
      {children}
      {hint && <span className="block text-xs text-stone-500">{hint}</span>}
    </label>
  );
}

function defaultStart(): string {
  // <input type="datetime-local"> wants a local-zone YYYY-MM-DDTHH:mm string.
  // Default to the next top-of-hour so the form is preset to a sensible value.
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
