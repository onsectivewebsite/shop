'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@onsective/db';
import { getConsoleSession } from '@/server/auth';
import { audit } from '@/lib/audit';

export async function approveOrgAction(
  orgId: string,
  formData: FormData,
): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  const paymentTerms = formData.get('paymentTerms') === 'NET_30' ? 'NET_30' : 'STRIPE_IMMEDIATE';
  const creditLimitRaw = formData.get('creditLimit')?.toString();
  const creditLimitMinor =
    paymentTerms === 'NET_30' && creditLimitRaw
      ? Math.round(parseFloat(creditLimitRaw) * 100)
      : null;
  const discountPctRaw = formData.get('discountPct')?.toString();
  const discountPctBps = discountPctRaw ? Math.round(parseFloat(discountPctRaw) * 100) : 0;

  await prisma.organization.update({
    where: { id: orgId },
    data: {
      approvedAt: new Date(),
      approvedBy: session.user.id,
      paymentTerms,
      creditLimitMinor,
      discountPctBps,
    },
  });

  await audit({
    actorId: session.user.id,
    action: 'org.approve',
    targetType: 'organization',
    targetId: orgId,
    metadata: { paymentTerms, creditLimitMinor, discountPctBps },
  });

  revalidatePath(`/dashboard/orgs/${orgId}`);
  revalidatePath('/dashboard/orgs');
}

export async function suspendOrgAction(
  orgId: string,
  formData: FormData,
): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  const reason = (formData.get('reason') ?? '').toString().trim();
  if (!reason) throw new Error('Reason required.');

  await prisma.organization.update({
    where: { id: orgId },
    data: {
      suspendedAt: new Date(),
      suspendedReason: reason.slice(0, 500),
    },
  });

  await audit({
    actorId: session.user.id,
    action: 'org.suspend',
    targetType: 'organization',
    targetId: orgId,
    metadata: { reason: reason.slice(0, 500) },
  });

  revalidatePath(`/dashboard/orgs/${orgId}`);
}

export async function approveTaxExemptionAction(
  orgId: string,
  exemptionId: string,
): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  await prisma.taxExemption.update({
    where: { id: exemptionId },
    data: {
      status: 'APPROVED',
      reviewedAt: new Date(),
      reviewedBy: session.user.id,
    },
  });

  await audit({
    actorId: session.user.id,
    action: 'org.tax_exemption.approve',
    targetType: 'taxExemption',
    targetId: exemptionId,
    metadata: { organizationId: orgId },
  });

  revalidatePath(`/dashboard/orgs/${orgId}`);
}
