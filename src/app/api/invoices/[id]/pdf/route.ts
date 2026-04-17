import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET /api/invoices/[id]/pdf - Generate PDF invoice
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['invoices.view', 'billing.manage', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }

    const { id } = await params;

    // Try to find an Invoice record first
    const invoice = await db.invoice.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (invoice) {
      const tenant = await db.tenant.findUnique({ where: { id: user.tenantId } });
      let property = null;
      if (invoice.folioId) {
        const folio = await db.folio.findUnique({
          where: { id: invoice.folioId },
          include: { booking: { include: { property: true } } },
        });
        property = folio?.booking?.property || null;
      }

      let lineItems: Array<{ description: string; quantity: number; unitPrice: number; totalAmount: number; taxRate: number; taxAmount: number }> = [];
      try { lineItems = JSON.parse(invoice.lineItems || '[]'); } catch { /* empty */ }

      const pdfBuffer = buildInvoicePdf(invoice, lineItems, tenant, property);
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="invoice-${invoice.invoiceNumber}.pdf"`,
        },
      });
    }

    // Fallback: try folio-based invoice (legacy)
    const folio = await db.folio.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        booking: {
          include: {
            primaryGuest: true,
            room: { include: { roomType: true } },
            property: true,
          },
        },
        lineItems: true,
        payments: true,
      },
    });

    if (!folio) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } }, { status: 404 });
    }

    const pdfBuffer = buildLegacyFolioPdf(folio);
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="invoice-${folio.invoiceNumber || folio.folioNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to generate invoice PDF' } }, { status: 500 });
  }
}

function buildInvoicePdf(
  invoice: { invoiceNumber: string; customerName: string; customerEmail?: string | null; customerAddress?: string | null; customerPhone?: string | null; subtotal: number; taxes: number; discount: number; totalAmount: number; currency: string; issuedAt?: Date | null; dueAt?: Date | null; paidAt?: Date | null; status: string; notes?: string | null },
  lineItems: Array<{ description: string; quantity: number; unitPrice: number; totalAmount: number; taxRate: number; taxAmount: number }>,
  tenant: { name?: string; address?: string | null; city?: string | null; country?: string | null; phone?: string | null; email?: string } | null,
  property: { name: string; address: string; city?: string | null; state?: string | null; country: string; postalCode?: string | null; phone?: string | null; email?: string | null; taxId?: string | null } | null
): Buffer {
  const doc = new jsPDF() as jsPDF & { lastAutoTable: { finalY: number } };
  const companyName = property?.name || tenant?.name || 'StaySuite Hotel';
  const companyAddr = property ? [property.address, property.city, property.state, property.country, property.postalCode].filter(Boolean).join(', ') : tenant ? [tenant.address, tenant.city, tenant.country].filter(Boolean).join(', ') : '';
  const companyPhone = property?.phone || tenant?.phone || '';
  const companyEmail = property?.email || tenant?.email || '';

  // Header
  doc.setFontSize(28);
  doc.setTextColor(16, 185, 129);
  doc.text('INVOICE', 105, 22, { align: 'center' });

  // Company info
  doc.setFontSize(13);
  doc.setTextColor(30, 30, 30);
  doc.text(companyName, 14, 38);
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  if (companyAddr) doc.text(companyAddr, 14, 44);
  if (companyPhone) doc.text(`Tel: ${companyPhone}`, 14, companyAddr ? 50 : 44);
  if (companyEmail) doc.text(`Email: ${companyEmail}`, 14, companyAddr ? (companyPhone ? 56 : 50) : (companyPhone ? 50 : 44));

  // Invoice details
  const rc = 120;
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text('Invoice #:', rc, 38);
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.invoiceNumber, rc + 22, 38);
  doc.setFont('helvetica', 'normal');

  if (invoice.issuedAt) {
    doc.setTextColor(100, 100, 100);
    doc.text('Issued:', rc, 44);
    doc.setTextColor(30, 30, 30);
    doc.text(new Date(invoice.issuedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }), rc + 22, 44);
  }
  if (invoice.dueAt) {
    doc.setTextColor(100, 100, 100);
    doc.text('Due:', rc, 50);
    doc.setTextColor(30, 30, 30);
    doc.text(new Date(invoice.dueAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }), rc + 22, 50);
  }

  doc.setTextColor(100, 100, 100);
  doc.text('Status:', rc, 56);
  const statusColors: Record<string, [number, number, number]> = { draft: [150, 150, 150], issued: [6, 182, 212], sent: [6, 182, 212], paid: [16, 185, 129], overdue: [239, 68, 68], cancelled: [120, 120, 120] };
  const sc = statusColors[invoice.status] || [120, 120, 120];
  doc.setTextColor(sc[0], sc[1], sc[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.status.toUpperCase(), rc + 22, 56);
  doc.setFont('helvetica', 'normal');

  // Bill To
  let yPos = (companyAddr && companyPhone && companyEmail) ? 68 : 64;
  doc.setDrawColor(220, 220, 220);
  doc.line(14, yPos - 4, 196, yPos - 4);

  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text('Bill To:', 14, yPos + 2);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.customerName, 14, yPos + 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  let btY = yPos + 15;
  if (invoice.customerAddress) { doc.text(invoice.customerAddress, 14, btY); btY += 5; }
  if (invoice.customerEmail) { doc.text(invoice.customerEmail, 14, btY); btY += 5; }
  if (invoice.customerPhone) { doc.text(invoice.customerPhone, 14, btY); btY += 5; }

  // Line Items Table
  const tableStartY = btY + 8;
  const tableData = lineItems.map(item => [
    item.description,
    item.quantity.toString(),
    `${invoice.currency} ${item.unitPrice.toFixed(2)}`,
    item.taxRate > 0 ? `${invoice.currency} ${item.taxAmount.toFixed(2)}` : '-',
    `${invoice.currency} ${item.totalAmount.toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: tableStartY,
    head: [['Description', 'Qty', 'Unit Price', 'Tax', 'Total']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 75 },
      1: { cellWidth: 15, halign: 'center' },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 25, halign: 'right' },
      4: { cellWidth: 30, halign: 'right' },
    },
  });

  // Totals
  const fy = doc.lastAutoTable.finalY + 8;
  const tx = 125;

  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text('Subtotal:', tx, fy);
  doc.text(`${invoice.currency} ${invoice.subtotal.toFixed(2)}`, tx + 55, fy, { align: 'right' });

  doc.text('Tax:', tx, fy + 6);
  doc.text(`${invoice.currency} ${(invoice.taxes || 0).toFixed(2)}`, tx + 55, fy + 6, { align: 'right' });

  if (invoice.discount > 0) {
    doc.text('Discount:', tx, fy + 12);
    doc.setTextColor(239, 68, 68);
    doc.text(`-${invoice.currency} ${invoice.discount.toFixed(2)}`, tx + 55, fy + 12, { align: 'right' });
    doc.setTextColor(80, 80, 80);
  }

  const totalY = invoice.discount > 0 ? fy + 18 : fy + 12;
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.5);
  doc.line(tx, totalY - 2, tx + 60, totalY - 2);
  doc.setLineWidth(0.2);

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text('Total:', tx, totalY + 4);
  doc.setTextColor(16, 185, 129);
  doc.text(`${invoice.currency} ${invoice.totalAmount.toFixed(2)}`, tx + 55, totalY + 4, { align: 'right' });

  if (invoice.paidAt) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text('Paid:', tx, totalY + 12);
    doc.setTextColor(16, 185, 129);
    doc.text(`${invoice.currency} ${invoice.totalAmount.toFixed(2)}`, tx + 55, totalY + 12, { align: 'right' });
  }

  // Footer
  const footerY = 275;
  if (invoice.notes) {
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(`Notes: ${invoice.notes}`, 170);
    doc.text(lines, 14, footerY - 16);
  }

  doc.setDrawColor(230, 230, 230);
  doc.line(14, footerY - 2, 196, footerY - 2);
  doc.setFontSize(8);
  doc.setTextColor(160, 160, 160);
  doc.setFont('helvetica', 'normal');
  doc.text('Thank you for your business.', 105, footerY + 3, { align: 'center' });
  doc.text(`Generated on ${new Date().toLocaleString()}`, 105, footerY + 8, { align: 'center' });

  return Buffer.from(doc.output('arraybuffer'));
}

function buildLegacyFolioPdf(folio: {
  folioNumber: string;
  invoiceNumber?: string | null;
  invoiceIssuedAt?: Date | null;
  subtotal: number;
  taxes: number;
  discount: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  currency: string;
  status: string;
  createdAt: Date;
  booking: {
    primaryGuest?: { firstName: string; lastName: string; email?: string; phone?: string } | null;
    room?: { number: string; roomType?: { name: string } | null } | null;
    checkIn?: Date;
    checkOut?: Date;
    property?: { name: string; address: string; city?: string | null; country: string; phone?: string | null; email?: string | null } | null;
  } | null;
  lineItems: Array<{ description: string; quantity: number; unitPrice: number; totalAmount: number }>;
}): Buffer {
  const doc = new jsPDF() as jsPDF & { lastAutoTable: { finalY: number } };
  const guest = folio.booking?.primaryGuest;
  const property = folio.booking?.property;
  const room = folio.booking?.room;

  doc.setFontSize(24);
  doc.setTextColor(16, 185, 129);
  doc.text('INVOICE', 105, 20, { align: 'center' });

  doc.setFontSize(12);
  doc.setTextColor(60, 60, 60);
  doc.text(property?.name || 'StaySuite Hotel', 14, 35);
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  if (property?.address) { doc.text(property.address, 14, 42); doc.text(`${property.city || ''}, ${property.country || ''}`, 14, 48); }
  if (property?.phone) doc.text(`Tel: ${property.phone}`, 14, 54);
  if (property?.email) doc.text(`Email: ${property.email}`, 14, 60);

  const rightCol = 140;
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text('Invoice Number:', rightCol, 35);
  doc.text(folio.invoiceNumber || `INV-${folio.folioNumber}`, rightCol + 35, 35);
  doc.text('Date Issued:', rightCol, 42);
  doc.text(new Date(folio.invoiceIssuedAt || folio.createdAt).toLocaleDateString(), rightCol + 35, 42);
  doc.text('Status:', rightCol, 48);
  doc.setTextColor(folio.status === 'paid' ? 16 : 245, folio.status === 'paid' ? 185 : 158, folio.status === 'paid' ? 129 : 11);
  doc.text(folio.status.toUpperCase(), rightCol + 35, 48);

  doc.setTextColor(60, 60, 60);
  doc.setFontSize(11);
  doc.text('Bill To:', 14, 70);
  doc.setFontSize(10);
  if (guest) {
    doc.text(`${guest.firstName} ${guest.lastName}`, 14, 77);
    if (guest.email) doc.text(guest.email, 14, 83);
    if (guest.phone) doc.text(guest.phone, 14, 89);
  }

  if (folio.booking) {
    doc.text('Stay Details:', 14, 100);
    if (room) doc.text(`Room: ${room.number} (${room.roomType?.name || 'Standard'})`, 14, 107);
    if (folio.booking.checkIn && folio.booking.checkOut) {
      doc.text(`Check-in: ${new Date(folio.booking.checkIn).toLocaleDateString()}`, 14, 113);
      doc.text(`Check-out: ${new Date(folio.booking.checkOut).toLocaleDateString()}`, 14, 119);
    }
  }

  const tableData = folio.lineItems.map(item => [
    item.description,
    item.quantity.toString(),
    `${folio.currency} ${item.unitPrice.toFixed(2)}`,
    `${folio.currency} ${item.totalAmount.toFixed(2)}`,
  ]);

  if (tableData.length === 0) {
    tableData.push([
      `Room Charge - ${room?.roomType?.name || 'Accommodation'}`,
      '1',
      `${folio.currency} ${folio.subtotal.toFixed(2)}`,
      `${folio.currency} ${folio.subtotal.toFixed(2)}`,
    ]);
  }

  autoTable(doc, {
    startY: 130,
    head: [['Description', 'Qty', 'Unit Price', 'Total']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 20, halign: 'center' }, 2: { cellWidth: 35, halign: 'right' }, 3: { cellWidth: 35, halign: 'right' } },
  });

  const finalY = doc.lastAutoTable.finalY + 10;
  const totalsX = 120;
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text('Subtotal:', totalsX, finalY);
  doc.text(`${folio.currency} ${folio.subtotal.toFixed(2)}`, totalsX + 45, finalY, { align: 'right' });
  doc.text('Taxes:', totalsX, finalY + 7);
  doc.text(`${folio.currency} ${folio.taxes.toFixed(2)}`, totalsX + 45, finalY + 7, { align: 'right' });
  if (folio.discount > 0) { doc.text('Discount:', totalsX, finalY + 14); doc.text(`-${folio.currency} ${folio.discount.toFixed(2)}`, totalsX + 45, finalY + 14, { align: 'right' }); }
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Total:', totalsX, finalY + 24);
  doc.setTextColor(16, 185, 129);
  doc.text(`${folio.currency} ${folio.totalAmount.toFixed(2)}`, totalsX + 45, finalY + 24, { align: 'right' });

  if (folio.paidAmount > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text('Amount Paid:', totalsX, finalY + 34);
    doc.text(`${folio.currency} ${folio.paidAmount.toFixed(2)}`, totalsX + 45, finalY + 34, { align: 'right' });
    doc.text('Balance Due:', totalsX, finalY + 41);
    doc.setTextColor(folio.balance > 0 ? 239 : 16, folio.balance > 0 ? 68 : 185, folio.balance > 0 ? 68 : 129);
    doc.text(`${folio.currency} ${folio.balance.toFixed(2)}`, totalsX + 45, finalY + 41, { align: 'right' });
  }

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Thank you for choosing StaySuite. We hope to see you again soon.', 105, 280, { align: 'center' });
  doc.text(`Generated on ${new Date().toLocaleString()}`, 105, 285, { align: 'center' });

  return Buffer.from(doc.output('arraybuffer'));
}
