'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const BODY_MAX = 2000;

export function SellerMessageForm({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const trimmed = body.trim();
        if (trimmed.length === 0 || submitting) return;
        setSubmitting(true);
        setError(null);
        try {
          const res = await fetch(
            `/api/seller/conversations/${conversationId}/messages`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ body: trimmed }),
            },
          );
          if (!res.ok) {
            const json = (await res.json().catch(() => ({}))) as { error?: string };
            setError(json.error ?? 'Could not send message.');
            return;
          }
          setBody('');
          router.refresh();
        } finally {
          setSubmitting(false);
        }
      }}
      className="space-y-2"
    >
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
        rows={3}
        placeholder="Type your reply…"
        className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center justify-between">
        <p className="text-xs text-stone-400 tabular-nums">
          {body.length}/{BODY_MAX}
        </p>
        <button
          type="submit"
          disabled={submitting || body.trim().length === 0}
          className="inline-flex h-9 items-center rounded-full bg-emerald-700 px-5 text-sm font-medium text-white transition-colors hover:bg-emerald-800 disabled:opacity-50"
        >
          {submitting ? 'Sending…' : 'Send'}
        </button>
      </div>
    </form>
  );
}
