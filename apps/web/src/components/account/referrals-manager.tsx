'use client';

import { useState } from 'react';
import { Card, CardContent } from '@onsective/ui';
import { Copy, Mail, Share2, Twitter } from 'lucide-react';
import { trpc } from '@/lib/trpc';

function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

export function ReferralsManager({ baseUrl }: { baseUrl: string }) {
  const q = trpc.referrals.me.useQuery();
  const [copied, setCopied] = useState(false);

  if (q.isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (q.error) return <p className="text-sm text-error-600">{q.error.message}</p>;
  if (!q.data) return null;

  const { code, stats } = q.data;
  const shareUrl = `${baseUrl}/r/${code}`;
  const shareMessage = `I'm shopping on Onsective — use my link for member perks: ${shareUrl}`;
  const currency = stats.currency ?? 'USD';

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-5 p-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500">
              Your referral link
            </p>
            <h2 className="mt-2 font-display text-2xl font-medium tracking-tight text-slate-950">
              Share Onsective. Earn on every signup that orders.
            </h2>
          </div>

          <div className="rounded-xl border border-slate-200 bg-stone-50 p-4">
            <p className="text-xs text-slate-500">Your code</p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-950">
              {code}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Share link</p>
            <p className="mt-1 break-all font-mono text-sm text-slate-700">{shareUrl}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={copyLink}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
              >
                <Copy size={12} strokeWidth={2} />
                {copied ? 'Copied' : 'Copy link'}
              </button>
              <a
                href={`mailto:?subject=${encodeURIComponent('Try Onsective')}&body=${encodeURIComponent(shareMessage)}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Mail size={12} strokeWidth={2} />
                Email
              </a>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Twitter size={12} strokeWidth={2} />
                Tweet
              </a>
              <button
                onClick={() => {
                  const nav = navigator as Navigator & {
                    share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
                  };
                  if (nav.share) {
                    nav.share({
                      title: 'Try Onsective',
                      text: shareMessage,
                      url: shareUrl,
                    }).catch(() => {});
                  } else {
                    void copyLink();
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Share2 size={12} strokeWidth={2} />
                More…
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Signups" value={stats.signups.toString()} />
        <Stat label="Made a purchase" value={stats.qualifyingOrders.toString()} />
        <Stat
          label="Earned"
          value={formatMoney(stats.earnedMinor, currency)}
          hint={
            stats.pendingPayoutMinor > 0
              ? `${formatMoney(stats.pendingPayoutMinor, currency)} pending payout`
              : undefined
          }
        />
      </div>

      <Card>
        <CardContent className="space-y-3 p-6 text-sm text-slate-600">
          <p className="font-medium text-slate-900">How it works</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Share your link or code with anyone you'd recommend Onsective to.</li>
            <li>They sign up via your link.</li>
            <li>When they place their first order, you earn a credit.</li>
          </ol>
          <p className="text-xs text-slate-500">
            Self-referrals don't count. Earnings are paid out to your account once
            verified — typically within 7 days of the qualifying order.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 font-display text-3xl font-medium tabular-nums text-slate-950">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
