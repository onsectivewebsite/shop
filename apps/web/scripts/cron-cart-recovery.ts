/* eslint-disable no-console */
import { prisma } from '../src/server/db';
import { sendCartRecoveryEmail } from '../src/server/notifications';

/**
 * Daily sweep: email buyers with carts that have been sitting untouched for
 * at least 24 hours but no more than 7 days. One nudge per cart, ever.
 *
 *   pnpm --filter @onsective/web cron:cart-recovery
 *
 * Cart recovery is marketing-class under most regimes (it's an attempt to
 * drive a purchase, not a transactional notification), so we gate on the
 * buyer's emailMarketingOptIn flag. Guest carts (no userId) are skipped —
 * we have no email to send to.
 *
 * The stamp is applied only after the email actually goes out — if SMTP
 * fails the cart stays re-tryable on the next run.
 */

const ABANDONED_AFTER_MS = 24 * 60 * 60 * 1000; // 24 hours
const TOO_OLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://itsnottechy.cloud';

async function main() {
  const now = new Date();
  const upper = new Date(now.getTime() - ABANDONED_AFTER_MS);
  const lower = new Date(now.getTime() - TOO_OLD_MS);

  const carts = await prisma.cart.findMany({
    where: {
      recoveryEmailSentAt: null,
      updatedAt: { lte: upper, gte: lower },
      userId: { not: null },
      user: { status: 'ACTIVE', emailMarketingOptIn: true },
      items: { some: {} },
    },
    select: {
      id: true,
      currency: true,
      user: { select: { id: true, email: true, locale: true } },
      items: {
        select: {
          qty: true,
          priceSnapshot: true,
          variant: {
            select: {
              product: { select: { title: true, images: true } },
            },
          },
        },
      },
    },
    take: 500,
  });

  if (carts.length === 0) {
    console.log('[cart-recovery] nothing to send');
    return;
  }

  let sent = 0;
  for (const cart of carts) {
    if (!cart.user || !cart.user.email) continue;
    if (cart.items.length === 0) continue;

    const items = cart.items.map((it) => ({
      title: it.variant.product.title,
      qty: it.qty,
      lineTotalMinor: it.priceSnapshot * it.qty,
      imageUrl: it.variant.product.images[0] ?? null,
    }));
    const subtotal = items.reduce((acc, it) => acc + it.lineTotalMinor, 0);
    const cartUrl = `${APP_URL}/${cart.user.locale?.split('-')[0] ?? 'en'}/cart`;

    try {
      await sendCartRecoveryEmail(cart.user.email, {
        items,
        subtotalMinor: subtotal,
        currency: cart.currency,
        cartUrl,
      });
      // Stamp only after a successful send so a flaky SMTP retry on the
      // next run doesn't burn the one-shot stamp.
      await prisma.cart.update({
        where: { id: cart.id },
        data: { recoveryEmailSentAt: new Date() },
      });
      sent += 1;
    } catch (err) {
      console.error(`[cart-recovery] send failed for cart ${cart.id}:`, err);
    }
  }

  console.log(`[cart-recovery] sent ${sent}/${carts.length} recovery emails`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[cart-recovery] fatal:', err);
    process.exit(1);
  });
