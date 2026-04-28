'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@onsective/db';
import { getConsoleSession } from '@/server/auth';
import { audit } from '@/lib/audit';

const REFUND_DIRECT_LIMIT = 50_000; // 500.00 in minor units (USD)
const APPROVAL_TTL_HOURS = 48;

export async function refundOrderAction(orderId: string, reason: string): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error('Order not found');

  if (order.totalAmount > REFUND_DIRECT_LIMIT) {
    // Above PM-direct authority — create approval request (4-eyes).
    await prisma.approvalRequest.create({
      data: {
        requesterId: session.user.id,
        action: 'order.refund',
        payload: { orderId, amount: order.totalAmount, currency: order.currency },
        reason,
        expiresAt: new Date(Date.now() + APPROVAL_TTL_HOURS * 60 * 60 * 1000),
      },
    });
    await audit({
      actorId: session.user.id,
      action: 'approval.request.create',
      targetType: 'order',
      targetId: orderId,
      metadata: { action: 'order.refund', amount: order.totalAmount },
    });
    revalidatePath(`/dashboard/orders/${orderId}`);
    return;
  }

  // Direct refund (under threshold)
  await prisma.order.update({ where: { id: orderId }, data: { status: 'REFUNDED' } });
  await prisma.orderEvent.create({
    data: {
      orderId,
      type: 'refunded',
      toStatus: 'REFUNDED',
      actor: `pm:${session.user.id}`,
      metadata: { reason },
    },
  });

  await audit({
    actorId: session.user.id,
    action: 'order.refund.direct',
    targetType: 'order',
    targetId: orderId,
    metadata: { amount: order.totalAmount, reason },
  });

  revalidatePath(`/dashboard/orders/${orderId}`);
}

export async function cancelOrderAction(orderId: string, reason: string): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { shipments: true },
  });
  if (!order) throw new Error('Order not found');
  if (order.shipments.length > 0) {
    throw new Error('Cannot cancel — order has shipments. Use refund flow.');
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledReason: reason },
  });
  await prisma.orderEvent.create({
    data: {
      orderId,
      type: 'cancelled',
      toStatus: 'CANCELLED',
      actor: `pm:${session.user.id}`,
      metadata: { reason },
    },
  });
  await audit({
    actorId: session.user.id,
    action: 'order.cancel',
    targetType: 'order',
    targetId: orderId,
    metadata: { reason },
  });

  revalidatePath(`/dashboard/orders/${orderId}`);
}
