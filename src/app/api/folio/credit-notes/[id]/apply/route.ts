import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// POST /api/folio/credit-notes/[id]/apply - Apply credit note to folio
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['billing.manage', 'admin.billing', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }
    const tenantId = user.tenantId;

    const { id } = await params;

    const creditNote = await db.creditNote.findFirst({
      where: { id, tenantId },
    });

    if (!creditNote) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Credit note not found' } }, { status: 404 });
    }

    if (creditNote.status === 'cancelled' || creditNote.status === 'expired') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: `Cannot apply a ${creditNote.status} credit note` } },
        { status: 400 }
      );
    }

    const result = await db.$transaction(async (tx) => {
      const applyAmount = creditNote.remainingAmount;

      // Create credit line item on folio
      await tx.folioLineItem.create({
        data: {
          folioId: creditNote.folioId,
          description: `Credit Note ${creditNote.creditNoteNumber}: ${creditNote.reason}`,
          category: 'discount',
          quantity: 1,
          unitPrice: -applyAmount,
          totalAmount: -applyAmount,
          taxRate: 0,
          taxAmount: 0,
          serviceDate: new Date(),
          postedBy: user.id,
        },
      });

      // Update folio balance
      const updatedFolio = await tx.folio.update({
        where: { id: creditNote.folioId },
        data: {
          totalAmount: { decrement: applyAmount },
          balance: { decrement: applyAmount },
        },
      });

      // Update credit note
      let newStatus: string;
      let appliedAmount: number;
      let remainingAmount: number;

      if (creditNote.status === 'issued') {
        // First time applying
        appliedAmount = applyAmount;
        remainingAmount = 0;
        newStatus = 'applied';
      } else {
        // Partially applied - apply remaining
        appliedAmount = creditNote.appliedAmount + applyAmount;
        remainingAmount = 0;
        newStatus = 'applied';
      }

      const updatedNote = await tx.creditNote.update({
        where: { id },
        data: {
          status: newStatus,
          appliedAmount,
          remainingAmount,
          approvedBy: user.id,
          approvedAt: new Date(),
        },
      });

      return { creditNote: updatedNote, folio: updatedFolio };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error applying credit note:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to apply credit note' } },
      { status: 500 }
    );
  }
}
