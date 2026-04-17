import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/invoices/[id] - Get single invoice
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    if (!hasPermission(user, 'invoices.view') && !hasPermission(user, 'invoices.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { id } = await params;
    const invoice = await db.invoice.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!invoice) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } }, { status: 404 });
    }

    // Parse line items
    let lineItems = [];
    try {
      lineItems = JSON.parse(invoice.lineItems || '[]');
    } catch { /* empty */ }

    return NextResponse.json({
      success: true,
      data: { ...invoice, lineItems },
    });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch invoice' } }, { status: 500 });
  }
}

// PUT /api/invoices/[id] - Update invoice
export async function PUT(
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
    const body = await request.json();

    const existing = await db.invoice.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } }, { status: 404 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    const allowedFields = ['customerName', 'customerEmail', 'customerAddress', 'customerPhone', 'subtotal', 'taxes', 'discount', 'totalAmount', 'currency', 'dueAt', 'notes', 'lineItems', 'status'];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'lineItems') {
          updateData[field] = typeof body[field] === 'string' ? body[field] : JSON.stringify(body[field]);
        } else {
          updateData[field] = body[field];
        }
      }
    }

    // Handle status transitions
    if (body.status === 'paid' && existing.status !== 'paid') {
      updateData.paidAt = new Date();
    }
    if (body.status === 'sent' && existing.status === 'draft') {
      updateData.issuedAt = new Date();
    }

    const invoice = await db.invoice.update({
      where: { id },
      data: updateData,
    });

    let lineItems = [];
    try {
      lineItems = JSON.parse(invoice.lineItems || '[]');
    } catch { /* empty */ }

    return NextResponse.json({
      success: true,
      data: { ...invoice, lineItems },
    });
  } catch (error) {
    console.error('Error updating invoice:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update invoice' } }, { status: 500 });
  }
}

// DELETE /api/invoices/[id] - Delete invoice
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    if (!hasPermission(user, 'invoices.delete') && !hasPermission(user, 'invoices.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { id } = await params;
    const existing = await db.invoice.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } }, { status: 404 });
    }

    // Don't allow deletion of paid invoices
    if (existing.status === 'paid') {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Cannot delete a paid invoice' } }, { status: 400 });
    }

    await db.invoice.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: 'Invoice deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete invoice' } }, { status: 500 });
  }
}
