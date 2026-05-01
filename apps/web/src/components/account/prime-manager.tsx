'use client';

import { useState } from 'react';
import { Button, Card, CardContent } from '@onsective/ui';
import { Truck, Headphones, Tags, Sparkles } from 'lucide-react';
import { trpc } from '@/lib/trpc';

const PERKS = [
  {
    icon: Truck,
    title: 'Free 2-day shipping',
    body: 'Most orders arrive in 2 days at no extra charge. International standard ships at flat rates.',
  },
  {
    icon: Tags,
    title: 'Member-only deals',
    body: 'Early access to seasonal sales and a Prime tag on selected listings every week.',
  },
  {
    icon: Headphones,
    title: 'Priority support',
    body: 'Front-of-the-queue routing for tickets — usually answered within an hour during business hours.',
  },
  {
    icon: Sparkles,
    title: 'Cashback on returns',
    body: 'Changed-mind returns ship free, no restocking fee.',
  },
];

const PLANS: Array<{
  id: 'MONTHLY' | 'ANNUAL';
  label: string;
  priceLabel: string;
  perPeriod: string;
  hint?: string;
}> = [
  { id: 'MONTHLY', label: 'Monthly', priceLabel: '$9.99', perPeriod: 'per month' },
  {
    id: 'ANNUAL',
    label: 'Annual',
    priceLabel: '$89',
    perPeriod: 'per year',
    hint: 'Save 25% — best value',
  },
];

export function PrimeManager() {
  const status = trpc.prime.status.useQuery();
  const utils = trpc.useUtils();
  const [busy, setBusy] = useState<'MONTHLY' | 'ANNUAL' | 'cancel' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = trpc.prime.startCheckout.useMutation({
    onSuccess: ({ url }) => {
      // Hand off to Stripe Checkout — the user lands back on /account/prime
      // with ?status=success after the subscription is created.
      window.location.href = url;
    },
    onError: (e) => {
      setError(e.message);
      setBusy(null);
    },
  });

  const cancel = trpc.prime.cancel.useMutation({
    onSuccess: () => {
      utils.prime.status.invalidate();
      setBusy(null);
    },
    onError: (e) => {
      setError(e.message);
      setBusy(null);
    },
  });

  if (status.isLoading) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  const isActive = status.data?.active ?? false;
  const cancelled = status.data?.status === 'CANCELLED';
  const currentPeriodEnd = status.data?.currentPeriodEnd
    ? new Date(status.data.currentPeriodEnd)
    : null;

  if (isActive && status.data) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-700">
                  Member
                </p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">
                  Onsective Prime · {status.data.plan === 'ANNUAL' ? 'Annual' : 'Monthly'}
                </h2>
                {currentPeriodEnd && (
                  <p className="mt-1 text-sm text-slate-600">
                    {cancelled
                      ? `Ends ${currentPeriodEnd.toLocaleDateString()}`
                      : `Renews ${currentPeriodEnd.toLocaleDateString()}`}
                  </p>
                )}
              </div>
              {!cancelled && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (!confirm('Cancel at end of period? You keep Prime perks until then.')) return;
                    setError(null);
                    setBusy('cancel');
                    cancel.mutate();
                  }}
                  disabled={busy === 'cancel'}
                >
                  {busy === 'cancel' ? 'Cancelling…' : 'Cancel renewal'}
                </Button>
              )}
            </div>
            {error && <p className="text-sm text-error-600">{error}</p>}
          </CardContent>
        </Card>
        <PerksGrid />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500">
              Onsective Prime
            </p>
            <h2 className="font-display text-3xl font-medium tracking-tight text-slate-950">
              Faster shipping. Member-only deals. Priority support.
            </h2>
            <p className="text-sm text-slate-600">
              Cancel anytime. Two months free with annual.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {PLANS.map((p) => (
              <div
                key={p.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-stone-50 p-5"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{p.label}</p>
                  <p className="mt-2 font-display text-3xl font-medium tabular-nums text-slate-950">
                    {p.priceLabel}
                  </p>
                  <p className="text-xs text-slate-500">{p.perPeriod}</p>
                  {p.hint && (
                    <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-emerald-700">
                      {p.hint}
                    </p>
                  )}
                </div>
                <Button
                  variant="cta"
                  className="mt-5"
                  onClick={() => {
                    setError(null);
                    setBusy(p.id);
                    start.mutate({ plan: p.id });
                  }}
                  disabled={busy !== null}
                >
                  {busy === p.id ? 'Redirecting to Stripe…' : `Get Prime ${p.label}`}
                </Button>
              </div>
            ))}
          </div>

          {error && <p className="text-sm text-error-600">{error}</p>}
        </CardContent>
      </Card>
      <PerksGrid />
    </div>
  );
}

function PerksGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {PERKS.map((p) => {
        const Icon = p.icon;
        return (
          <div key={p.title} className="rounded-2xl border border-slate-200 bg-white p-5">
            <Icon size={18} strokeWidth={1.5} className="text-slate-700" />
            <p className="mt-4 text-sm font-semibold text-slate-900">{p.title}</p>
            <p className="mt-1 text-sm text-slate-600">{p.body}</p>
          </div>
        );
      })}
    </div>
  );
}
