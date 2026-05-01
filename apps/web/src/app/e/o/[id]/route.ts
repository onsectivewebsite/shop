import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';

/**
 * Open-tracking pixel. <img src="/e/o/<sentEventId>.gif"> on every marketing
 * email. We dedup by checking for an existing OPENED row keyed off the same
 * source SENT id — Apple Mail (and Gmail's image cache) prefetches the
 * pixel before the user actually opens, which would otherwise inflate counts
 * by 100%+. Treating the first hit as the open is a pragmatic compromise
 * (some loads will be prefetches, some real); using the source id as the
 * dedup key means at most one OPENED per send.
 *
 * The route always returns the GIF — failures here must not break image
 * rendering in the inbox. Errors only fail the write; the body is fine.
 */

const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

const HEADERS: HeadersInit = {
  'Content-Type': 'image/gif',
  'Content-Length': String(TRANSPARENT_GIF.byteLength),
  // Aggressive no-cache — most clients honour it for inline images and we
  // want every distinct open event recorded against the user's behaviour.
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'Pragma': 'no-cache',
  Expires: '0',
};

function pixelResponse(): Response {
  // Use the Web Response API — NextResponse doesn't accept Buffer body in
  // some Next 14 patch versions.
  return new Response(new Uint8Array(TRANSPARENT_GIF), {
    status: 200,
    headers: HEADERS,
  });
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  // <id>.gif suffix lets the URL look like a static asset to spam filters
  // without the route caring about the extension.
  const id = params.id.replace(/\.gif$/i, '');

  try {
    const source = await prisma.emailEvent.findUnique({
      where: { id },
      select: { id: true, campaignId: true, userId: true, type: true },
    });
    if (source && source.type === 'SENT') {
      const already = await prisma.emailEvent.findFirst({
        where: {
          campaignId: source.campaignId,
          userId: source.userId,
          type: 'OPENED',
          metadata: { path: ['sourceId'], equals: source.id },
        },
        select: { id: true },
      });
      if (!already) {
        await prisma.emailEvent.create({
          data: {
            campaignId: source.campaignId,
            userId: source.userId,
            type: 'OPENED',
            metadata: { sourceId: source.id },
          },
        });
      }
    }
  } catch {
    // Swallow — image must always render.
  }

  return pixelResponse();
}
