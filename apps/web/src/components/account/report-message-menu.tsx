'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';

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
  const [reported, setReported] = useState(false);
  const report = trpc.messages.report.useMutation({
    onSuccess: () => {
      setReported(true);
      setOpen(false);
    },
  });

  if (reported) {
    return (
      <p className="text-[11px] text-slate-500">Reported. We&apos;ll review it.</p>
    );
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[11px] text-slate-400 hover:text-slate-700"
      >
        Report message
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-48 overflow-hidden rounded-md border border-slate-200 bg-white shadow-md">
          {REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              disabled={report.isLoading}
              onClick={() =>
                report.mutate({ messageId, reason: r.value as Reason })
              }
              className="block w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
      {report.error && (
        <p className="mt-1 text-[11px] text-error-600">{report.error.message}</p>
      )}
    </div>
  );
}
