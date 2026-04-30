'use client';

import { useState } from 'react';
import { Button } from '@onsective/ui';
import { trpc } from '@/lib/trpc';

const STAR_FULL = '★';
const STAR_EMPTY = '☆';

function Stars({ value, size = 'sm' }: { value: number; size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'text-2xl' : 'text-base';
  const rounded = Math.round(value);
  return (
    <span className={`${cls} font-mono leading-none text-amber-500`}>
      {STAR_FULL.repeat(rounded)}
      <span className="text-slate-300">{STAR_EMPTY.repeat(5 - rounded)}</span>
    </span>
  );
}

export function ReviewsSection({ productId }: { productId: string }) {
  const list = trpc.reviews.list.useQuery({ productId, limit: 10 });
  const eligibility = trpc.reviews.eligibility.useQuery({ productId });
  const utils = trpc.useUtils();
  const [showForm, setShowForm] = useState(false);

  return (
    <section className="mt-12 max-w-3xl border-t border-slate-200 pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Reviews</h2>
          {list.data && list.data.total > 0 ? (
            <div className="mt-2 flex items-center gap-3">
              <Stars value={list.data.average} size="lg" />
              <span className="text-sm text-slate-700">
                <span className="font-semibold text-slate-900">
                  {list.data.average.toFixed(1)}
                </span>{' '}
                · {list.data.total}{' '}
                {list.data.total === 1 ? 'review' : 'reviews'}
              </span>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No reviews yet.</p>
          )}
        </div>

        {eligibility.data?.eligible && !showForm && (
          <Button onClick={() => setShowForm(true)}>Leave a review</Button>
        )}
      </div>

      {list.data && list.data.total > 0 && (
        <ul className="mt-5 space-y-1.5 text-sm text-slate-600">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = list.data.distribution[star] ?? 0;
            const pct = list.data.total > 0 ? (count / list.data.total) * 100 : 0;
            return (
              <li key={star} className="flex items-center gap-3">
                <span className="w-12">{star} star</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
                  <span
                    className="block h-full bg-amber-400"
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="w-8 text-right tabular-nums">{count}</span>
              </li>
            );
          })}
        </ul>
      )}

      {showForm && eligibility.data?.eligible && eligibility.data.items[0] && (
        <ReviewForm
          orderItemId={eligibility.data.items[0].id}
          productLabel={
            eligibility.data.items[0].variantTitle
              ? `${eligibility.data.items[0].productTitle} · ${eligibility.data.items[0].variantTitle}`
              : eligibility.data.items[0].productTitle
          }
          onCancel={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            utils.reviews.list.invalidate({ productId });
            utils.reviews.eligibility.invalidate({ productId });
          }}
        />
      )}

      <ul className="mt-8 space-y-6">
        {list.data?.items.map((r) => (
          <li
            key={r.id}
            className="border-b border-slate-100 pb-6 last:border-b-0 last:pb-0"
          >
            <div className="flex items-center gap-2">
              <Stars value={r.rating} />
              {r.title && (
                <span className="text-sm font-semibold text-slate-900">{r.title}</span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {r.buyerLabel} ·{' '}
              <span className="rounded-sm bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-900">
                Verified purchase
              </span>{' '}
              · {new Date(r.createdAt).toLocaleDateString()}
            </p>
            {r.body && (
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                {r.body}
              </p>
            )}
            {r.images.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {r.images.map((src) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    key={src}
                    src={src}
                    alt=""
                    className="h-20 w-20 rounded object-cover"
                  />
                ))}
              </ul>
            )}
            {r.sellerReply && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-stone-50 p-3 text-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Seller response
                </p>
                <p className="mt-1 whitespace-pre-line text-slate-700">{r.sellerReply}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReviewForm({
  orderItemId,
  productLabel,
  onCancel,
  onCreated,
}: {
  orderItemId: string;
  productLabel: string;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = trpc.reviews.create.useMutation({
    onSuccess: onCreated,
    onError: (e) => setError(e.message),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (rating < 1) {
          setError('Pick a rating from 1 to 5.');
          return;
        }
        setError(null);
        create.mutate({
          orderItemId,
          rating,
          title: title.trim() || undefined,
          body: body.trim() || undefined,
          images: [],
        });
      }}
      className="mt-6 space-y-4 rounded-lg border border-slate-200 bg-white p-5"
    >
      <p className="text-sm text-slate-600">
        Reviewing your purchase of{' '}
        <span className="font-medium text-slate-900">{productLabel}</span>.
      </p>
      <div>
        <p className="text-sm font-medium text-slate-900">Your rating</p>
        <div className="mt-1 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              aria-label={`${n} star${n === 1 ? '' : 's'}`}
              className={`text-3xl leading-none transition-colors ${
                n <= rating ? 'text-amber-500' : 'text-slate-300 hover:text-amber-300'
              }`}
            >
              {STAR_FULL}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="rev-title" className="text-sm font-medium text-slate-900">
          Title <span className="text-slate-500">(optional)</span>
        </label>
        <input
          id="rev-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="rev-body" className="text-sm font-medium text-slate-900">
          Review <span className="text-slate-500">(optional)</span>
        </label>
        <textarea
          id="rev-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          maxLength={4000}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
        />
      </div>
      {error && <p className="text-sm text-error-600">{error}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={create.isLoading}>
          {create.isLoading ? 'Posting…' : 'Post review'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
