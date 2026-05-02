'use client';

import { useState } from 'react';

const REASONS = [
  { value: 'SPAM', label: 'Spam' },
  { value: 'OFFENSIVE', label: 'Offensive language' },
  { value: 'HARASSMENT', label: 'Harassment' },
  { value: 'SCAM', label: 'Scam / fraud' },
  { value: 'OTHER', label: 'Other' },
] as const;

type Reason = (typeof REASONS)[number]['value'];

export function ReportMessageMenu({ messageId }: { messageId: string }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reported, setReported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (reported) {
    return (
      <p className="text-[11px] text-stone-500">Reported. We&apos;ll review it.</p>
    );
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[11px] text-stone-400 hover:text-stone-700"
      >
        Report message
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-48 overflow-hidden rounded-md border border-stone-200 bg-white shadow-md">
          {REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              disabled={submitting}
              onClick={async () => {
                setSubmitting(true);
                setError(null);
                try {
                  const res = await fetch(
                    `/api/seller/messages/${messageId}/report`,
                    {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ reason: r.value as Reason }),
                    },
                  );
                  if (!res.ok) {
                    const j = (await res.json().catch(() => ({}))) as {
                      error?: string;
                    };
                    setError(j.error ?? 'Could not report.');
                    return;
                  }
                  setReported(true);
                  setOpen(false);
                } finally {
                  setSubmitting(false);
                }
              }}
              className="block w-full px-3 py-2 text-left text-xs text-stone-700 hover:bg-stone-50 disabled:opacity-50"
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
