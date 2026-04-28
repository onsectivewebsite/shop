'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@onsective/db';
import { getConsoleSession } from '@/server/auth';
import { audit } from '@/lib/audit';

export async function approveAction(approvalId: string): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  const req = await prisma.approvalRequest.findUnique({ where: { id: approvalId } });
  if (!req) throw new Error('Not found');
  if (req.status !== 'PENDING') throw new Error('Not pending');
  if (req.expiresAt < new Date()) throw new Error('Expired');
  if (req.requesterId === session.user.id) {
    throw new Error('Cannot approve your own request (4-eyes).');
  }

  await prisma.$transaction(async (tx) => {
    await tx.approvalRequest.update({
      where: { id: approvalId },
      data: {
        status: 'APPROVED',
        approverId: session.user.id,
        approvedAt: new Date(),
        executedAt: new Date(),
      },
    });

    // Execute the approved action
    if (req.action === 'order.refund') {
      const payload = req.payload as { orderId: string };
      await tx.order.update({
        where: { id: payload.orderId },
        data: { status: 'REFUNDED' },
      });
      await tx.orderEvent.create({
        data: {
          orderId: payload.orderId,
          type: 'refunded',
          toStatus: 'REFUNDED',
          actor: `pm:${req.requesterId}`,
          metadata: {
            approvedBy: session.user.id,
            reason: req.reason,
          },
        },
      });
    }
  });

  await audit({
    actorId: session.user.id,
    action: 'approval.approve',
    targetType: 'approval',
    targetId: approvalId,
    metadata: { originalAction: req.action },
  });

  revalidatePath('/dashboard/approvals');
}

export async function denyAction(approvalId: string, reason: string): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  const req = await prisma.approvalRequest.findUnique({ where: { id: approvalId } });
  if (!req) throw new Error('Not found');
  if (req.status !== 'PENDING') throw new Error('Not pending');
  if (req.requesterId === session.user.id) {
    throw new Error('Cannot deny your own request.');
  }

  await prisma.approvalRequest.update({
    where: { id: approvalId },
    data: {
      status: 'DENIED',
      approverId: session.user.id,
      deniedReason: reason,
    },
  });

  await audit({
    actorId: session.user.id,
    action: 'approval.deny',
    targetType: 'approval',
    targetId: approvalId,
    metadata: { reason },
  });

  revalidatePath('/dashboard/approvals');
}
