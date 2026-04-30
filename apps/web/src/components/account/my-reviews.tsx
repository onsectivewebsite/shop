'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@onsective/ui';
import { trpc } from '@/lib/trpc';

const STAR_FULL = '★';
const STAR_EMPTY = '☆';

function StaticStars({ value }: { value: number }) {
  return (
    <span className="font-mono text-base leading-none text-amber-500">
      {STAR_FULL.repeat(value)}
      <span className="text-slate-300">{STAR_EMPTY.repeat(5 - value)}</span>
    </span>
  );
}

export function MyReviews() {
  const list = trpc.reviews.mine.useQuery({ limit: 50 });
  const utils = trpc.useUtils();
  const [editingId, setEditingId] = useState<string | null>(null);

  const remove = trpc.reviews.remove.useMutation({
    onSuccess: () => utils.reviews.mine.invalidate(),
  });

  if (list.isLoading) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }
  if (!list.data || list.data.items.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
        You haven't reviewed any purchases yet. Once an order is delivered, the
        product page will offer a "Leave a review" button.
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {list.data.items.map((r) => {
        const editing = editingId === r.id;
        return (
          <li
            key={r.id}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <Link
                  href={`/product/${r.product.slug}`}
                  className="text-sm font-semibold text-slate-900 hover:underline"
                >
                  {r.product.title}
                </Link>
                <div className="mt-1 flex items-center gap-2">
                  <StaticStars value={r.rating} />
                  <span className="text-xs text-slate-500">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                  {r.isHidden && (
                    <span className="rounded-sm bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-900">
                      Hidden by moderation
                    </span>
                  )}
                </div>
              </div>
              {!editing && !r.isHidden && (
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingId(r.id)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm('Delete this review?')) remove.mutate({ id: r.id });
                    }}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </div>

            {!editing && (
              <>
                {r.title && (
                  <p className="mt-3 text-sm font-semibold text-slate-900">{r.title}</p>
                )}
                {r.body && (
                  <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                    {r.body}
                  </p>
                )}
                {r.isHidden && r.hiddenReason && (
                  <p className="mt-2 text-xs italic text-slate-500">
                    Reason: {r.hiddenReason}
                  </p>
                )}
                {r.sellerReply && (
                  <div className="mt-3 rounded-md border border-slate-200 bg-stone-50 p-3 text-xs">
                    <p className="font-medium uppercase tracking-wide text-slate-500">
                      Seller response
                    </p>
                    <p className="mt-1 whitespace-pre-line text-slate-700">
                      {r.sellerReply}
                    </p>
                  </div>
                )}
              </>
            )}

            {editing && (
              <EditForm
                review={{ id: r.id, rating: r.rating, title: r.title, body: r.body, images: r.images }}
                onCancel={() => setEditingId(null)}
                onSaved={() => {
                  setEditingId(null);
                  utils.reviews.mine.invalidate();
                }}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function EditForm({
  review,
  onCancel,
  onSaved,
}: {
  review: {
    id: string;
    rating: number;
    title: string | null;
    body: string | null;
    images: string[];
  };
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [rating, setRating] = useState(review.rating);
  const [title, setTitle] = useState(review.title ?? '');
  const [body, setBody] = useState(review.body ?? '');
  const [error, setError] = useState<string | null>(null);

  const update = trpc.reviews.update.useMutation({
    onSuccess: onSaved,
    onError: (e) => setError(e.message),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        update.mutate({
          id: review.id,
          rating,
          title: title.trim() || undefined,
          body: body.trim() || undefined,
          images: review.images,
        });
      }}
      className="mt-3 space-y-3"
    >
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            className={`text-2xl leading-none ${n <= rating ? 'text-amber-500' : 'text-slate-300'}`}
          >
            {STAR_FULL}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={120}
        placeholder="Title (optional)"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={4000}
        placeholder="Review (optional)"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      {error && <p className="text-sm text-error-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={update.isLoading}>
          {update.isLoading ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
