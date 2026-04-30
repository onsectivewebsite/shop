import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { getSellerSession } from '@/server/auth';
import { ALLOWED_IMAGE_MIME, MAX_PRODUCT_IMAGE_BYTES, createProductImageUploadUrl, type AllowedImageMime } from '@/server/uploads';

export async function POST(req: Request) {
  const session = await getSellerSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } });
  if (!seller) return NextResponse.json({ error: 'No seller account.' }, { status: 404 });

  let body: { contentType?: string; sizeBytes?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }

  if (!body.contentType || !ALLOWED_IMAGE_MIME.includes(body.contentType as AllowedImageMime)) {
    return NextResponse.json({ error: 'Unsupported image type.' }, { status: 400 });
  }
  if (typeof body.sizeBytes !== 'number' || body.sizeBytes <= 0 || body.sizeBytes > MAX_PRODUCT_IMAGE_BYTES) {
    return NextResponse.json({ error: 'Image must be ≤ 5 MB.' }, { status: 400 });
  }

  try {
    const signed = await createProductImageUploadUrl({
      sellerId: seller.id,
      contentType: body.contentType as AllowedImageMime,
      sizeBytes: body.sizeBytes,
    });
    return NextResponse.json(signed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sign failed.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
