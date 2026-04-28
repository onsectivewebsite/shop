'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@onsective/db';
import { getConsoleSession } from '@/server/auth';
import { audit } from '@/lib/audit';

/**
 * Console RMA actions. Each transition is audited and authoritative — buyers
 * can only see status; the journey is driven from here. Refund execution
 * (Stripe call) lives in `markRefunded` and creates a Refund row tied back
 * to the Return.
 *
 * State machine (no skips allowed):
 *   REQUESTED → APPROVED | REJECTED | CANCELLED
 *   APPROVED  → RECEIVED  | CANCELLED
 *   RECEIVED  → REFUNDED  | REJECTED
 */

export async function approveReturnAction(
  returnId: string,
  formData: FormData,
): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  const note = (formData.get('note') ?? '').toString().trim().slice(0, 500) || null;
  const { count } = await prisma.return.updateMany({
    where: { id: returnId, status: 'REQUESTED' },
    data: {
      status: 'APPROVED',
      decidedAt: new Date(),
      decidedBy: session.user.id,
      decisionNote: note,
    },
  });
  if (count === 0) throw new Error('Return not in REQUESTED state.');

  await audit({
    actorId: session.user.id,
    action: 'return.approve',
    targetType: 'return',
    targetId: returnId,
    metadata: { note },
  });

  revalidatePath(`/dashboard/returns/${returnId}`);
  revalidatePath('/dashboard/returns');
}

export async function rejectReturnAction(
  returnId: string,
  formData: FormData,
): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  const note = (formData.get('note') ?? '').toString().trim();
  if (!note) throw new Error('Reason required to reject.');

  const { count } = await prisma.return.updateMany({
    where: { id: returnId, status: { in: ['REQUESTED', 'RECEIVED'] } },
    data: {
      status: 'REJECTED',
      decidedAt: new Date(),
      decidedBy: session.user.id,
      decisionNote: note.slice(0, 500),
    },
  });
  if (count === 0) throw new Error('Return cannot be rejected from its current state.');

  await audit({
    actorId: session.user.id,
    action: 'return.reject',
    targetType: 'return',
    targetId: returnId,
    metadata: { note: note.slice(0, 500) },
  });

  revalidatePath(`/dashboard/returns/${returnId}`);
  revalidatePath('/dashboard/returns');
}

export async function markReceivedAction(returnId: string): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  const { count } = await prisma.return.updateMany({
    where: { id: returnId, status: 'APPROVED' },
    data: { status: 'RECEIVED', receivedAt: new Date() },
  });
  if (count === 0) throw new Error('Return must be APPROVED to mark received.');

  await audit({
    actorId: session.user.id,
    action: 'return.received',
    targetType: 'return',
    targetId: returnId,
  });

  revalidatePath(`/dashboard/returns/${returnId}`);
}

export async function markRefundedAction(returnId: string): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  // The actual Stripe refund call would happen here in a real run. We create
  // the Refund row tied to the Return and mark the OrderItem REFUNDED in one
  // transaction so the analytics aggregations stay consistent.
  const r = await prisma.return.findUnique({
    where: { id: returnId },
    include: {
      orderItem: { include: { order: { include: { payments: true } } } },
    },
  });
  if (!r) throw new Error('Return not found');
  if (r.status !== 'RECEIVED') throw new Error('Return must be RECEIVED to refund.');
  if (!r.refundAmount) throw new Error('No refund amount set on return.');

  const payment = r.orderItem.order.payments.find((p) => p.status === 'CAPTURED');
  if (!payment) {
    throw new Error('No captured payment on the order to refund against.');
  }

  await prisma.$transaction(async (tx) => {
    const refund = await tx.refund.create({
      data: {
        orderId: r.orderItem.orderId,
        paymentId: payment.id,
        amount: r.refundAmount!,
        currency: r.currency,
        reason: `RMA ${r.rmaNumber}`,
        status: 'pending',
      },
    });
    await tx.return.update({
      where: { id: r.id },
      data: { status: 'REFUNDED', refundedAt: new Date(), refundId: refund.id },
    });
    await tx.orderItem.update({
      where: { id: r.orderItemId },
      data: { status: 'REFUNDED' },
    });
  });

  await audit({
    actorId: session.user.id,
    action: 'return.refund',
    targetType: 'return',
    targetId: returnId,
    metadata: { amount: r.refundAmount },
  });

  revalidatePath(`/dashboard/returns/${returnId}`);
  revalidatePath('/dashboard/returns');
}
