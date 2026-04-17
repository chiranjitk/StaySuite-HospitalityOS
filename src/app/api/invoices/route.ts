import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import crypto from 'crypto';

// Generate invoice number
function generateInvoiceNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const random = crypto.randomBytes(4).toString('hex').slice(0, 4);
  return `INV-${year}${month}-${random}`;
}

// GET /api/invoices - List invoices
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    // RBAC check
    if (!hasPermission(user, 'invoices.view') && !hasPermission(user, 'invoices.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const folioId = searchParams.get('folioId');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
    };

    if (folioId) {
      where.folioId = folioId;
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search } },
        { customerName: { contains: search } },
        { customerEmail: { contains: search } },
      ];
    }

    const invoices = await db.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...(limit ? { take: parseInt(limit, 10) } : {}),
      ...(offset ? { skip: parseInt(offset, 10) } : {}),
    });

    const total = await db.invoice.count({ where });

    // Parse line items for each invoice
    const invoicesWithItems = invoices.map(inv => {
      let lineItems = [];
      try { lineItems = JSON.parse(inv.lineItems || '[]'); } catch { /* empty */ }
      return { ...inv, lineItems };
    });

    // Calculate stats
    const allInvoices = await db.invoice.findMany({
      where: { tenantId: user.tenantId },
      select: { status: true, totalAmount: true, taxes: true, subtotal: true },
    });

    const stats = {
      total: allInvoices.length,
      draft: allInvoices.filter(i => i.status === 'draft').length,
      issued: allInvoices.filter(i => i.status === 'issued' || i.status === 'sent').length,
      paid: allInvoices.filter(i => i.status === 'paid').length,
      overdue: allInvoices.filter(i => i.status === 'overdue').length,
      cancelled: allInvoices.filter(i => i.status === 'cancelled').length,
      totalAmount: allInvoices.reduce((sum, i) => sum + i.totalAmount, 0),
      paidAmount: allInvoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.totalAmount, 0),
      outstandingAmount: allInvoices.filter(i => !['paid', 'cancelled'].includes(i.status)).reduce((sum, i) => sum + i.totalAmount, 0),
      totalTax: allInvoices.reduce((sum, i) => sum + (i.taxes || 0), 0),
    };

    return NextResponse.json({
      success: true,
      data: invoicesWithItems,
      stats,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch invoices' } },
      { status: 500 }
    );
  }
}

// POST /api/invoices - Create invoice (from folio or standalone)
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    if (!hasPermission(user, 'invoices.create') && !hasPermission(user, 'invoices.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const body = await request.json();
    const { folioId, customerName, customerEmail, customerAddress, customerPhone, subtotal, taxes, discount, totalAmount, currency, dueAt, notes, lineItems, status } = body;

    // If folioId provided, create from folio
    if (folioId) {
      const folio = await db.folio.findUnique({
        where: { id: folioId },
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
        return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Folio not found' } }, { status: 404 });
      }

      if (folio.tenantId !== user.tenantId) {
        return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Folio not found for this tenant' } }, { status: 403 });
      }

      const existingInvoice = await db.invoice.findFirst({ where: { folioId } });
      if (existingInvoice) {
        return NextResponse.json({ success: false, error: { code: 'INVOICE_EXISTS', message: 'An invoice already exists for this folio' } }, { status: 400 });
      }

      const invoiceNumber = generateInvoiceNumber();
      const guest = folio.booking?.primaryGuest;
      const property = folio.booking?.property;

      // Build line items from folio
      const folioLineItems = folio.lineItems.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalAmount: item.totalAmount,
        taxRate: item.taxRate,
        taxAmount: item.taxAmount,
      }));

      // Add room charge if no line items
      if (folioLineItems.length === 0) {
        const roomCharge = folio.subtotal > 0 ? folio.subtotal : folio.totalAmount;
        folioLineItems.push({
          description: `Room Charge - ${folio.booking?.room?.roomType?.name || 'Accommodation'} (${folio.folioNumber})`,
          quantity: 1,
          unitPrice: roomCharge,
          totalAmount: roomCharge,
          taxRate: 0,
          taxAmount: folio.taxes || 0,
        });
      }

      const invoice = await db.invoice.create({
        data: {
          tenantId: user.tenantId,
          invoiceNumber,
          folioId: folio.id,
          customerName: customerName || (guest ? `${guest.firstName} ${guest.lastName}` : 'Guest'),
          customerEmail: customerEmail || guest?.email,
          customerAddress: customerAddress || (guest ? [guest.address, guest.city, guest.country].filter(Boolean).join(', ') : undefined),
          customerPhone: customerPhone || guest?.phone || undefined,
          subtotal: subtotal ?? folio.subtotal,
          taxes: taxes ?? folio.taxes,
          discount: discount ?? folio.discount ?? 0,
          totalAmount: totalAmount ?? folio.totalAmount,
          currency: currency || folio.currency,
          issuedAt: new Date(),
          dueAt: dueAt ? new Date(dueAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: status || 'issued',
          pdfUrl: `/api/invoices/${folio.id}/pdf`,
          notes: notes || undefined,
          lineItems: JSON.stringify(folioLineItems),
        },
      });

      // Update folio with invoice info
      try {
        await db.folio.update({
          where: { id: folioId },
          data: { invoiceNumber, invoiceIssuedAt: new Date() },
        });
      } catch { /* non-blocking */ }

      return NextResponse.json({ success: true, data: { ...invoice, lineItems: folioLineItems }, message: 'Invoice created from folio' }, { status: 201 });
    }

    // Standalone invoice creation
    if (!customerName) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Customer name is required' } }, { status: 400 });
    }

    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'At least one line item is required' } }, { status: 400 });
    }

    const invoiceNumber = generateInvoiceNumber();
    const calculatedSubtotal = lineItems.reduce((sum: number, item: { totalAmount: number }) => sum + item.totalAmount, 0);
    const calculatedTaxes = lineItems.reduce((sum: number, item: { taxAmount: number }) => sum + (item.taxAmount || 0), 0);
    const calculatedTotal = subtotal ?? (calculatedSubtotal + calculatedTaxes - (discount || 0));

    const invoice = await db.invoice.create({
      data: {
        tenantId: user.tenantId,
        invoiceNumber,
        customerName,
        customerEmail: customerEmail || null,
        customerAddress: customerAddress || null,
        customerPhone: customerPhone || null,
        subtotal: subtotal ?? calculatedSubtotal,
        taxes: taxes ?? calculatedTaxes,
        discount: discount || 0,
        totalAmount: totalAmount ?? calculatedTotal,
        currency: currency || 'USD',
        issuedAt: status === 'issued' || status === 'sent' ? new Date() : undefined,
        dueAt: dueAt ? new Date(dueAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: status || 'draft',
        notes: notes || null,
        lineItems: JSON.stringify(lineItems),
      },
    });

    return NextResponse.json({ success: true, data: { ...invoice, lineItems }, message: 'Invoice created successfully' }, { status: 201 });
  } catch (error) {
    console.error('Error creating invoice:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create invoice' } }, { status: 500 });
  }
}
