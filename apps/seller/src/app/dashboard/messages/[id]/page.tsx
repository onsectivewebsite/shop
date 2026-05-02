import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getSellerSession } from '@/server/auth';
import { prisma } from '@/server/db';
import { SellerShell } from '@/components/seller-shell';
import { SellerMessageForm } from '@/components/message-form';

export const metadata = { title: 'Conversation' };
export const dynamic = 'force-dynamic';

export default async function SellerThreadPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSellerSession();
  if (!session) redirect('/login');

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!seller) redirect('/apply');

  const conv = await prisma.conversation.findFirst({
    where: { id: params.id, sellerId: seller.id },
    select: {
      id: true,
      buyer: { select: { fullName: true, email: true } },
      orderItem: {
        select: {
          productTitle: true,
          order: { select: { orderNumber: true } },
        },
      },
      messages: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, authorRole: true, body: true, createdAt: true },
      },
    },
  });
  if (!conv) notFound();

  // Mark read on view (seller side). Server-component side-effect — fine
  // because the page is force-dynamic and not cached.
  await prisma.conversation.update({
    where: { id: conv.id },
    data: { sellerLastReadAt: new Date() },
  });

  const buyerLabel = conv.buyer.fullName || conv.buyer.email;

  return (
    <SellerShell email={session.user.email} name={session.user.fullName ?? undefined}>
      <div className="container-page py-10 md:py-14">
        <div className="mx-auto max-w-2xl space-y-6">
          <Link
            href="/dashboard/messages"
            className="inline-flex text-sm text-stone-500 hover:text-stone-900"
          >
            ← Back to inbox
          </Link>

          <header className="rounded-lg border border-stone-200 bg-white p-4">
            <p className="text-sm font-semibold text-stone-900">{buyerLabel}</p>
            <p className="text-xs text-stone-500">
              About: {conv.orderItem.productTitle}{' '}
              <span className="font-mono">· {conv.orderItem.order.orderNumber}</span>
            </p>
          </header>

          <div className="space-y-3">
            {conv.messages.length === 0 && (
              <p className="text-center text-sm text-stone-400">
                No messages in this thread yet.
              </p>
            )}
            {conv.messages.map((m) => {
              const mine = m.authorRole === 'SELLER';
              return (
                <div
                  key={m.id}
                  className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                      mine
                        ? 'bg-emerald-700 text-white'
                        : 'bg-stone-100 text-stone-900'
                    }`}
                  >
                    <p className="whitespace-pre-line">{m.body}</p>
                    <p
                      className={`mt-1 text-[11px] ${
                        mine ? 'text-emerald-100' : 'text-stone-500'
                      }`}
                    >
                      {new Date(m.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <SellerMessageForm conversationId={conv.id} />
        </div>
      </div>
    </SellerShell>
  );
}
