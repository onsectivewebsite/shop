'use client';

import { useState } from 'react';
import { Truck } from 'lucide-react';

export function ShipButton({ itemId }: { itemId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tracking, setTracking] = useState({
    carrier: 'fedex',
    awbNumber: '',
    trackingUrl: '',
  });

  async function ship() {
    setError(null);
    setBusy(true);
    try {
      const r = await fetch(`/api/seller/orders/${itemId}/ship`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(tracking),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? 'Could not mark shipped.');
        return;
      }
      window.location.reload();
    } catch {
      setError('Network error.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Carrier">
          <select
            value={tracking.carrier}
            onChange={(e) => setTracking({ ...tracking, carrier: e.target.value })}
            className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
          >
            <option value="fedex">FedEx</option>
            <option value="ups">UPS</option>
            <option value="usps">USPS</option>
            <option value="dhl">DHL</option>
            <option value="bluedart">BlueDart</option>
            <option value="delhivery">Delhivery</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Tracking number (AWB)">
          <input
            value={tracking.awbNumber}
            onChange={(e) => setTracking({ ...tracking, awbNumber: e.target.value })}
            placeholder="Optional"
            className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm font-mono"
          />
        </Field>
        <Field label="Tracking URL">
          <input
            value={tracking.trackingUrl}
            onChange={(e) => setTracking({ ...tracking, trackingUrl: e.target.value })}
            placeholder="https://"
            type="url"
            className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
          />
        </Field>
      </div>

      {error && <p className="text-sm text-error-600">{error}</p>}

      <button
        type="button"
        onClick={ship}
        disabled={busy}
        className="inline-flex h-11 items-center gap-2 rounded-full bg-emerald-700 px-6 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
      >
        <Truck size={14} strokeWidth={2} />
        {busy ? 'Marking shipped…' : 'Mark as shipped'}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-stone-700">{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}
