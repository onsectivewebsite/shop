'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const STAR_FULL = '★';
const STAR_EMPTY = '☆';

export type SellerReviewRow = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  buyerName: string;
  createdAt: Date;
  sellerReply: string | null;
  sellerRepliedAt: Date | null;
  productTitle: string;
  productSlug: string;
};

export function ReviewsList({ reviews }: { reviews: SellerReviewRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (reviews.length === 0) {
    return (
      <div className="rounded-3xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-600">
        No reviews on your products yet. Once a buyer rates a delivered order,
        their review lands here.
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {reviews.map((r) => (
        <li
          key={r.id}
          className="rounded-3xl border border-stone-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                <a
                  className="hover:text-stone-950"
                  href={`https://itsnottechy.cloud/product/${r.productSlug}`}
                >
                  {r.productTitle}
                </a>
              </p>
              <div className="mt-2 flex items-center gap-3">
                <span className="font-mono text-base leading-none text-amber-500">
                  {STAR_FULL.repeat(r.rating)}
                  <span className="text-stone-300">{STAR_EMPTY.repeat(5 - r.rating)}</span>
                </span>
                <span className="text-xs text-stone-500">
                  {r.buyerName} · {new Date(r.createdAt).toLocaleDateString()}
                </span>
              </div>
              {r.title && (
                <p className="mt-3 text-sm font-semibold text-stone-900">{r.title}</p>
              )}
              {r.body && (
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-stone-700">
                  {r.body}
                </p>
              )}
            </div>
          </div>

          <div className="mt-5 border-t border-stone-100 pt-5">
            {r.sellerReply && editingId !== r.id ? (
              <SavedReply
                reply={r.sellerReply}
                repliedAt={r.sellerRepliedAt}
                onEdit={() => setEditingId(r.id)}
                reviewId={r.id}
              />
            ) : (
              <ReplyForm
                reviewId={r.id}
                initial={r.sellerReply ?? ''}
                onDone={() => setEditingId(null)}
              />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function ReplyForm({
  reviewId,
  initial,
  onDone,
}: {
  reviewId: string;
  initial: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [reply, setReply] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const trimmed = reply.trim();
        if (trimmed.length < 1) {
          setError('Write something before posting.');
          return;
        }
        setSaving(true);
        setError(null);
        try {
          const res = await fetch(`/api/seller/reviews/${reviewId}/reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reply: trimmed }),
          });
          if (!res.ok) {
            const data = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(data.error ?? 'Could not save reply.');
          }
          onDone();
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not save reply.');
        } finally {
          setSaving(false);
        }
      }}
      className="space-y-3"
    >
      <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
        Your response
      </label>
      <textarea
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="Thank the buyer, address the issue, or share context. This is public."
        className="w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm focus:border-stone-900 focus:outline-none"
      />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : initial ? 'Update reply' : 'Post reply'}
        </button>
        {initial && (
          <button
            type="button"
            onClick={onDone}
            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function SavedReply({
  reviewId,
  reply,
  repliedAt,
  onEdit,
}: {
  reviewId: string;
  reply: string;
  repliedAt: Date | null;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-900">
          Your response
          {repliedAt && (
            <span className="ml-2 font-normal normal-case tracking-normal text-emerald-700/80">
              · {new Date(repliedAt).toLocaleDateString()}
            </span>
          )}
        </p>
        <div className="flex gap-3 text-xs font-medium">
          <button onClick={onEdit} className="text-emerald-900 hover:underline">
            Edit
          </button>
          <button
            onClick={async () => {
              if (!confirm('Remove your response?')) return;
              setBusy(true);
              try {
                await fetch(`/api/seller/reviews/${reviewId}/reply`, { method: 'DELETE' });
                router.refresh();
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
            className="text-emerald-900 hover:underline disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      </div>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-stone-800">{reply}</p>
    </div>
  );
}
