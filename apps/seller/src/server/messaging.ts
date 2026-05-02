import { prisma } from './db';
import { sendNewMessageEmail } from './notifications';

/**
 * Mirror of the buyer-app helper. Lives here so the seller-side REST send
 * path can dispatch mail without crossing app boundaries. 30-min throttle
 * window per side; atomic claim via guarded updateMany so chatty back-and-
 * forth collapses to one email per recipient per window.
 */
const THROTTLE_MS = 30 * 60 * 1000;

const BUYER_BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://itsnottechy.cloud';
const SELLER_BASE = process.env.NEXT_PUBLIC_SELLER_URL ?? 'https://seller.itsnottechy.cloud';

type SendingSide = 'BUYER' | 'SELLER';

export async function notifyNewMessage(args: {
  conversationId: string;
  fromRole: SendingSide;
  bodyPreview: string;
}): Promise<void> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - THROTTLE_MS);
  const recipientField =
    args.fromRole === 'BUYER' ? 'sellerLastNotifiedAt' : 'buyerLastNotifiedAt';

  const claimed = await prisma.conversation.updateMany({
    where: {
      id: args.conversationId,
      OR: [{ [recipientField]: null }, { [recipientField]: { lt: cutoff } }],
    },
    data: { [recipientField]: now },
  });
  if (claimed.count === 0) return;

  const conv = await prisma.conversation.findUnique({
    where: { id: args.conversationId },
    select: {
      id: true,
      buyer: { select: { email: true, fullName: true, status: true } },
      seller: {
        select: {
          displayName: true,
          user: { select: { email: true, status: true } },
        },
      },
      orderItem: {
        select: {
          productTitle: true,
          order: { select: { orderNumber: true } },
        },
      },
    },
  });
  if (!conv) return;

  const recipient =
    args.fromRole === 'BUYER'
      ? { email: conv.seller.user.email, status: conv.seller.user.status }
      : { email: conv.buyer.email, status: conv.buyer.status };
  if (recipient.status === 'DELETED') return;
  if (!recipient.email || recipient.email.endsWith('@onsective.invalid')) return;

  const senderName =
    args.fromRole === 'BUYER'
      ? conv.buyer.fullName?.trim() || 'Your buyer'
      : conv.seller.displayName;

  const threadUrl =
    args.fromRole === 'BUYER'
      ? `${SELLER_BASE}/dashboard/messages/${conv.id}`
      : `${BUYER_BASE}/account/messages/${conv.id}`;

  try {
    await sendNewMessageEmail(recipient.email, {
      senderName,
      productTitle: conv.orderItem.productTitle,
      orderNumber: conv.orderItem.order.orderNumber,
      bodyPreview: args.bodyPreview,
      threadUrl,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[messaging] notify send failed:', err);
  }
}
