'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type SellerAdRow = {
  id: string;
  name: string;
  status: string;
  placement: string;
  productTitle: string;
  productSlug: string;
  bidCpcMinor: number;
  dailyBudgetMinor: number;
  spentTodayMinor: number;
  spentTotalMinor: number;
  totalBudgetMinor: number | null;
  currency: string;
  startsAt: Date;
  endsAt: Date | null;
  keywords: string[];
  // Aggregate stats over the last 30 days.
  impressions: number;
  clicks: number;
};

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  DRAFT: { bg: 'bg-amber-100', fg: 'text-amber-900' },
  ACTIVE: { bg: 'bg-emerald-100', fg: 'text-emerald-900' },
  PAUSED: { bg: 'bg-stone-200', fg: 'text-stone-700' },
  EXHAUSTED: { bg: 'bg-rose-100', fg: 'text-rose-900' },
  ENDED: { bg: 'bg-stone-200', fg: 'text-stone-700' },
};

function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

export function AdsList({ campaigns }: { campaigns: SellerAdRow[] }) {
  if (campaigns.length === 0) {
    return (
      <div className="rounded-3xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-600">
        No campaigns yet. Create one to start reaching shoppers searching for what
        you sell.
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {campaigns.map((c) => (
        <CampaignCard key={c.id} campaign={c} />
      ))}
    </ul>
  );
}

function CampaignCard({ campaign }: { campaign: SellerAdRow }) {
  const tone = STATUS_TONE[campaign.status] ?? STATUS_TONE.DRAFT!;
  // Click-through rate. Hide when impressions are too low to draw a stable
  // conclusion — guards against "100% CTR" theatre on day-one campaigns.
  const ctr =
    campaign.impressions >= 50
      ? `${((campaign.clicks / campaign.impressions) * 100).toFixed(2)}%`
      : '—';
  const avgCpcMinor =
    campaign.clicks > 0 ? Math.round(campaign.spentTotalMinor / campaign.clicks) : 0;

  return (
    <li className="rounded-3xl border border-stone-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-lg font-medium text-stone-950">{campaign.name}</p>
          <p className="mt-1 text-xs text-stone-500">
            <a
              className="hover:text-stone-950"
              href={`https://itsnottechy.cloud/product/${campaign.productSlug}`}
            >
              {campaign.productTitle}
            </a>
            {' · '}
            {campaign.placement.replace(/_/g, ' ').toLowerCase()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold ${tone.bg} ${tone.fg}`}
          >
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-current opacity-70" />
            {campaign.status}
          </span>
          <ActionMenu id={campaign.id} status={campaign.status} />
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Impressions (30d)" value={campaign.impressions.toLocaleString()} />
        <Stat label="Clicks (30d)" value={campaign.clicks.toLocaleString()} />
        <Stat label="CTR" value={ctr} />
        <Stat
          label="Avg CPC"
          value={avgCpcMinor > 0 ? formatMoney(avgCpcMinor, campaign.currency) : '—'}
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Pair label="Bid (max CPC)" value={formatMoney(campaign.bidCpcMinor, campaign.currency)} />
        <Pair
          label="Today's spend"
          value={`${formatMoney(campaign.spentTodayMinor, campaign.currency)} / ${formatMoney(
            campaign.dailyBudgetMinor,
            campaign.currency,
          )}`}
        />
        <Pair
          label="Lifetime spend"
          value={
            campaign.totalBudgetMinor
              ? `${formatMoney(campaign.spentTotalMinor, campaign.currency)} / ${formatMoney(
                  campaign.totalBudgetMinor,
                  campaign.currency,
                )}`
              : formatMoney(campaign.spentTotalMinor, campaign.currency)
          }
        />
      </div>

      {campaign.keywords.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {campaign.keywords.map((k) => (
            <span
              key={k}
              className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-700"
            >
              {k}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-stone-50 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
        {label}
      </p>
      <p className="mt-2 font-display text-2xl font-medium tabular-nums text-stone-950">
        {value}
      </p>
    </div>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
        {label}
      </p>
      <p className="mt-1 text-sm tabular-nums text-stone-900">{value}</p>
    </div>
  );
}

function ActionMenu({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function send(action: 'pause' | 'resume' | 'end') {
    if (action === 'end' && !confirm('End this campaign? It cannot be reactivated.')) return;
    setBusy(true);
    try {
      await fetch(`/api/seller/ads/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (status === 'ENDED' || status === 'EXHAUSTED' || status === 'DRAFT') {
    return null;
  }

  return (
    <div className="flex gap-2">
      {status === 'ACTIVE' && (
        <button
          onClick={() => send('pause')}
          disabled={busy}
          className="rounded-full border border-stone-300 px-3 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
        >
          Pause
        </button>
      )}
      {status === 'PAUSED' && (
        <button
          onClick={() => send('resume')}
          disabled={busy}
          className="rounded-full bg-emerald-700 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          Resume
        </button>
      )}
      <button
        onClick={() => send('end')}
        disabled={busy}
        className="rounded-full border border-stone-300 px-3 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
      >
        End
      </button>
    </div>
  );
}
