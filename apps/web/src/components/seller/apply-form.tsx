'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Label } from '@onsective/ui';
import { trpc } from '@/lib/trpc';

const CATEGORY_HINTS = [
  'Electronics',
  'Fashion',
  'Beauty',
  'Home & Kitchen',
  'Books',
  'Toys & Kids',
  'Grocery',
  'Sports & Outdoor',
];

export function SellerApplyForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    legalName: '',
    displayName: '',
    countryCode: 'US',
    website: '',
    taxId: '',
    description: '',
  });
  const [hints, setHints] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const apply = trpc.seller.application.apply.useMutation({
    onSuccess: () => {
      router.push('/sell?status=submitted');
      router.refresh();
    },
    onError: (e) => setError(e.message),
  });

  function toggleHint(h: string) {
    setHints((prev) => (prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h]));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        apply.mutate({
          legalName: form.legalName,
          displayName: form.displayName,
          countryCode: form.countryCode,
          description: form.description || undefined,
          taxId: form.taxId || undefined,
          website: form.website || undefined,
          categoryHints: hints,
        });
      }}
      className="space-y-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="legalName">Legal business name</Label>
          <Input
            id="legalName"
            required
            value={form.legalName}
            onChange={(e) => setForm({ ...form, legalName: e.target.value })}
            placeholder="As registered with tax authority"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="displayName">Storefront name</Label>
          <Input
            id="displayName"
            required
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            placeholder="What buyers see"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="country">Country of operation</Label>
          <select
            id="country"
            required
            value={form.countryCode}
            onChange={(e) => setForm({ ...form, countryCode: e.target.value })}
            className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
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
        <div className="space-y-1.5">
          <Label htmlFor="taxId">Tax ID (optional)</Label>
          <Input
            id="taxId"
            value={form.taxId}
            onChange={(e) => setForm({ ...form, taxId: e.target.value })}
            placeholder="GSTIN / EIN / VAT"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="website">Website (optional)</Label>
        <Input
          id="website"
          type="url"
          value={form.website}
          onChange={(e) => setForm({ ...form, website: e.target.value })}
          placeholder="https://"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">What do you sell?</Label>
        <textarea
          id="description"
          rows={4}
          maxLength={2000}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
          placeholder="Tell us about your products, where you source them, what makes them special."
        />
      </div>

      <div>
        <Label>Categories you plan to sell</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {CATEGORY_HINTS.map((h) => {
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

      {error && (
        <p role="alert" className="text-sm text-error-600">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={apply.isLoading}>
        {apply.isLoading ? 'Submitting…' : 'Submit application'}
      </Button>
      <p className="text-center text-xs text-slate-500">
        Onsective takes a category-tiered 8 — 15% commission. No subscription, no listing fees.
      </p>
    </form>
  );
}
