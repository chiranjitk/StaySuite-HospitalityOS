import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { sendEmail, isEmailConfigured, generateInvoiceEmailHtml } from '@/lib/services/email';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// POST /api/invoices/[id]/send - Send invoice via email
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    if (!hasPermission(user, 'invoices.update') && !hasPermission(user, 'invoices.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { id } = await params;

    const invoice = await db.invoice.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!invoice) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } }, { status: 404 });
    }

    if (!invoice.customerEmail) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Customer email is not set on this invoice' } }, { status: 400 });
    }

    // Check email configuration
    if (!isEmailConfigured()) {
      return NextResponse.json({ success: false, error: { code: 'CONFIG_ERROR', message: 'Email service is not configured. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables.' } }, { status: 500 });
    }

    // Get tenant info for email header
    const tenant = await db.tenant.findUnique({
      where: { id: user.tenantId },
    });

    // Get property info if linked to a folio
    let property = null;
    if (invoice.folioId) {
      const folio = await db.folio.findUnique({
        where: { id: invoice.folioId },
        include: { booking: { include: { property: true } } },
      });
      property = folio?.booking?.property || null;
    }

    // Parse line items
    let lineItems: Array<{ description: string; quantity: number; unitPrice: number; totalAmount: number; taxRate: number; taxAmount: number }> = [];
    try { lineItems = JSON.parse(invoice.lineItems || '[]'); } catch { /* empty */ }

    // Generate PDF attachment
    const pdfBuffer = generateInvoicePdf(invoice, lineItems, tenant, property);

    // Generate email HTML
    const html = generateInvoiceEmailHtml({
      customerName: invoice.customerName,
      invoiceNumber: invoice.invoiceNumber,
      amount: `${invoice.currency} ${invoice.totalAmount.toFixed(2)}`,
      currency: invoice.currency,
      dueDate: invoice.dueAt ? new Date(invoice.dueAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : undefined,
      companyName: property?.name || tenant?.name || 'StaySuite',
      companyAddress: property ? [property.address, property.city, property.country].filter(Boolean).join(', ') : tenant ? [tenant.address, tenant.city, tenant.country].filter(Boolean).join(', ') : undefined,
      companyPhone: property?.phone || tenant?.phone || undefined,
      companyEmail: property?.email || tenant?.email || undefined,
      notes: invoice.notes || undefined,
    });

    // Send email
    const result = await sendEmail({
      to: invoice.customerEmail,
      subject: `Invoice ${invoice.invoiceNumber} - ${property?.name || tenant?.name || 'StaySuite'}`,
      html,
      attachments: [
        {
          filename: `invoice-${invoice.invoiceNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: { code: 'EMAIL_FAILED', message: `Failed to send email: ${result.error}` },
      }, { status: 500 });
    }

    // Update invoice status to sent
    await db.invoice.update({
      where: { id },
      data: {
        status: 'sent',
        issuedAt: invoice.issuedAt || new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Invoice ${invoice.invoiceNumber} sent to ${invoice.customerEmail}`,
      data: { messageId: result.messageId },
    });
  } catch (error) {
    console.error('Error sending invoice email:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to send invoice email' } }, { status: 500 });
  }
}

function generateInvoicePdf(
  invoice: { invoiceNumber: string; customerName: string; customerEmail?: string | null; customerAddress?: string | null; customerPhone?: string | null; subtotal: number; taxes: number; discount: number; totalAmount: number; currency: string; issuedAt?: Date | null; dueAt?: Date | null; paidAt?: Date | null; status: string; notes?: string | null; createdAt: Date },
  lineItems: Array<{ description: string; quantity: number; unitPrice: number; totalAmount: number; taxRate: number; taxAmount: number }>,
  tenant: { name?: string; address?: string | null; city?: string | null; country?: string | null; phone?: string | null; email?: string } | null,
  property: { name: string; address: string; city?: string | null; state?: string | null; country: string; postalCode?: string | null; phone?: string | null; email?: string | null; taxId?: string | null } | null
): Buffer {
  const doc = new jsPDF() as jsPDF & { lastAutoTable: { finalY: number } };
  const companyName = property?.name || tenant?.name || 'StaySuite Hotel';
  const companyAddr = property ? [property.address, property.city, property.state, property.country, property.postalCode].filter(Boolean).join(', ') : tenant ? [tenant.address, tenant.city, tenant.country].filter(Boolean).join(', ') : '';
  const companyPhone = property?.phone || tenant?.phone || '';
  const companyEmail = property?.email || tenant?.email || '';

  // --- Header ---
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

  // Invoice details (right column)
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

  // Status badge
  doc.setTextColor(100, 100, 100);
  doc.text('Status:', rc, 56);
  const statusColors: Record<string, [number, number, number]> = { draft: [150, 150, 150], issued: [6, 182, 212], sent: [6, 182, 212], paid: [16, 185, 129], overdue: [239, 68, 68], cancelled: [120, 120, 120] };
  const sc = statusColors[invoice.status] || [120, 120, 120];
  doc.setTextColor(sc[0], sc[1], sc[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.status.toUpperCase(), rc + 22, 56);
  doc.setFont('helvetica', 'normal');

  // --- Bill To ---
  let yPos = companyAddr && companyPhone && companyEmail ? 68 : 64;
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

  // --- Line Items Table ---
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

  // --- Totals ---
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

  // --- Footer ---
  const footerY = 275;
  doc.setFontSize(8);
  doc.setTextColor(160, 160, 160);
  doc.setFont('helvetica', 'normal');

  if (invoice.notes) {
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(`Notes: ${invoice.notes}`, 170);
    doc.text(lines, 14, footerY - 16);
  }

  doc.setDrawColor(230, 230, 230);
  doc.line(14, footerY - 2, 196, footerY - 2);
  doc.setTextColor(160, 160, 160);
  doc.text('Thank you for your business.', 105, footerY + 3, { align: 'center' });
  doc.text(`Generated on ${new Date().toLocaleString()}`, 105, footerY + 8, { align: 'center' });

  return Buffer.from(doc.output('arraybuffer'));
}
