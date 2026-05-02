'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@onsective/db';
import { getConsoleSession } from '@/server/auth';
import { audit } from '@/lib/audit';

function parseMajorAsMinor(value: FormDataEntryValue | null): number | null {
  if (value === null) return null;
  const trimmed = value.toString().trim();
  if (trimmed.length === 0) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function parseInt0(value: FormDataEntryValue | null): number | null {
  if (value === null) return null;
  const trimmed = value.toString().trim();
  if (trimmed.length === 0) return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

export async function createCouponAction(formData: FormData): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  const code = (formData.get('code') ?? '').toString().trim().toUpperCase();
  if (code.length === 0 || code.length > 64) throw new Error('Invalid code');

  const type = formData.get('type')?.toString();
  if (type !== 'PERCENT' && type !== 'FIXED_AMOUNT') {
    throw new Error('Invalid type');
  }

  const rawValue = formData.get('value')?.toString().trim() ?? '';
  const valueNum = Number(rawValue);
  if (!Number.isFinite(valueNum) || valueNum <= 0) {
    throw new Error('Invalid value');
  }
  // PERCENT: store basis points. FIXED_AMOUNT: store minor units.
  const value = type === 'PERCENT'
    ? Math.round(valueNum * 100)
    : Math.round(valueNum * 100);

  if (type === 'PERCENT' && value > 10_000) {
    throw new Error('Percent off cannot exceed 100');
  }

  const currency = type === 'FIXED_AMOUNT'
    ? (formData.get('currency') ?? '').toString().trim().toUpperCase().slice(0, 3)
    : null;
  if (type === 'FIXED_AMOUNT' && (!currency || currency.length !== 3)) {
    throw new Error('Currency required for fixed-amount coupons');
  }

  const minOrderMinor = parseMajorAsMinor(formData.get('minOrder'));
  const maxDiscountMinor =
    type === 'PERCENT' ? parseMajorAsMinor(formData.get('maxDiscount')) : null;
  const maxUses = parseInt0(formData.get('maxUses'));
  const description = (formData.get('description') ?? '').toString().trim().slice(0, 500) || null;

  const validUntilRaw = (formData.get('validUntil') ?? '').toString().trim();
  const validUntil = validUntilRaw.length > 0 ? new Date(validUntilRaw) : null;
  if (validUntil && Number.isNaN(validUntil.getTime())) {
    throw new Error('Invalid expiry date');
  }

  try {
    const created = await prisma.coupon.create({
      data: {
        code,
        type,
        value,
        currency,
        // 0/null both mean "no minimum" — store null to make the eligibility
        // check a clean IS NULL rather than a > 0 comparison.
        minOrderMinor: minOrderMinor && minOrderMinor > 0 ? minOrderMinor : null,
        maxDiscountMinor:
          maxDiscountMinor && maxDiscountMinor > 0 ? maxDiscountMinor : null,
        maxUses: maxUses && maxUses > 0 ? maxUses : null,
        validUntil,
        description,
        createdById: session.user.id,
      },
      select: { id: true },
    });
    await audit({
      actorId: session.user.id,
      action: 'coupon.create',
      targetType: 'coupon',
      targetId: created.id,
      metadata: { code, type, value, currency },
    });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') {
      throw new Error(`Coupon code "${code}" already exists`);
    }
    throw err;
  }

  revalidatePath('/dashboard/coupons');
}

export async function toggleCouponActiveAction(couponId: string): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  const coupon = await prisma.coupon.findUnique({
    where: { id: couponId },
    select: { id: true, isActive: true, code: true },
  });
  if (!coupon) throw new Error('Coupon not found');

  await prisma.coupon.update({
    where: { id: couponId },
    data: { isActive: !coupon.isActive },
  });

  await audit({
    actorId: session.user.id,
    action: coupon.isActive ? 'coupon.disable' : 'coupon.enable',
    targetType: 'coupon',
    targetId: couponId,
    metadata: { code: coupon.code },
  });

  revalidatePath('/dashboard/coupons');
}
