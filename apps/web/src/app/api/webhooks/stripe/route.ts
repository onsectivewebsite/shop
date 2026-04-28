import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { getStripe, STRIPE_WEBHOOK_SECRET } from '@/server/stripe';
import { HANDLERS } from '@/server/webhooks/stripe-handlers';

/**
 * Stripe webhook receiver.
 *
 * Per SECURITY.md §6.5:
 *  1. Verify Stripe-Signature
 *  2. Persist WebhookEvent (idempotent dedup via externalId)
 *  3. Dispatch handler — handlers themselves are idempotent
 *  4. Return 200 fast; on handler error, mark and 200 anyway so Stripe doesn't loop.
 *     We retry from our side via a dead-letter/process queue (Phase 2).
 */
export async function POST(req: Request) {
  if (!STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: 'STRIPE_WEBHOOK_SECRET not configured' },
      { status: 500 },
    );
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'missing stripe-signature' }, { status: 400 });
  }

  const body = await req.text();
  const stripe = getStripe();

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return NextResponse.json(
      { error: `signature verification failed: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  // Persist + dedupe
  const existing = await prisma.webhookEvent.findUnique({
    where: { externalId: event.id },
  });
  if (existing?.processedAt) {
    return NextResponse.json({ received: true, deduped: true });
  }

  await prisma.webhookEvent.upsert({
    where: { externalId: event.id },
    create: {
      source: 'stripe',
      externalId: event.id,
      eventType: event.type,
      payload: event as unknown as object,
    },
    update: { attempts: { increment: 1 } },
  });

  const handler = HANDLERS[event.type];
  if (!handler) {
    // Unhandled event — still mark processed so we don't retry.
    await prisma.webhookEvent.update({
      where: { externalId: event.id },
      data: { processedAt: new Date() },
    });
    return NextResponse.json({ received: true, handled: false });
  }

  try {
    await handler(event);
    await prisma.webhookEvent.update({
      where: { externalId: event.id },
      data: { processedAt: new Date() },
    });
  } catch (err) {
    await prisma.webhookEvent.update({
      where: { externalId: event.id },
      data: { error: (err as Error).message },
    });
    // Return 200 to stop Stripe retries; we'll process from our side.
    // eslint-disable-next-line no-console
    console.error(`[stripe-webhook] handler ${event.type} failed:`, err);
  }

  return NextResponse.json({ received: true });
}
