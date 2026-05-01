import { NextResponse } from 'next/server';
import { getSession } from '@/server/auth';
import { prisma } from '@/server/db';
import { renderInvoicePdf } from '@/server/invoices/pdf';

/**
 * Streams a PDF rendering of the requested invoice. Auth + membership are
 * checked the same way the read view checks them: caller must be signed in
 * AND be a member of the org that owns the invoice.
 *
 * Sets `inline` Content-Disposition with a sensible filename so browsers
 * preview by default but a "Save as…" picks up `Onsective-Invoice-…pdf`.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const invoice = await prisma.b2BInvoice.findUnique({
    where: { id: params.id },
    include: {
      organization: {
        select: { legalName: true, taxId: true, countryCode: true },
      },
      orders: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          currency: true,
          items: {
            select: {
              productTitle: true,
              variantTitle: true,
              qty: true,
              lineSubtotal: true,
            },
          },
        },
      },
    },
  });
  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
  }

  const member = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: invoice.organizationId,
        userId: session.user.id,
      },
    },
    select: { id: true },
  });
  if (!member) {
    // Don't reveal that an invoice exists when the requester isn't a member —
    // keep the response shape identical to the not-found case.
    return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
  }

  const isOverdue =
    invoice.status === 'ISSUED' && !!invoice.dueAt && invoice.dueAt < new Date();

  const pdf = await renderInvoicePdf({
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    isOverdue,
    issuedAt: invoice.issuedAt,
    dueAt: invoice.dueAt,
    paidAt: invoice.paidAt,
    subtotalMinor: invoice.subtotalMinor,
    taxMinor: invoice.taxMinor,
    totalMinor: invoice.totalMinor,
    currency: invoice.currency,
    organization: invoice.organization,
    orders: invoice.orders.map((o) => ({
      orderNumber: o.orderNumber,
      totalAmount: o.totalAmount,
      currency: o.currency,
      items: o.items,
    })),
  });

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(pdf.byteLength),
      'Content-Disposition': `inline; filename="Onsective-Invoice-${invoice.invoiceNumber}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
