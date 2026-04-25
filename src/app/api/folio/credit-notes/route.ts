import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET /api/folio/credit-notes?folioId=xxx - List credit notes for a folio
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['billing.manage', 'billing.view', 'admin.billing', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }
    const tenantId = user.tenantId;

    const searchParams = request.nextUrl.searchParams;
    const folioId = searchParams.get('folioId');

    if (!folioId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'folioId is required' } },
        { status: 400 }
      );
    }

    const folio = await db.folio.findFirst({
      where: { id: folioId, tenantId },
      select: { id: true },
    });

    if (!folio) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Folio not found' } }, { status: 404 });
    }

    const creditNotes = await db.creditNote.findMany({
      where: { folioId, tenantId },
      orderBy: { createdAt: 'desc' },
    });

    const parsedNotes = creditNotes.map(note => ({
      ...note,
      items: JSON.parse(note.items as string),
    }));

    return NextResponse.json({ success: true, data: parsedNotes });
  } catch (error) {
    console.error('Error fetching credit notes:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch credit notes' } },
      { status: 500 }
    );
  }
}

// POST /api/folio/credit-notes - Create a credit note
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['billing.manage', 'admin.billing', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }
    const tenantId = user.tenantId;

    const body = await request.json();
    const {
      folioId,
      guestId,
      bookingId,
      reason,
      description,
      items: rawItems,
      currency,
    } = body;

    if (!folioId || !guestId || !reason || !rawItems || !Array.isArray(rawItems) || rawItems.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: folioId, guestId, reason, items' } },
        { status: 400 }
      );
    }

    const validReasons = ['refund', 'discount', 'correction', 'service_recovery'];
    if (!validReasons.includes(reason)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid reason. Must be one of: ${validReasons.join(', ')}` } },
        { status: 400 }
      );
    }

    const folio = await db.folio.findFirst({
      where: { id: folioId, tenantId },
    });

    if (!folio) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Folio not found' } }, { status: 404 });
    }

    // Validate items and calculate totals
    const items = rawItems.map((item: { description: string; amount: number; folioLineItemId?: string }) => ({
      description: item.description,
      amount: parseFloat(String(item.amount)),
      folioLineItemId: item.folioLineItemId || null,
    }));

    if (items.some(item => item.amount <= 0)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'All item amounts must be positive' } },
        { status: 400 }
      );
    }

    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const totalAmount = subtotal;

    // Generate credit note number
    const today = new Date();
    const dateStr = formatGenerateDate(today);
    const count = await db.creditNote.count({
      where: {
        tenantId,
        createdAt: {
          gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        },
      },
    });
    const seq = String(count + 1).padStart(4, '0');
    const creditNoteNumber = `CN-${dateStr}-${seq}`;

    const creditNote = await db.$transaction(async (tx) => {
      const note = await tx.creditNote.create({
        data: {
          tenantId,
          propertyId: folio.propertyId,
          folioId,
          creditNoteNumber,
          guestId,
          bookingId: bookingId || null,
          reason,
          description: description || null,
          items: JSON.stringify(items),
          subtotal,
          taxAmount: 0,
          totalAmount,
          currency: currency || folio.currency,
          status: 'issued',
          appliedAmount: 0,
          remainingAmount: totalAmount,
          issuedBy: user.id,
        },
      });

      return note;
    });

    return NextResponse.json({
      success: true,
      data: { ...creditNote, items },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating credit note:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create credit note' } },
      { status: 500 }
    );
  }
}

function formatGenerateDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}
