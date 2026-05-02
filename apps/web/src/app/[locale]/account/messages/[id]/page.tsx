'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { Button, Card, CardContent } from '@onsective/ui';
import { trpc } from '@/lib/trpc';

const BODY_MAX = 2000;

export default function BuyerThreadPage() {
  const params = useParams<{ id: string }>();
  const conversationId = params.id;
  // Polls every 10s while the tab is open. Cheap enough at expected volume;
  // upgrade to SSE/websockets if it ever becomes a hot spot.
  const thread = trpc.messages.get.useQuery(
    { conversationId },
    { refetchInterval: 10_000 },
  );
  const utils = trpc.useUtils();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const send = trpc.messages.send.useMutation({
    onSuccess: () => {
      setBody('');
      setError(null);
      utils.messages.get.invalidate({ conversationId });
      utils.messages.list.invalidate();
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
        <p className="text-slate-500">Conversation not found.</p>
      </div>
    );
  }

  const t = thread.data;
  const cover = t.orderItem.variant.product.images[0];
  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link
          href="/account/messages"
          className="inline-flex text-sm text-slate-500 hover:text-slate-900"
        >
          ← Back to inbox
        </Link>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            {cover ? (
              <div className="relative h-12 w-12 flex-none overflow-hidden rounded border border-slate-200">
                <Image src={cover} alt="" fill sizes="48px" className="object-cover" />
              </div>
            ) : (
              <div className="h-12 w-12 flex-none rounded bg-slate-100" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">
                {t.seller.displayName}
              </p>
              <p className="truncate text-xs text-slate-500">
                About: {t.orderItem.productTitle}{' '}
                <span className="font-mono">· {t.orderItem.order.orderNumber}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {t.messages.length === 0 && (
            <p className="text-center text-sm text-slate-400">
              No messages yet — say hello.
            </p>
          )}
          {t.messages.map((m) => {
            const mine = m.authorRole === 'BUYER';
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
                    className={`mt-1 text-[11px] ${
                      mine ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    {new Date(m.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={tail} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = body.trim();
            if (trimmed.length === 0 || send.isLoading) return;
            send.mutate({ conversationId, body: trimmed });
          }}
          className="space-y-2"
        >
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
            rows={3}
            placeholder="Type your message…"
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
              disabled={send.isLoading || body.trim().length === 0}
            >
              {send.isLoading ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
