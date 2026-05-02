'use client';

import Link from 'next/link';
import { Card, CardContent } from '@onsective/ui';
import { trpc } from '@/lib/trpc';

export default function BuyerInboxPage() {
  const list = trpc.messages.list.useQuery();

  if (list.isLoading) {
    return (
      <div className="container-page py-12">
        <p className="text-slate-500">Loading…</p>
      </div>
    );
  }

  const conversations = list.data ?? [];
  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500">
            Inbox
          </p>
          <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-slate-950">
            Messages
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Conversations open with sellers about a specific order item.
          </p>
        </header>

        {conversations.length === 0 ? (
          <Card>
            <CardContent className="space-y-2 p-8 text-center">
              <p className="text-sm font-medium text-slate-900">No messages yet.</p>
              <p className="text-sm text-slate-500">
                Open an order and tap{' '}
                <span className="font-medium text-slate-700">Message seller</span> on any
                item to start a conversation.
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {conversations.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/account/messages/${c.id}`}
                  className="flex items-start gap-4 p-4 transition-colors hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {c.sellerName}
                      </p>
                      {c.lastMessageAt && (
                        <p className="flex-none text-xs text-slate-400 tabular-nums">
                          {new Date(c.lastMessageAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <p className="truncate text-xs text-slate-500">
                      About: {c.productTitle}{' '}
                      <span className="font-mono">· {c.orderNumber}</span>
                    </p>
                    {c.lastMessagePreview && (
                      <p className="mt-1 line-clamp-1 text-sm text-slate-600">
                        {c.lastAuthorRole === 'BUYER' && (
                          <span className="text-slate-400">You: </span>
                        )}
                        {c.lastMessagePreview}
                      </p>
                    )}
                  </div>
                  {c.unread && (
                    <span className="mt-1 inline-block h-2 w-2 flex-none rounded-full bg-cta-600" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
