'use server';

import { revalidatePath } from 'next/cache';
import { prisma, Prisma } from '@onsective/db';
import { getConsoleSession } from '@/server/auth';
import { audit } from '@/lib/audit';

const MAX_COMMISSION_PCT = 30; // floor + ceiling — anything above 30% is a bug, not a tier

export async function updateCommissionAction(
  sellerId: string,
  formData: FormData,
): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  const raw = (formData.get('commissionPct') ?? '').toString().trim();
  const pct = Number(raw);
  if (!Number.isFinite(pct) || pct < 0 || pct > MAX_COMMISSION_PCT) {
    throw new Error(`Commission must be between 0 and ${MAX_COMMISSION_PCT}.`);
  }

  const before = await prisma.seller.findUnique({
    where: { id: sellerId },
    select: { defaultCommissionPct: true },
  });
  if (!before) throw new Error('Seller not found.');

  // Decimal column expects a string for precision.
  const next = pct.toFixed(2);
  await prisma.seller.update({
    where: { id: sellerId },
    data: { defaultCommissionPct: new Prisma.Decimal(next) },
  });

  await audit({
    actorId: session.user.id,
    action: 'seller.commission.update',
    targetType: 'seller',
    targetId: sellerId,
    metadata: { from: before.defaultCommissionPct.toString(), to: next },
  });

  revalidatePath(`/dashboard/sellers/${sellerId}`);
}

export async function forceDisconnectStripeAction(
  sellerId: string,
  formData: FormData,
): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  const reason = (formData.get('reason') ?? '').toString().trim();
  if (!reason) throw new Error('Reason required to force-disconnect Stripe.');

  const before = await prisma.seller.findUnique({
    where: { id: sellerId },
    select: { stripeAccountId: true, stripePayoutsEnabled: true },
  });
  if (!before) throw new Error('Seller not found.');
  if (!before.stripeAccountId) throw new Error('Seller has no Stripe account.');

  await prisma.seller.update({
    where: { id: sellerId },
    data: {
      stripeAccountId: null,
      stripePayoutsEnabled: false,
      stripeOnboardedAt: null,
    },
  });

  await audit({
    actorId: session.user.id,
    action: 'seller.stripe.force_disconnect',
    targetType: 'seller',
    targetId: sellerId,
    metadata: {
      previousStripeAccountId: before.stripeAccountId,
      reason: reason.slice(0, 500),
    },
  });

  revalidatePath(`/dashboard/sellers/${sellerId}`);
}

export async function reactivateFromSuspendedAction(
  sellerId: string,
  formData: FormData,
): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  const note = (formData.get('note') ?? '').toString().trim();
  if (!note) throw new Error('Note required to reactivate.');

  const seller = await prisma.seller.findUnique({
    where: { id: sellerId },
    select: { status: true },
  });
  if (!seller) throw new Error('Seller not found.');
  if (seller.status !== 'SUSPENDED') {
    throw new Error('Seller is not currently suspended.');
  }

  await prisma.seller.update({
    where: { id: sellerId },
    data: {
      status: 'APPROVED',
      suspendedAt: null,
      suspendedReason: null,
    },
  });

  await audit({
    actorId: session.user.id,
    action: 'seller.reactivate',
    targetType: 'seller',
    targetId: sellerId,
    metadata: { note: note.slice(0, 500) },
  });

  revalidatePath(`/dashboard/sellers/${sellerId}`);
}

export async function suspendSellerAction(
  sellerId: string,
  formData: FormData,
): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  const reason = (formData.get('reason') ?? '').toString().trim();
  if (!reason) throw new Error('Reason required to suspend.');

  const seller = await prisma.seller.findUnique({
    where: { id: sellerId },
    select: { status: true },
  });
  if (!seller) throw new Error('Seller not found.');
  if (seller.status === 'SUSPENDED') {
    throw new Error('Seller already suspended.');
  }

  await prisma.seller.update({
    where: { id: sellerId },
    data: {
      status: 'SUSPENDED',
      suspendedAt: new Date(),
      suspendedReason: reason.slice(0, 500),
    },
  });

  await audit({
    actorId: session.user.id,
    action: 'seller.suspend',
    targetType: 'seller',
    targetId: sellerId,
    metadata: { reason: reason.slice(0, 500) },
  });

  revalidatePath(`/dashboard/sellers/${sellerId}`);
}

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
