import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET /api/folios/[id]/line-items - Get all line items for a folio
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['billing.manage', 'admin.billing', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }
    const tenantId = user.tenantId;


  try {
    const { id } = await params;

    const folio = await db.folio.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });

    if (!folio) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Folio not found' } },
        { status: 404 }
      );
    }

    const lineItems = await db.folioLineItem.findMany({
      where: { folioId: id },
      orderBy: { serviceDate: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: lineItems,
    });
  } catch (error) {
    console.error('Error fetching line items:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch line items' } },
      { status: 500 }
    );
  }
}

// POST /api/folios/[id]/line-items - Add a line item to a folio
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['billing.manage', 'admin.billing', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }
    const tenantId = user.tenantId;


  try {
    const { id } = await params;
    const body = await request.json();

    const {
      description,
      category,
      quantity = 1,
      unitPrice,
      serviceDate,
      referenceType,
      referenceId,
      taxRate = 0,
      postedBy,
    } = body;

    // Validate required fields
    if (!description || !category || unitPrice === undefined) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: description, category, unitPrice' } },
        { status: 400 }
      );
    }

    // Check if folio exists, belongs to tenant, and is open
    const folio = await db.folio.findFirst({
      where: { id, tenantId },
    });

    if (!folio) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Folio not found' } },
        { status: 404 }
      );
    }

    if (folio.status === 'closed') {
      return NextResponse.json(
        { success: false, error: { code: 'FOLIO_CLOSED', message: 'Cannot add line items to a closed folio' } },
        { status: 400 }
      );
    }

    // Calculate totals
    const qty = parseInt(quantity, 10);
    const price = parseFloat(unitPrice);
    const tax = parseFloat(taxRate) || 0;
    const totalAmount = qty * price;
    const taxAmount = totalAmount * (tax / 100);

    // Create line item and update folio totals
    const result = await db.$transaction(async (tx) => {
      const lineItem = await tx.folioLineItem.create({
        data: {
          folioId: id,
          description,
          category,
          quantity: qty,
          unitPrice: price,
          totalAmount,
          serviceDate: serviceDate ? new Date(serviceDate) : new Date(),
          referenceType,
          referenceId,
          taxRate: tax,
          taxAmount,
          postedBy,
        },
      });

      // Update folio totals
      const updatedFolio = await tx.folio.update({
        where: { id },
        data: {
          subtotal: { increment: totalAmount },
          taxes: { increment: taxAmount },
          totalAmount: { increment: totalAmount + taxAmount },
          balance: { increment: totalAmount + taxAmount },
        },
      });

      return { lineItem, folio: updatedFolio };
    });

    return NextResponse.json({
      success: true,
      data: result.lineItem,
      folio: result.folio,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating line item:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create line item' } },
      { status: 500 }
    );
  }
}

// DELETE /api/folios/[id]/line-items - Remove a line item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['billing.manage', 'admin.billing', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }
    const tenantId = user.tenantId;


  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const lineItemId = searchParams.get('lineItemId');

    if (!lineItemId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: lineItemId' } },
        { status: 400 }
      );
    }

    // Check if folio exists, belongs to tenant, and is open
    const folio = await db.folio.findFirst({
      where: { id, tenantId },
    });

    if (!folio) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Folio not found' } },
        { status: 404 }
      );
    }

    if (folio.status === 'closed') {
      return NextResponse.json(
        { success: false, error: { code: 'FOLIO_CLOSED', message: 'Cannot remove line items from a closed folio' } },
        { status: 400 }
      );
    }

    // Get the line item
    const lineItem = await db.folioLineItem.findUnique({
      where: { id: lineItemId, folioId: id },
    });

    if (!lineItem) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Line item not found' } },
        { status: 404 }
      );
    }

    // Delete line item and update folio totals
    const result = await db.$transaction(async (tx) => {
      await tx.folioLineItem.delete({
        where: { id: lineItemId },
      });

      // Update folio totals (subtract the line item amounts)
      const updatedFolio = await tx.folio.update({
        where: { id },
        data: {
          subtotal: { decrement: lineItem.totalAmount },
          taxes: { decrement: lineItem.taxAmount },
          totalAmount: { decrement: lineItem.totalAmount + lineItem.taxAmount },
          balance: { decrement: lineItem.totalAmount + lineItem.taxAmount },
        },
      });

      return { folio: updatedFolio };
    });

    return NextResponse.json({
      success: true,
      folio: result.folio,
      message: 'Line item removed successfully',
    });
  } catch (error) {
    console.error('Error removing line item:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to remove line item' } },
      { status: 500 }
    );
  }
}
