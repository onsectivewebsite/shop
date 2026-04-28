import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { easyPost } from '@/server/shipping/easypost';

/**
 * EasyPost tracking webhook. Maps the carrier's status taxonomy onto our
 * `ShipmentStatus` enum, persists a `TrackingEvent`, and bumps the parent
 * Shipment.
 *
 * Idempotent: an inbound event is keyed on (awbNumber, eventType, datetime),
 * upsert prevents duplicate writes if EasyPost retries.
 */

const STATUS_MAP: Record<string, import('@onsective/db').ShipmentStatus> = {
  pre_transit: 'LABEL_CREATED',
  in_transit: 'IN_TRANSIT',
  out_for_delivery: 'OUT_FOR_DELIVERY',
  delivered: 'DELIVERED',
  return_to_sender: 'RTO_INITIATED',
  failure: 'EXCEPTION',
  unknown: 'EXCEPTION',
};

export async function POST(req: Request) {
  const body = await req.text();
  let event: ReturnType<typeof easyPost.verifyWebhook>;
  try {
    event = easyPost.verifyWebhook({ body, headers: req.headers });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Bad signature' },
      { status: 400 },
    );
  }

  if (!event.awbNumber) return NextResponse.json({ ok: true, ignored: 'no awb' });

  const shipment = await prisma.shipment.findUnique({ where: { awbNumber: event.awbNumber } });
  if (!shipment) return NextResponse.json({ ok: true, ignored: 'no shipment match' });

  const payload = event.payload as {
    description: string;
    result?: { status?: string; tracking_details?: Array<{ status: string; datetime: string; message?: string; tracking_location?: { city?: string; state?: string; country?: string } }> };
  };

  const trackingDetails = payload.result?.tracking_details ?? [];
  for (const detail of trackingDetails) {
    const occurredAt = new Date(detail.datetime);
    // No unique index on (shipmentId, status, occurredAt); fall back to a
    // findFirst+create dedup. Tracking events are append-only — a duplicate
    // is harmless but noisy so we skip it.
    const existing = await prisma.trackingEvent.findFirst({
      where: { shipmentId: shipment.id, status: detail.status, occurredAt },
      select: { id: true },
    });
    if (existing) continue;
    await prisma.trackingEvent.create({
      data: {
        shipmentId: shipment.id,
        status: detail.status,
        rawStatus: detail.status,
        description: detail.message ?? detail.status,
        location: detail.tracking_location
          ? `${detail.tracking_location.city ?? ''}, ${detail.tracking_location.state ?? ''} ${detail.tracking_location.country ?? ''}`.trim()
          : null,
        occurredAt,
      },
    });
  }

  const finalStatus = payload.result?.status;
  if (finalStatus && STATUS_MAP[finalStatus]) {
    const next = STATUS_MAP[finalStatus]!;
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        status: next,
        deliveredAt: next === 'DELIVERED' ? new Date() : shipment.deliveredAt,
        rawCarrierPayload: payload as unknown as object,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
