import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// POST /api/folio/payment-schedule/[id]/mark-paid - Mark an installment as paid
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
    const body = await request.json();
    const { installmentIndex, paymentId, method } = body;

    if (installmentIndex === undefined || installmentIndex === null) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'installmentIndex is required' } },
        { status: 400 }
      );
    }

    // Validate schedule exists and belongs to tenant
    const schedule = await db.paymentSchedule.findFirst({
      where: { id, tenantId },
    });

    if (!schedule) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Payment schedule not found' } }, { status: 404 });
    }

    if (schedule.status === 'completed' || schedule.status === 'cancelled') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: `Cannot modify a ${schedule.status} schedule` } },
        { status: 400 }
      );
    }

    const installments = JSON.parse(schedule.installments as string) as Array<{
      amount: number;
      dueDate: string;
      status: string;
      paymentId: string | null;
      paidAt: string | null;
    }>;

    if (installmentIndex < 0 || installmentIndex >= installments.length) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid installment index' } },
        { status: 400 }
      );
    }

    if (installments[installmentIndex].status === 'paid') {
      return NextResponse.json(
        { success: false, error: { code: 'ALREADY_PAID', message: 'This installment is already paid' } },
        { status: 400 }
      );
    }

    // Mark installment as paid
    installments[installmentIndex].status = 'paid';
    installments[installmentIndex].paymentId = paymentId || `pay-${Date.now()}`;
    installments[installmentIndex].paidAt = new Date().toISOString();

    // Recalculate paidAmount and remainingAmount
    let paidAmount = schedule.depositAmount > 0 ? schedule.depositAmount : 0;
    // Check if deposit has been paid (if there's a deposit entry treated specially, we include it)
    for (const inst of installments) {
      if (inst.status === 'paid') {
        paidAmount += inst.amount;
      }
    }
    const remainingAmount = schedule.totalAmount - paidAmount;

    // Determine new status
    let newStatus = schedule.status;
    if (remainingAmount <= 0.01) {
      newStatus = 'completed';
    } else {
      // Check if any installments are overdue
      const now = new Date();
      const hasOverdue = installments.some(
        inst => inst.status === 'pending' && new Date(inst.dueDate) < now
      );
      if (hasOverdue) {
        newStatus = 'overdue';
      } else {
        newStatus = 'active';
      }
    }

    const result = await db.$transaction(async (tx) => {
      const updatedSchedule = await tx.paymentSchedule.update({
        where: { id },
        data: {
          installments: JSON.stringify(installments),
          paidAmount,
          remainingAmount: Math.max(0, remainingAmount),
          status: newStatus,
        },
      });

      // Also update the folio's paidAmount if needed
      await tx.folio.update({
        where: { id: schedule.folioId },
        data: {
          paidAmount: { increment: installments[installmentIndex].amount },
          balance: { decrement: installments[installmentIndex].amount },
        },
      });

      return updatedSchedule;
    });

    return NextResponse.json({
      success: true,
      data: { ...result, installments },
    });
  } catch (error) {
    console.error('Error marking installment as paid:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to mark installment as paid' } },
      { status: 500 }
    );
  }
}
