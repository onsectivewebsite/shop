import { prisma } from './db';
import { sendNewMessageEmail } from './notifications';

/**
 * 30-min throttle window per side. Two consecutive buyer messages 5 minutes
 * apart only generate one seller-recipient email; the second collapses
 * because the seller's `sellerLastNotifiedAt` was just stamped.
 */
const THROTTLE_MS = 30 * 60 * 1000;

const BUYER_BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://itsnottechy.cloud';
const SELLER_BASE = process.env.NEXT_PUBLIC_SELLER_URL ?? 'https://seller.itsnottechy.cloud';

type SendingSide = 'BUYER' | 'SELLER';

/**
 * Notify the OTHER side of a new message. Atomic claim of the recipient's
 * notify-stamp via a guarded updateMany — if updated count == 1 we won the
 * window and proceed to send; otherwise the throttle is still hot and we
 * skip silently. Failure to send is also swallowed so a flaky SMTP can't
 * block the message-write side of things.
 */
export async function notifyNewMessage(args: {
  conversationId: string;
  fromRole: SendingSide;
  bodyPreview: string;
}): Promise<void> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - THROTTLE_MS);

  const recipientField =
    args.fromRole === 'BUYER' ? 'sellerLastNotifiedAt' : 'buyerLastNotifiedAt';

  // Atomic guard: only stamp + proceed when the recipient hasn't been
  // notified within the throttle window.
  const claimed = await prisma.conversation.updateMany({
    where: {
      id: args.conversationId,
      OR: [{ [recipientField]: null }, { [recipientField]: { lt: cutoff } }],
    },
    data: { [recipientField]: now },
  });
  if (claimed.count === 0) return;

  // Resolve recipient + sender + thread context. Done after the claim so a
  // wasted lookup doesn't fire when the throttle is already hot.
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
  // DELETED accounts have their email scrubbed to *@onsective.invalid; the
  // SMTP send would just bounce — skip so we don't leak the original mailbox
  // by keeping a stale row.
  if (recipient.status === 'DELETED') return;
  if (!recipient.email || recipient.email.endsWith('@onsective.invalid')) return;

  const senderName =
    args.fromRole === 'BUYER'
      ? conv.buyer.fullName?.trim() || 'Your buyer'
      : conv.seller.displayName;

  // Deep-link goes to the recipient's surface — buyer-recipient links to the
  // buyer app, seller-recipient links to the seller subdomain.
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
