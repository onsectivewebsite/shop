'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/server/db';
import { getSession } from '@/server/auth/session';

const COUNTRY_RE = /^[A-Z]{2}$/;

function field(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function validate(formData: FormData) {
  const recipient = field(formData, 'recipient');
  const phone = field(formData, 'phone');
  const line1 = field(formData, 'line1');
  const city = field(formData, 'city');
  const state = field(formData, 'state');
  const postalCode = field(formData, 'postalCode');
  const countryCode = field(formData, 'countryCode').toUpperCase();
  const line2 = field(formData, 'line2');
  const label = field(formData, 'label');
  const type = field(formData, 'type') || 'SHIPPING';
  const isDefault = formData.get('isDefault') === 'on';

  if (!recipient || recipient.length < 2) throw new Error('Recipient name required.');
  if (!phone) throw new Error('Phone required.');
  if (!line1) throw new Error('Address line 1 required.');
  if (!city) throw new Error('City required.');
  if (!state) throw new Error('State / region required.');
  if (!postalCode) throw new Error('Postal code required.');
  if (!COUNTRY_RE.test(countryCode)) throw new Error('Country must be a 2-letter ISO code.');
  if (type !== 'SHIPPING' && type !== 'BILLING') throw new Error('Invalid type.');

  return {
    recipient,
    phone,
    line1,
    line2: line2 || null,
    city,
    state,
    postalCode,
    countryCode,
    label: label || null,
    type: type as 'SHIPPING' | 'BILLING',
    isDefault,
  };
}

export async function createAddressAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error('Not signed in.');
  const data = validate(formData);

  await prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      // Only one default per (user, type)
      await tx.address.updateMany({
        where: { userId: session.user.id, type: data.type, isDefault: true },
        data: { isDefault: false },
      });
    }
    await tx.address.create({
      data: { ...data, userId: session.user.id },
    });
  });

  revalidatePath('/account/addresses');
  redirect('/account/addresses');
}

export async function updateAddressAction(addressId: string, formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error('Not signed in.');
  const data = validate(formData);

  // Verify ownership before mutating.
  const existing = await prisma.address.findFirst({
    where: { id: addressId, userId: session.user.id },
    select: { id: true, type: true },
  });
  if (!existing) throw new Error('Address not found.');

  await prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.address.updateMany({
        where: {
          userId: session.user.id,
          type: data.type,
          isDefault: true,
          NOT: { id: addressId },
        },
        data: { isDefault: false },
      });
    }
    await tx.address.update({
      where: { id: addressId },
      data,
    });
  });

  revalidatePath('/account/addresses');
  redirect('/account/addresses');
}

export async function deleteAddressAction(addressId: string): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error('Not signed in.');

  // Address rows are referenced by Order via shippingAddressId/billingAddressId.
  // Setting userId to null preserves the historical snapshot Orders need
  // without keeping the address visible in the buyer's address book.
  const updated = await prisma.address.updateMany({
    where: { id: addressId, userId: session.user.id },
    data: { userId: null, isDefault: false },
  });
  if (updated.count === 0) throw new Error('Address not found.');

  revalidatePath('/account/addresses');
}

export async function setDefaultAddressAction(addressId: string): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error('Not signed in.');

  const addr = await prisma.address.findFirst({
    where: { id: addressId, userId: session.user.id },
    select: { type: true },
  });
  if (!addr) throw new Error('Address not found.');

  await prisma.$transaction([
    prisma.address.updateMany({
      where: {
        userId: session.user.id,
        type: addr.type,
        isDefault: true,
        NOT: { id: addressId },
      },
      data: { isDefault: false },
    }),
    prisma.address.update({
      where: { id: addressId },
      data: { isDefault: true },
    }),
  ]);

  revalidatePath('/account/addresses');
}
