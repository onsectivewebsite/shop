import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { getSellerSession } from '@/server/auth';
import { ALLOWED_IMAGE_MIME, type AllowedImageMime } from '@/server/uploads';
import { imagesQueue, IMAGE_VARIANTS_JOB } from '@/server/queue';

export async function POST(req: Request) {
  const session = await getSellerSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } });
  if (!seller) return NextResponse.json({ error: 'No seller account.' }, { status: 404 });

  let body: { key?: string; contentType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }

  if (!body.key || typeof body.key !== 'string' || body.key.length > 512) {
    return NextResponse.json({ error: 'Bad key.' }, { status: 400 });
  }
  if (!body.contentType || !ALLOWED_IMAGE_MIME.includes(body.contentType as AllowedImageMime)) {
    return NextResponse.json({ error: 'Unsupported image type.' }, { status: 400 });
  }

  // Enforce seller-scoped key prefix.
  const expectedPrefix = `sellers/${seller.id}/`;
  if (!body.key.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: 'Key does not belong to seller.' }, { status: 403 });
  }

  try {
    await imagesQueue().add(
      IMAGE_VARIANTS_JOB,
      { sourceKey: body.key, contentType: body.contentType as AllowedImageMime },
      {
        jobId: `variants:${body.key}`,
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );
    return NextResponse.json({ enqueued: true });
  } catch {
    // Fail-soft: variants will be missed but the upload is fine.
    return NextResponse.json({ enqueued: false });
  }
}
