'use client';

import { useState } from 'react';
import { Button } from '@onsective/ui';
import { trpc } from '@/lib/trpc';

const REASONS = [
  { value: 'DAMAGED', label: 'Arrived damaged' },
  { value: 'WRONG_ITEM', label: 'Wrong item' },
  { value: 'NOT_AS_DESCRIBED', label: 'Not as described' },
  { value: 'NO_LONGER_NEEDED', label: 'No longer needed' },
  { value: 'ARRIVED_LATE', label: 'Arrived late' },
  { value: 'OTHER', label: 'Other' },
] as const;

type Reason = (typeof REASONS)[number]['value'];

export function RequestReturnButton({ orderItemId, maxQty }: { orderItemId: string; maxQty: number }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason>('NOT_AS_DESCRIBED');
  const [note, setNote] = useState('');
  const [qty, setQty] = useState(maxQty);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const request = trpc.returns.request.useMutation({
    onSuccess: (r) => {
      setSubmitted(r.rmaNumber);
      setOpen(false);
      utils.returns.list.invalidate();
    },
    onError: (e) => setError(e.message),
  });

  if (submitted) {
    return (
      <p className="text-sm text-success-700">
        Return request submitted: <span className="font-mono">{submitted}</span>
      </p>
    );
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Request return
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-700">Reason</label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value as Reason)}
          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
        >
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-700">Quantity</label>
        <select
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm"
        >
          {Array.from({ length: maxQty }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-700">Notes (optional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={2000}
          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <Button
          variant="cta"
          size="sm"
          disabled={request.isLoading}
          onClick={() => {
            setError(null);
            request.mutate({
              orderItemId,
              reason,
              qty,
              buyerNote: note.trim() || undefined,
            });
          }}
        >
          {request.isLoading ? 'Submitting…' : 'Submit'}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {error && <p className="text-xs text-error-600">{error}</p>}
    </div>
  );
}
