import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { getSellerSession } from '@/server/auth';
import {
  ALLOWED_KYC_MIME,
  MAX_KYC_DOC_BYTES,
  createKycUploadUrl,
  type AllowedKycMime,
} from '@/server/uploads';

const VALID_TYPES = [
  'GOVT_ID',
  'TAX_CERTIFICATE',
  'BANK_STATEMENT',
  'BUSINESS_REGISTRATION',
  'ADDRESS_PROOF',
] as const;

export async function POST(req: Request) {
  const session = await getSellerSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } });
  if (!seller) return NextResponse.json({ error: 'No seller account.' }, { status: 404 });

  let body: { docType?: string; contentType?: string; sizeBytes?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }

  if (!body.docType || !VALID_TYPES.includes(body.docType as (typeof VALID_TYPES)[number])) {
    return NextResponse.json({ error: 'Invalid doc type.' }, { status: 400 });
  }
  if (!body.contentType || !ALLOWED_KYC_MIME.includes(body.contentType as AllowedKycMime)) {
    return NextResponse.json(
      { error: 'Use JPEG, PNG, WebP, or PDF.' },
      { status: 400 },
    );
  }
  if (typeof body.sizeBytes !== 'number' || body.sizeBytes <= 0 || body.sizeBytes > MAX_KYC_DOC_BYTES) {
    return NextResponse.json({ error: 'File must be ≤ 10 MB.' }, { status: 400 });
  }

  try {
    const signed = await createKycUploadUrl({
      sellerId: seller.id,
      docType: body.docType,
      contentType: body.contentType as AllowedKycMime,
      sizeBytes: body.sizeBytes,
    });
    return NextResponse.json(signed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sign failed.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
