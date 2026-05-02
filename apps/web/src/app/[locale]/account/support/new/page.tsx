'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Card, CardContent } from '@onsective/ui';
import { trpc } from '@/lib/trpc';

const SUBJECT_MAX = 200;
const BODY_MAX = 10_000;

export default function NewTicketPage() {
  const router = useRouter();
  // Pre-fill the related-order box if the buyer arrived via a deep link
  // from /account/orders/<orderNumber> (?order=ONS-2026-…). Just a hint —
  // they can clear it.
  const sp = useSearchParams();
  const initialOrder = sp.get('order') ?? '';

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [orderNumber, setOrderNumber] = useState(initialOrder);
  const [error, setError] = useState<string | null>(null);

  const create = trpc.support.create.useMutation({
    onSuccess: ({ id }) => {
      router.replace(`/account/support/${id}`);
    },
    onError: (e) => setError(e.message),
  });

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link
          href="/account/support"
          className="inline-flex text-sm text-slate-500 hover:text-slate-900"
        >
          ← Back to tickets
        </Link>

        <header>
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500">
            Support
          </p>
          <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-slate-950">
            Open a new ticket
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            We aim to respond within 24 hours for normal-priority requests, faster
            for urgent ones.
          </p>
        </header>

        <Card>
          <CardContent className="space-y-4 p-6">
            <Field label="Subject">
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value.slice(0, SUBJECT_MAX))}
                placeholder="Short summary of the issue"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Priority">
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as typeof priority)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="LOW">Low — general question</option>
                  <option value="NORMAL">Normal — order issue</option>
                  <option value="HIGH">High — payment / account access</option>
                  <option value="URGENT">Urgent — account compromised</option>
                </select>
              </Field>
              <Field label="Related order (optional)">
                <input
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value.trim())}
                  placeholder="ONS-2026-000123"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm uppercase"
                />
              </Field>
            </div>

            <Field label="Describe the issue">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
                rows={8}
                placeholder="Tell us what happened, what you expected, and any steps you've tried."
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
              />
              <p className="mt-1 text-right text-xs text-slate-400 tabular-nums">
                {body.length}/{BODY_MAX}
              </p>
            </Field>

            {error && <p className="text-sm text-error-600">{error}</p>}

            <div className="flex justify-end">
              <Button
                variant="cta"
                size="lg"
                disabled={
                  create.isLoading ||
                  subject.trim().length < 3 ||
                  body.trim().length < 10
                }
                onClick={() => {
                  setError(null);
                  create.mutate({
                    subject: subject.trim(),
                    body: body.trim(),
                    priority,
                    relatedOrderNumber:
                      orderNumber.trim().length > 0 ? orderNumber.trim() : undefined,
                  });
                }}
              >
                {create.isLoading ? 'Submitting…' : 'Submit ticket'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-900">{label}</span>
      {children}
    </label>
  );
}
