import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSellerSession } from '@/server/auth';
import { prisma } from '@/server/db';
import { SellerShell } from '@/components/seller-shell';

export const metadata = { title: 'Messages' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 100;

export default async function SellerInboxPage() {
  const session = await getSellerSession();
  if (!session) redirect('/login');

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!seller) redirect('/apply');

  const conversations = await prisma.conversation.findMany({
    where: { sellerId: seller.id },
    orderBy: [
      { lastMessageAt: { sort: 'desc', nulls: 'last' } },
      { createdAt: 'desc' },
    ],
    take: PAGE_SIZE,
    select: {
      id: true,
      lastMessageAt: true,
      sellerLastReadAt: true,
      buyer: { select: { fullName: true, email: true } },
      orderItem: {
        select: {
          productTitle: true,
          order: { select: { orderNumber: true } },
        },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { body: true, authorRole: true, createdAt: true },
      },
    },
  });

  const unreadCount = conversations.filter(
    (c) =>
      !!c.lastMessageAt &&
      (!c.sellerLastReadAt || c.lastMessageAt > c.sellerLastReadAt) &&
      c.messages[0]?.authorRole === 'BUYER',
  ).length;

  return (
    <SellerShell email={session.user.email} name={session.user.fullName ?? undefined}>
      <div className="container-page py-10 md:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500">
              Inbox
            </p>
            <h1 className="mt-3 font-display text-4xl font-medium leading-tight tracking-tight text-stone-950">
              Messages
            </h1>
            <p className="mt-2 text-sm text-stone-600">
              Conversations buyers have started about their orders.
              {unreadCount > 0 && (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                  {unreadCount} new
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="mt-8">
          {conversations.length === 0 ? (
            <div className="rounded-lg border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">
              No messages yet.
            </div>
          ) : (
            <ul className="divide-y divide-stone-200 overflow-hidden rounded-lg border border-stone-200 bg-white">
              {conversations.map((c) => {
                const last = c.messages[0];
                const unread =
                  !!c.lastMessageAt &&
                  (!c.sellerLastReadAt || c.lastMessageAt > c.sellerLastReadAt) &&
                  last?.authorRole === 'BUYER';
                const buyerLabel = c.buyer.fullName || c.buyer.email;
                return (
                  <li key={c.id}>
                    <Link
                      href={`/dashboard/messages/${c.id}`}
                      className="flex items-start gap-4 p-4 transition-colors hover:bg-stone-50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="truncate text-sm font-semibold text-stone-900">
                            {buyerLabel}
                          </p>
                          {c.lastMessageAt && (
                            <p className="flex-none text-xs text-stone-400 tabular-nums">
                              {new Date(c.lastMessageAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <p className="truncate text-xs text-stone-500">
                          About: {c.orderItem.productTitle}{' '}
                          <span className="font-mono">· {c.orderItem.order.orderNumber}</span>
                        </p>
                        {last?.body && (
                          <p className="mt-1 line-clamp-1 text-sm text-stone-600">
                            {last.authorRole === 'SELLER' && (
                              <span className="text-stone-400">You: </span>
                            )}
                            {last.body}
                          </p>
                        )}
                      </div>
                      {unread && (
                        <span className="mt-1 inline-block h-2 w-2 flex-none rounded-full bg-emerald-600" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </SellerShell>
  );
}
