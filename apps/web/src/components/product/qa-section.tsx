'use client';

import { useState } from 'react';
import { Button } from '@onsective/ui';
import { trpc } from '@/lib/trpc';

export function QASection({ productId }: { productId: string }) {
  const list = trpc.qa.list.useQuery({ productId, limit: 20 });
  const me = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();
  const [showForm, setShowForm] = useState(false);
  const [question, setQuestion] = useState('');
  const [error, setError] = useState<string | null>(null);

  const ask = trpc.qa.ask.useMutation({
    onSuccess: () => {
      setQuestion('');
      setShowForm(false);
      utils.qa.list.invalidate({ productId });
    },
    onError: (e) => setError(e.message),
  });

  return (
    <section className="mt-12 max-w-3xl border-t border-slate-200 pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Questions &amp; answers</h2>
          <p className="mt-1 text-sm text-slate-500">
            {list.data && list.data.total > 0
              ? `${list.data.total} ${list.data.total === 1 ? 'question' : 'questions'}`
              : 'Be the first to ask.'}
          </p>
        </div>
        {!showForm && (
          <Button
            onClick={() => {
              if (!me.data) {
                window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
                return;
              }
              setShowForm(true);
            }}
          >
            Ask a question
          </Button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = question.trim();
            if (trimmed.length < 5) {
              setError('Make your question at least 5 characters.');
              return;
            }
            setError(null);
            ask.mutate({ productId, question: trimmed });
          }}
          className="mt-5 space-y-3 rounded-lg border border-slate-200 bg-white p-5"
        >
          <label htmlFor="qa-q" className="text-sm font-medium text-slate-900">
            Your question
          </label>
          <textarea
            id="qa-q"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            maxLength={600}
            placeholder="What do you want to know about this product?"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
          />
          <p className="text-xs text-slate-500">
            The seller will be notified. Answers are public.
          </p>
          {error && <p className="text-sm text-error-600">{error}</p>}
          <div className="flex gap-3">
            <Button type="submit" disabled={ask.isLoading}>
              {ask.isLoading ? 'Posting…' : 'Post question'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowForm(false);
                setQuestion('');
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      <ul className="mt-8 space-y-6">
        {list.data?.items.map((q) => (
          <li
            key={q.id}
            className="border-b border-slate-100 pb-6 last:border-b-0 last:pb-0"
          >
            <p className="text-sm font-medium text-slate-900">Q: {q.question}</p>
            <p className="mt-1 text-xs text-slate-500">
              {q.askerLabel} · {new Date(q.createdAt).toLocaleDateString()}
            </p>
            {q.answer ? (
              <div className="mt-3 rounded-lg border border-slate-200 bg-stone-50 p-3 text-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Seller answer
                  {q.answeredAt && (
                    <span className="ml-2 font-normal normal-case text-slate-400">
                      {new Date(q.answeredAt).toLocaleDateString()}
                    </span>
                  )}
                </p>
                <p className="mt-1 whitespace-pre-line text-slate-700">{q.answer}</p>
              </div>
            ) : (
              <p className="mt-2 text-xs italic text-slate-500">Awaiting an answer.</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
