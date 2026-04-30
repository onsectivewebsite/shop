import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/server/db';
import { getSellerSession } from '@/server/auth';

function shipmentNumber(): string {
  // Format: SHP-YYYY-XXXXXX (date-prefixed for human readability)
  const year = new Date().getUTCFullYear();
  const rand = randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
  return `SHP-${year}-${rand}`;
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getSellerSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } });
  if (!seller) return NextResponse.json({ error: 'No seller account.' }, { status: 404 });

  const item = await prisma.orderItem.findFirst({
    where: { id: params.id, sellerId: seller.id },
    include: {
      order: { select: { id: true, currency: true, shippingAddressId: true } },
      variant: { select: { weightGrams: true, lengthMm: true, widthMm: true, heightMm: true } },
    },
  });
  if (!item) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });

  if (!['PAID', 'CONFIRMED'].includes(item.status)) {
    return NextResponse.json(
      { error: `Cannot ship from status ${item.status}.` },
      { status: 409 },
    );
  }

  let body: { carrier?: string; awbNumber?: string; trackingUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }

  // Seller's pickup address — we use the primary address on file. This is a v0
  // simplification; later we let sellers pick from multiple pickup addresses.
  const sellerAddress = await prisma.address.findFirst({
    where: { sellerId: seller.id, isDefault: true },
  });
  if (!sellerAddress) {
    return NextResponse.json(
      {
        error:
          'No pickup address configured. Add one in your storefront settings before shipping.',
      },
      { status: 400 },
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.create({
        data: {
          shipmentNumber: shipmentNumber(),
          orderId: item.order.id,
          sellerId: seller.id,
          carrier: body.carrier ?? null,
          awbNumber: body.awbNumber?.trim() || null,
          trackingUrl: body.trackingUrl?.trim() || null,
          fromAddressId: sellerAddress.id,
          toAddressId: item.order.shippingAddressId,
          weightGrams: item.variant.weightGrams * item.qty,
          lengthMm: item.variant.lengthMm,
          widthMm: item.variant.widthMm,
          heightMm: item.variant.heightMm,
          declaredValue: item.lineSubtotal,
          currency: item.order.currency,
          shippingCost: item.shippingAmount,
          shippingChargedToBuyer: item.shippingAmount,
          status: 'IN_TRANSIT',
          pickedUpAt: new Date(),
        },
      });

      await tx.orderItem.update({
        where: { id: item.id },
        data: { status: 'SHIPPED', shipmentId: shipment.id },
      });

      await tx.orderEvent.create({
        data: {
          orderId: item.order.id,
          type: 'shipped',
          fromStatus: item.status,
          toStatus: 'SHIPPED',
          actor: `seller:${seller.id}`,
          metadata: {
            orderItemId: item.id,
            shipmentId: shipment.id,
            carrier: body.carrier ?? null,
            awbNumber: body.awbNumber ?? null,
          },
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Could not mark shipped.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
