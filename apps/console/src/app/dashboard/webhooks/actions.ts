'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@onsective/db';
import { getConsoleSession } from '@/server/auth';
import { audit } from '@/lib/audit';

/**
 * Reset a failed event so the next webhook handler invocation can re-process
 * it. We DON'T re-fire the handler from here — the event will replay either
 * via the next webhook delivery (Stripe retries automatically), via the
 * provider's resend button, OR via a future cron that scans for unprocessed
 * events. This action just clears the error/attempts so the system stops
 * treating it as terminal-failed.
 */
export async function retryWebhookAction(eventId: string): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  const evt = await prisma.webhookEvent.findUnique({ where: { id: eventId } });
  if (!evt) throw new Error('Webhook event not found.');
  if (evt.processedAt) throw new Error('Already processed; nothing to retry.');

  await prisma.webhookEvent.update({
    where: { id: eventId },
    data: { error: null, attempts: 0 },
  });

  await audit({
    actorId: session.user.id,
    action: 'webhook.reset_for_retry',
    targetType: 'webhookEvent',
    targetId: eventId,
    metadata: { source: evt.source, eventType: evt.eventType, externalId: evt.externalId },
  });

  revalidatePath('/dashboard/webhooks');
}

/**
 * Mark a stuck event as manually resolved. Stamps processedAt so it stops
 * appearing in the failed/pending queue. Use when the underlying issue was
 * fixed manually (e.g. seller account was reconciled by hand).
 */
export async function markResolvedAction(eventId: string): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  const evt = await prisma.webhookEvent.findUnique({ where: { id: eventId } });
  if (!evt) throw new Error('Webhook event not found.');
  if (evt.processedAt) throw new Error('Already processed.');

  await prisma.webhookEvent.update({
    where: { id: eventId },
    data: {
      processedAt: new Date(),
      error: evt.error ? `[manually resolved] ${evt.error}` : '[manually resolved]',
    },
  });

  await audit({
    actorId: session.user.id,
    action: 'webhook.mark_resolved',
    targetType: 'webhookEvent',
    targetId: eventId,
    metadata: { source: evt.source, eventType: evt.eventType, externalId: evt.externalId },
  });

  revalidatePath('/dashboard/webhooks');
}
