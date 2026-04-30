'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type SellerQuestionRow = {
  id: string;
  question: string;
  answer: string | null;
  answeredAt: Date | null;
  createdAt: Date;
  askerName: string;
  productTitle: string;
  productSlug: string;
};

export function QAList({ questions }: { questions: SellerQuestionRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (questions.length === 0) {
    return (
      <div className="rounded-3xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-600">
        No questions on your products yet.
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {questions.map((q) => (
        <li
          key={q.id}
          className="rounded-3xl border border-stone-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
            <a
              className="hover:text-stone-950"
              href={`https://itsnottechy.cloud/product/${q.productSlug}`}
            >
              {q.productTitle}
            </a>
          </p>
          <p className="mt-3 text-sm font-medium text-stone-900">Q: {q.question}</p>
          <p className="mt-1 text-xs text-stone-500">
            {q.askerName} · {new Date(q.createdAt).toLocaleDateString()}
          </p>

          <div className="mt-5 border-t border-stone-100 pt-5">
            {q.answer && editingId !== q.id ? (
              <SavedAnswer
                answer={q.answer}
                answeredAt={q.answeredAt}
                onEdit={() => setEditingId(q.id)}
                questionId={q.id}
              />
            ) : (
              <AnswerForm
                questionId={q.id}
                initial={q.answer ?? ''}
                onDone={() => setEditingId(null)}
              />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function AnswerForm({
  questionId,
  initial,
  onDone,
}: {
  questionId: string;
  initial: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [answer, setAnswer] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const trimmed = answer.trim();
        if (trimmed.length < 1) {
          setError('Write an answer before posting.');
          return;
        }
        setSaving(true);
        setError(null);
        try {
          const res = await fetch(`/api/seller/questions/${questionId}/answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answer: trimmed }),
          });
          if (!res.ok) {
            const data = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(data.error ?? 'Could not save answer.');
          }
          onDone();
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not save answer.');
        } finally {
          setSaving(false);
        }
      }}
      className="space-y-3"
    >
      <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
        Your answer
      </label>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="Be specific. The buyer can see this on the product page."
        className="w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm focus:border-stone-900 focus:outline-none"
      />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : initial ? 'Update answer' : 'Post answer'}
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

function SavedAnswer({
  questionId,
  answer,
  answeredAt,
  onEdit,
}: {
  questionId: string;
  answer: string;
  answeredAt: Date | null;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-900">
          Your answer
          {answeredAt && (
            <span className="ml-2 font-normal normal-case tracking-normal text-emerald-700/80">
              · {new Date(answeredAt).toLocaleDateString()}
            </span>
          )}
        </p>
        <div className="flex gap-3 text-xs font-medium">
          <button onClick={onEdit} className="text-emerald-900 hover:underline">
            Edit
          </button>
          <button
            onClick={async () => {
              if (!confirm('Remove this answer?')) return;
              setBusy(true);
              try {
                await fetch(`/api/seller/questions/${questionId}/answer`, {
                  method: 'DELETE',
                });
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
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-stone-800">{answer}</p>
    </div>
  );
}
