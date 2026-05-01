import PDFDocument from 'pdfkit';

/**
 * Build a print-ready PDF for a B2B invoice. Pure function over the data
 * shape returned by `organizations.invoices.get` so it can be unit-tested
 * without a request context.
 *
 * Layout intentionally plain — black on white, single column, mono numerics
 * — to keep file size small and survive any printer / archive PDF reader.
 * Onsective branding is one wordmark line at the top; that's enough.
 */

export type InvoicePdfInput = {
  invoiceNumber: string;
  status: string;
  isOverdue: boolean;
  issuedAt: Date | null;
  dueAt: Date | null;
  paidAt: Date | null;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  currency: string;
  organization: {
    legalName: string;
    taxId: string | null;
    countryCode: string;
  };
  orders: Array<{
    orderNumber: string;
    totalAmount: number;
    currency: string;
    items: Array<{
      productTitle: string;
      variantTitle: string | null;
      qty: number;
      lineSubtotal: number;
    }>;
  }>;
};

function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(minor / 100);
}

function fmtDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : '—';
}

/**
 * Returns a Buffer of the rendered PDF. Builds the document into a chunks
 * array because pdfkit's stream API + Node Buffer concat is the most
 * reliable way to get bytes back synchronously enough for a route response.
 */
export function renderInvoicePdf(invoice: InvoicePdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `Onsective Invoice ${invoice.invoiceNumber}`,
        Author: 'Onsective',
        Subject: `Invoice for ${invoice.organization.legalName}`,
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header — wordmark + invoice metadata.
    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .text('Onsective.', 50, 50);

    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#64748b')
      .text('INVOICE', 400, 55, { align: 'right' });

    doc
      .fillColor('#0f172a')
      .font('Helvetica-Bold')
      .fontSize(14)
      .text(invoice.invoiceNumber, 400, 70, { align: 'right' });

    const status = invoice.isOverdue ? 'OVERDUE' : invoice.status;
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(status === 'PAID' ? '#047857' : status === 'OVERDUE' ? '#b91c1c' : '#64748b')
      .text(status, 400, 92, { align: 'right' });

    doc.fillColor('#0f172a');
    doc.moveDown(2);

    // Bill-to + From blocks side by side. PDFKit's flow layout is
    // single-column by default, so we anchor positions explicitly.
    const blockTop = 150;
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#64748b')
      .text('BILL TO', 50, blockTop);
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#0f172a')
      .text(invoice.organization.legalName, 50, blockTop + 15);
    if (invoice.organization.taxId) {
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#64748b')
        .text(`Tax ID: ${invoice.organization.taxId}`, 50, blockTop + 32);
    }
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#64748b')
      .text(invoice.organization.countryCode, 50, blockTop + 46);

    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#64748b')
      .text('FROM', 320, blockTop);
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#0f172a')
      .text('Onsective', 320, blockTop + 15);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#64748b')
      .text('billing@onsective.com', 320, blockTop + 32);

    // Issued / Due / Paid row.
    const datesTop = blockTop + 80;
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#64748b');
    doc.text('ISSUED', 50, datesTop);
    doc.text('DUE', 200, datesTop);
    doc.text('PAID', 350, datesTop);
    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor('#0f172a');
    doc.text(fmtDate(invoice.issuedAt), 50, datesTop + 14);
    doc.text(fmtDate(invoice.dueAt), 200, datesTop + 14);
    doc.text(fmtDate(invoice.paidAt), 350, datesTop + 14);

    // Line items.
    let cursor = datesTop + 60;
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#64748b')
      .text('ORDERS ON THIS INVOICE', 50, cursor);
    cursor += 18;

    doc
      .strokeColor('#e2e8f0')
      .lineWidth(0.5)
      .moveTo(50, cursor)
      .lineTo(545, cursor)
      .stroke();
    cursor += 8;

    for (const order of invoice.orders) {
      // Order header row.
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#0f172a')
        .text(order.orderNumber, 50, cursor);
      doc
        .font('Helvetica')
        .fontSize(10)
        .text(formatMoney(order.totalAmount, order.currency), 0, cursor, {
          width: 545,
          align: 'right',
        });
      cursor += 16;

      // Per-item rows. Indent so they read as children of the order header.
      doc.font('Helvetica').fontSize(9).fillColor('#475569');
      for (const item of order.items) {
        const label =
          (item.variantTitle
            ? `${item.productTitle} · ${item.variantTitle}`
            : item.productTitle) + ` × ${item.qty}`;
        doc.text(label, 70, cursor, { width: 350 });
        doc.text(formatMoney(item.lineSubtotal, order.currency), 0, cursor, {
          width: 525,
          align: 'right',
        });
        cursor += 14;
      }
      cursor += 8;

      // Page break before we run off — A4 at 50pt margin caps body height
      // around 740pt. We start a new page at 720 to keep totals on the
      // following page rather than splitting them.
      if (cursor > 720) {
        doc.addPage();
        cursor = 50;
      }
    }

    cursor += 10;
    doc
      .strokeColor('#e2e8f0')
      .lineWidth(0.5)
      .moveTo(50, cursor)
      .lineTo(545, cursor)
      .stroke();
    cursor += 14;

    // Totals — right-aligned column.
    const totalsLabelX = 380;
    const totalsValueX = 0; // width-anchored
    const drawRow = (label: string, value: string, bold = false) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 12 : 10);
      doc.fillColor(bold ? '#0f172a' : '#475569');
      doc.text(label, totalsLabelX, cursor);
      doc.text(value, totalsValueX, cursor, { width: 545, align: 'right' });
      cursor += bold ? 18 : 14;
    };
    drawRow('Subtotal', formatMoney(invoice.subtotalMinor, invoice.currency));
    drawRow('Tax', formatMoney(invoice.taxMinor, invoice.currency));
    cursor += 4;
    doc
      .strokeColor('#0f172a')
      .lineWidth(0.5)
      .moveTo(380, cursor - 2)
      .lineTo(545, cursor - 2)
      .stroke();
    drawRow('Total', formatMoney(invoice.totalMinor, invoice.currency), true);

    // Footer note.
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#94a3b8')
      .text(
        'Questions about this invoice? billing@onsective.com',
        50,
        780,
        { align: 'center', width: 495 },
      );

    doc.end();
  });
}
