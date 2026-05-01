import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';

/**
 * Click-tracker. Email anchors are rewritten to /e/c/<sentEventId>?u=<url>;
 * this route writes a CLICKED EmailEvent and 302s to the destination.
 *
 * No dedup on clicks — multiple clicks from the same recipient ARE signal
 * (engagement intensity, sharing the link). Bots that prefetch the URL once
 * to inspect it will inflate counts by ~1; the cost of distinguishing isn't
 * worth it at our volumes.
 *
 * If the destination URL is missing or off-domain to anything we don't
 * recognise, fall back to the homepage rather than redirecting blindly —
 * stops the route being used as an open redirector.
 */

function safeDestination(raw: string | null): string {
  const fallback = process.env.NEXT_PUBLIC_APP_URL ?? 'https://itsnottechy.cloud';
  if (!raw) return fallback;
  try {
    const u = new URL(raw);
    // Only redirect to our own marketplace + a small allow-list of partner
    // domains. Stripe / EasyPost won't be linked from marketing emails, so
    // this stays tight.
    const ourHosts = new Set<string>();
    const appHost = new URL(fallback).host;
    ourHosts.add(appHost);
    ourHosts.add(`seller.${appHost.replace(/^www\./, '')}`);
    if (!ourHosts.has(u.host)) return fallback;
    return u.toString();
  } catch {
    return fallback;
  }
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const url = new URL(req.url);
  const destination = safeDestination(url.searchParams.get('u'));

  try {
    const source = await prisma.emailEvent.findUnique({
      where: { id: params.id },
      select: { id: true, campaignId: true, userId: true, type: true },
    });
    if (source && source.type === 'SENT') {
      await prisma.emailEvent.create({
        data: {
          campaignId: source.campaignId,
          userId: source.userId,
          type: 'CLICKED',
          metadata: { sourceId: source.id, url: destination },
        },
      });
    }
  } catch {
    // Swallow — never block the redirect on a tracking failure.
  }

  return NextResponse.redirect(destination, { status: 302 });
}
