'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@onsective/db';
import { getConsoleSession } from '@/server/auth';
import { audit } from '@/lib/audit';

export async function approveSellerAction(sellerId: string): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  await prisma.$transaction([
    prisma.seller.update({
      where: { id: sellerId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: session.user.id,
      },
    }),
    prisma.kycDocument.updateMany({
      where: { sellerId, status: 'PENDING' },
      data: { status: 'APPROVED', reviewedAt: new Date(), reviewedBy: session.user.id },
    }),
  ]);

  await audit({
    actorId: session.user.id,
    action: 'seller.kyc.approve',
    targetType: 'seller',
    targetId: sellerId,
  });

  revalidatePath(`/dashboard/sellers/${sellerId}`);
  revalidatePath('/dashboard/sellers');
}

export async function rejectSellerAction(
  sellerId: string,
  formData: FormData,
): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  const reason = (formData.get('reason') ?? '').toString().trim();
  if (!reason) throw new Error('Reason required to reject.');

  await prisma.$transaction([
    prisma.seller.update({
      where: { id: sellerId },
      data: { status: 'REJECTED', suspendedReason: reason.slice(0, 500) },
    }),
    prisma.kycDocument.updateMany({
      where: { sellerId, status: 'PENDING' },
      data: {
        status: 'REJECTED',
        notes: reason.slice(0, 500),
        reviewedAt: new Date(),
        reviewedBy: session.user.id,
      },
    }),
  ]);

  await audit({
    actorId: session.user.id,
    action: 'seller.kyc.reject',
    targetType: 'seller',
    targetId: sellerId,
    metadata: { reason: reason.slice(0, 500) },
  });

  revalidatePath(`/dashboard/sellers/${sellerId}`);
  revalidatePath('/dashboard/sellers');
}

export async function reviewKycDocumentAction(
  sellerId: string,
  documentId: string,
  decision: 'APPROVED' | 'REJECTED',
  formData: FormData,
): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  const notes = (formData.get('notes') ?? '').toString().trim().slice(0, 500) || null;

  await prisma.kycDocument.update({
    where: { id: documentId },
    data: { status: decision, notes, reviewedAt: new Date(), reviewedBy: session.user.id },
  });

  await audit({
    actorId: session.user.id,
    action: `seller.kyc.document.${decision.toLowerCase()}`,
    targetType: 'kycDocument',
    targetId: documentId,
    metadata: { sellerId, notes },
  });

  revalidatePath(`/dashboard/sellers/${sellerId}`);
}
