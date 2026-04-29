'use client';

import { useState } from 'react';

export function SignupForm() {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    countryCode: 'US',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? 'Signup failed.');
        return;
      }
      // Account created and signed in (no email-verify gate on the seller portal —
      // KYC verification happens later, in the apply flow).
      window.location.href = '/apply';
    } catch {
      setError('Network error.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-stone-700">Full name</label>
        <input
          required
          autoComplete="name"
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          className="mt-1 h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-stone-700">Email</label>
        <input
          type="email"
          required
          autoComplete="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="mt-1 h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-stone-700">Password</label>
        <input
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="mt-1 h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
        />
        <p className="mt-1 text-xs text-stone-500">At least 10 characters.</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-stone-700">Country</label>
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
      {error && <p role="alert" className="text-sm text-error-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="h-11 w-full rounded-full bg-emerald-700 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
      >
        {busy ? 'Creating account…' : 'Create account & continue'}
      </button>
      <p className="text-center text-xs text-stone-500">
        Onsective takes a category-tiered 8 — 15% commission. No subscription.
      </p>
    </form>
  );
}
