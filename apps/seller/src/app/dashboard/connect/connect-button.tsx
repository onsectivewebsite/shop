'use client';

import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';

export function ConnectButton({ disabled }: { disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    setBusy(true);
    try {
      const r = await fetch('/api/seller/connect', { method: 'POST' });
      const data = await r.json();
      if (!r.ok || !data.url) {
        setError(data.error ?? 'Could not start onboarding.');
        return;
      }
      window.location.href = data.url;
    } catch {
      setError('Network error.');
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={start}
        disabled={disabled || busy}
        className="inline-flex h-11 items-center gap-2 rounded-full bg-stone-900 px-6 text-sm font-semibold text-white transition-colors hover:bg-stone-800 disabled:opacity-60"
      >
        {busy ? 'Redirecting to Stripe…' : 'Connect Stripe Express'}
        {!busy && <ArrowUpRight size={14} strokeWidth={2} />}
      </button>
      {error && <p className="text-sm text-error-600">{error}</p>}
    </div>
  );
}
