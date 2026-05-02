'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button, Card, CardContent } from '@onsective/ui';
import { trpc } from '@/lib/trpc';

const BODY_MAX = 10_000;

const STATUS_TONE: Record<string, string> = {
  OPEN: 'bg-cta-100 text-cta-800',
  PENDING_CUSTOMER: 'bg-amber-100 text-amber-800',
  PENDING_INTERNAL: 'bg-slate-100 text-slate-700',
  ON_HOLD: 'bg-slate-100 text-slate-700',
  RESOLVED: 'bg-emerald-100 text-emerald-800',
  CLOSED: 'bg-slate-200 text-slate-600',
  REOPENED: 'bg-cta-100 text-cta-800',
};

export default function TicketThreadPage() {
  const params = useParams<{ id: string }>();
  const ticketId = params.id;

  // Polls every 15s — support replies aren't real-time-critical but worth
  // surfacing without a manual refresh.
  const thread = trpc.support.get.useQuery(
    { ticketId },
    { refetchInterval: 15_000 },
  );
  const utils = trpc.useUtils();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const reply = trpc.support.reply.useMutation({
    onSuccess: () => {
      setBody('');
      setError(null);
      utils.support.get.invalidate({ ticketId });
      utils.support.list.invalidate();
    },
    onError: (e) => setError(e.message),
  });

  const tail = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    tail.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread.data?.messages.length]);

  if (thread.isLoading) {
    return (
      <div className="container-page py-12">
        <p className="text-slate-500">Loading…</p>
      </div>
    );
  }
  if (!thread.data) {
    return (
      <div className="container-page py-12">
        <p className="text-slate-500">Ticket not found.</p>
      </div>
    );
  }

  const t = thread.data;
  const closed = t.status === 'CLOSED';
  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link
          href="/account/support"
          className="inline-flex text-sm text-slate-500 hover:text-slate-900"
        >
          ← Back to tickets
        </Link>

        <header className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="font-mono text-xs text-slate-500">{t.ticketNumber}</p>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_TONE[t.status] ?? 'bg-slate-100 text-slate-700'}`}
            >
              {t.status.replaceAll('_', ' ')}
            </span>
          </div>
          <h1 className="mt-1 text-lg font-semibold text-slate-900">{t.subject}</h1>
        </header>

        <div className="space-y-3">
          {t.messages.map((m) => {
            const mine = m.authorType === 'CUSTOMER';
            return (
              <div
                key={m.id}
                className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                    mine
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-900'
                  }`}
                >
                  <p className="whitespace-pre-line">{m.body}</p>
                  <p
                    className={`mt-1 text-[11px] ${mine ? 'text-slate-300' : 'text-slate-500'}`}
                  >
                    {new Date(m.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={tail} />
        </div>

        {closed ? (
          <Card>
            <CardContent className="space-y-2 p-4 text-center">
              <p className="text-sm text-slate-500">
                This ticket is closed. Open a new one if you need more help.
              </p>
              <Link href="/account/support/new">
                <Button variant="cta">New ticket</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = body.trim();
              if (trimmed.length === 0 || reply.isLoading) return;
              reply.mutate({ ticketId, body: trimmed });
            }}
            className="space-y-2"
          >
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
              rows={4}
              placeholder="Add a reply…"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
            />
            {error && <p className="text-sm text-error-600">{error}</p>}
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400 tabular-nums">
                {body.length}/{BODY_MAX}
              </p>
              <Button
                type="submit"
                variant="cta"
                disabled={reply.isLoading || body.trim().length === 0}
              >
                {reply.isLoading ? 'Sending…' : 'Send reply'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
