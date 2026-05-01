import type Stripe from 'stripe';
import { prisma } from '../db';
import { awardReferralOnFirstOrder, refundCredit } from '../auth';

/**
 * Event handlers — one per Stripe event type we care about.
 * All handlers are idempotent: re-running with the same event must not
 * cause duplicate state changes. Dedup key: WebhookEvent.externalId.
 */

export async function handlePaymentIntentSucceeded(event: Stripe.Event) {
  const intent = event.data.object as Stripe.PaymentIntent;
  const orderId = intent.metadata?.orderId;
  if (!orderId) return;

  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) return;
    if (order.status === 'PAID' || order.status === 'CONFIRMED') return; // already processed

    // Persist payment record
    await tx.payment.upsert({
      where: { gatewayRef: intent.id },
      create: {
        orderId,
        gateway: 'stripe',
        gatewayRef: intent.id,
        amount: intent.amount,
        currency: intent.currency.toUpperCase(),
        status: 'CAPTURED',
        method: intent.payment_method_types?.[0] ?? null,
        capturedAt: new Date(),
        rawWebhookEvent: event as unknown as object,
      },
      update: {
        status: 'CAPTURED',
        capturedAt: new Date(),
        rawWebhookEvent: event as unknown as object,
      },
    });

    // Move order forward
    await tx.order.update({
      where: { id: orderId },
      data: { status: 'PAID', placedAt: new Date() },
    });

    // Decrement reserved → committed (for v0 we just decrement stock).
    for (const item of order.items) {
      await tx.variant.update({
        where: { id: item.variantId },
        data: {
          stockQty: { decrement: item.qty },
          reservedQty: { decrement: item.qty },
        },
      });
      await tx.inventoryLog.create({
        data: {
          variantId: item.variantId,
          delta: -item.qty,
          reason: 'ORDER_PLACED',
          refType: 'order',
          refId: orderId,
        },
      });
    }

    // Ledger entries — one DR + multiple CRs to balance
    const totalCommission = order.items.reduce((acc, i) => acc + i.commissionAmount, 0);
    const totalSellerNet = order.items.reduce((acc, i) => acc + i.sellerNetAmount, 0);
    const gatewayFee = Math.round(intent.amount * 0.029) + 30; // estimate; real value via balance txn

    const entries = [
      {
        account: 'BUYER_RECEIVABLE' as const,
        direction: 'DEBIT' as const,
        amount: intent.amount,
      },
      {
        account: 'PLATFORM_REVENUE' as const,
        direction: 'CREDIT' as const,
        amount: totalCommission,
      },
      {
        account: 'GATEWAY_FEES' as const,
        direction: 'CREDIT' as const,
        amount: gatewayFee,
      },
      {
        account: 'PLATFORM_LIABILITY' as const,
        direction: 'CREDIT' as const,
        amount: intent.amount - totalCommission - gatewayFee,
      },
      ...order.items.map((i) => ({
        account: 'SELLER_PAYABLE' as const,
        direction: 'CREDIT' as const,
        amount: i.sellerNetAmount,
        sellerId: i.sellerId,
      })),
    ];

    await tx.ledgerEntry.createMany({
      data: entries.map((e) => ({
        ...e,
        currency: order.currency,
        orderId,
        refType: 'order',
        refId: orderId,
        description: `order ${order.orderNumber} ${e.account}`,
      })),
    });

    // Tag the SELLER_PAYABLE entries: Phase 2 will pay these out via Transfer
    // when delivered + return-window expired.
    void totalSellerNet;

    await tx.orderEvent.create({
      data: {
        orderId,
        type: 'paid',
        toStatus: 'PAID',
        actor: 'system',
      },
    });
  });

  // Side-effect outside the transaction so a referral-write failure can't
  // poison the payment-capture commit. Idempotent on (referredUserId,
  // firstOrderId IS NULL) — webhook replays are safe.
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { buyerId: true, currency: true },
    });
    if (order) {
      await awardReferralOnFirstOrder({
        buyerId: order.buyerId,
        orderId,
        currency: order.currency,
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[referrals] award on first order failed:', err);
  }
}

export async function handlePaymentIntentFailed(event: Stripe.Event) {
  const intent = event.data.object as Stripe.PaymentIntent;
  const orderId = intent.metadata?.orderId;
  if (!orderId) return;

  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'FAILED' },
  });
  await prisma.payment.upsert({
    where: { gatewayRef: intent.id },
    create: {
      orderId,
      gateway: 'stripe',
      gatewayRef: intent.id,
      amount: intent.amount,
      currency: intent.currency.toUpperCase(),
      status: 'FAILED',
    },
    update: { status: 'FAILED' },
  });

  // Return any credit the buyer redeemed for this order. refundCredit is
  // idempotent on (sourceType=order, sourceId, type=REFUND), so a webhook
  // replay re-runs cleanly without double-crediting. We need the buyerId
  // and currency to call it — both live on the order row.
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { buyerId: true, currency: true, discountAmount: true },
    });
    if (order && order.discountAmount > 0) {
      await refundCredit({
        userId: order.buyerId,
        orderId,
        currency: order.currency,
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[credits] refund on failed payment failed:', err);
  }
}

export async function handleChargeDisputeCreated(event: Stripe.Event) {
  // Phase 2: freeze related seller payouts; create dispute record; notify ops.
  // For now, just log audit event.
  const dispute = event.data.object as Stripe.Dispute;
  await prisma.auditLog.create({
    data: {
      actorType: 'system',
      action: 'stripe.dispute.created',
      targetType: 'payment',
      targetId: dispute.payment_intent as string,
      metadata: dispute as unknown as object,
    },
  });
}

export async function handleTransferEvent(event: Stripe.Event) {
  // We treat transfer.created as IN_TRANSIT, transfer.updated as a status
  // refresh, and transfer.reversed as FAILED. Stripe's `transfer.paid` event
  // doesn't exist on Connect transfers — payouts (separate object) emit paid.
  const transfer = event.data.object as Stripe.Transfer;
  const reversed = event.type === 'transfer.reversed';
  await prisma.payout
    .updateMany({
      where: { gatewayRef: transfer.id },
      data: {
        status: reversed ? 'FAILED' : 'IN_TRANSIT',
        failureReason: reversed ? 'transfer reversed by Stripe' : undefined,
      },
    })
    .catch(() => {});
}

/**
 * Stripe Payout (the bank-leg of Connect) — emits `payout.paid` when funds
 * land in the seller's bank account. The connected account is on the
 * `account` field of the event; we use it to find the matching Seller and
 * mark the most-recent IN_TRANSIT Payout row PAID.
 */
export async function handlePayoutPaid(event: Stripe.Event) {
  const payout = event.data.object as Stripe.Payout;
  const accountId = (event as { account?: string }).account;
  if (!accountId) return;
  const seller = await prisma.seller.findUnique({ where: { stripeAccountId: accountId } });
  if (!seller) return;
  await prisma.payout
    .updateMany({
      where: { sellerId: seller.id, status: 'IN_TRANSIT', currency: payout.currency.toUpperCase() },
      data: { status: 'PAID', paidAt: new Date() },
    })
    .catch(() => {});
}

// =====================================================================
// Onsective Prime — subscription lifecycle webhooks
// =====================================================================

function periodEndFromSubscription(sub: Stripe.Subscription): Date {
  // current_period_end is on the type at runtime but the SDK has been moving
  // it around — pull it defensively.
  const ts = (sub as unknown as { current_period_end?: number }).current_period_end;
  return ts ? new Date(ts * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

export async function handleSubscriptionUpdated(event: Stripe.Event) {
  const sub = event.data.object as Stripe.Subscription;
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

  // Find by subscriptionId first (subsequent events). Fall back to customerId
  // for the very first `customer.subscription.created` — startCheckout
  // pre-populated the row with the customer link before the sub existed.
  let membership =
    (await prisma.primeMembership.findUnique({ where: { stripeSubscriptionId: sub.id } })) ??
    (await prisma.primeMembership.findFirst({ where: { stripeCustomerId: customerId } }));
  if (!membership) return;

  let status = membership.status;
  switch (sub.status) {
    case 'active':
    case 'trialing':
      status = 'ACTIVE';
      break;
    case 'past_due':
    case 'unpaid':
      status = 'PAYMENT_FAILED';
      break;
    case 'paused':
      status = 'PAUSED';
      break;
    case 'canceled':
      status = 'CANCELLED';
      break;
  }

  await prisma.primeMembership.update({
    where: { id: membership.id },
    data: {
      status,
      stripeSubscriptionId: sub.id,
      currentPeriodEnd: periodEndFromSubscription(sub),
      cancelledAt:
        status === 'CANCELLED' && !membership.cancelledAt ? new Date() : membership.cancelledAt,
    },
  });
}

export async function handleSubscriptionDeleted(event: Stripe.Event) {
  const sub = event.data.object as Stripe.Subscription;
  await prisma.primeMembership
    .updateMany({
      where: { stripeSubscriptionId: sub.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    })
    .catch(() => {});
}

export async function handleInvoicePaymentFailed(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  const subId = (invoice as unknown as { subscription?: string }).subscription;
  if (!subId) return;
  await prisma.primeMembership
    .updateMany({
      where: { stripeSubscriptionId: subId },
      data: { status: 'PAYMENT_FAILED' },
    })
    .catch(() => {});
}

export const HANDLERS: Record<string, (event: Stripe.Event) => Promise<void>> = {
  'payment_intent.succeeded': handlePaymentIntentSucceeded,
  'payment_intent.payment_failed': handlePaymentIntentFailed,
  'charge.dispute.created': handleChargeDisputeCreated,
  'transfer.created': handleTransferEvent,
  'transfer.updated': handleTransferEvent,
  'transfer.reversed': handleTransferEvent,
  'payout.paid': handlePayoutPaid,
  // Prime
  'customer.subscription.created': handleSubscriptionUpdated,
  'customer.subscription.updated': handleSubscriptionUpdated,
  'customer.subscription.deleted': handleSubscriptionDeleted,
  'invoice.payment_failed': handleInvoicePaymentFailed,
};
