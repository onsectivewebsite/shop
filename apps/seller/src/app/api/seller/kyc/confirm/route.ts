import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { getSellerSession } from '@/server/auth';
import type { KycDocType } from '@onsective/db';

const VALID_TYPES: KycDocType[] = [
  'GOVT_ID',
  'TAX_CERTIFICATE',
  'BANK_STATEMENT',
  'BUSINESS_REGISTRATION',
  'ADDRESS_PROOF',
];

export async function POST(req: Request) {
  const session = await getSellerSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } });
  if (!seller) return NextResponse.json({ error: 'No seller account.' }, { status: 404 });

  let body: { docType?: string; key?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }

  if (!body.docType || !VALID_TYPES.includes(body.docType as KycDocType)) {
    return NextResponse.json({ error: 'Invalid doc type.' }, { status: 400 });
  }
  if (!body.key || typeof body.key !== 'string' || body.key.length > 512) {
    return NextResponse.json({ error: 'Bad key.' }, { status: 400 });
  }
  // Enforce seller-scoped key prefix.
  const expected = `kyc/${seller.id}/`;
  if (!body.key.startsWith(expected)) {
    return NextResponse.json({ error: 'Key does not belong to seller.' }, { status: 403 });
  }

  // Replace any existing PENDING doc of this type so the seller can resubmit
  // before review. APPROVED docs are kept (immutable history).
  await prisma.kycDocument.updateMany({
    where: { sellerId: seller.id, type: body.docType as KycDocType, status: 'PENDING' },
    data: { status: 'REJECTED', reviewedAt: new Date(), notes: 'Superseded by re-upload' },
  });

  await prisma.kycDocument.create({
    data: {
      sellerId: seller.id,
      type: body.docType as KycDocType,
      fileKey: body.key,
      status: 'PENDING',
    },
  });

  // Move seller status to KYC_SUBMITTED if all required docs now have at
  // least one PENDING or APPROVED submission. Idempotent: only updates if
  // the status is currently PENDING_KYC.
  if (seller.status === 'PENDING_KYC') {
    const submitted = await prisma.kycDocument.findMany({
      where: {
        sellerId: seller.id,
        status: { in: ['PENDING', 'APPROVED'] },
      },
      select: { type: true },
    });
    const submittedTypes = new Set(submitted.map((d) => d.type));
    const allRequired = VALID_TYPES.every((t) => submittedTypes.has(t));
    if (allRequired) {
      await prisma.seller.update({
        where: { id: seller.id },
        data: { status: 'KYC_SUBMITTED' },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
