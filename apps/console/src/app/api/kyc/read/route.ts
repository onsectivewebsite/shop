import { NextResponse } from 'next/server';
import { prisma } from '@onsective/db';
import { getConsoleSession } from '@/server/auth';
import { audit } from '@/lib/audit';
import { createKycReadUrl } from '@/server/kyc-read';

export async function GET(req: Request) {
  const session = await getConsoleSession();
  if (!session) return NextResponse.json({ error: 'Not authorized.' }, { status: 401 });

  const url = new URL(req.url);
  const documentId = url.searchParams.get('documentId');
  if (!documentId) {
    return NextResponse.json({ error: 'documentId required.' }, { status: 400 });
  }

  const doc = await prisma.kycDocument.findUnique({
    where: { id: documentId },
    select: { id: true, sellerId: true, fileKey: true, type: true },
  });
  if (!doc) return NextResponse.json({ error: 'Document not found.' }, { status: 404 });

  // Defence-in-depth: verify the key matches the seller path. A malformed row
  // (different sellerId in fileKey vs sellerId column) would otherwise leak.
  if (!doc.fileKey.startsWith(`kyc/${doc.sellerId}/`)) {
    return NextResponse.json({ error: 'Key path mismatch.' }, { status: 403 });
  }

  let signed: { url: string; expiresAt: Date };
  try {
    signed = await createKycReadUrl(doc.fileKey);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sign failed.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Audit who looked at which doc — required for compliance + abuse tracing.
  await audit({
    actorId: session.user.id,
    action: 'seller.kyc.document.view',
    targetType: 'kycDocument',
    targetId: documentId,
    metadata: { sellerId: doc.sellerId, type: doc.type },
  });

  // Redirect the browser straight at the presigned URL — clean UX vs. JSON.
  return NextResponse.redirect(signed.url, 303);
}
