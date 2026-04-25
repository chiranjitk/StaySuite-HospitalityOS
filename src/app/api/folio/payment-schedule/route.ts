import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET /api/folio/payment-schedule?folioId=xxx - Get payment schedule for a folio
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

    const schedules = await db.paymentSchedule.findMany({
      where: { folioId, tenantId },
      orderBy: { createdAt: 'desc' },
    });

    // Parse installments JSON for each schedule
    const parsedSchedules = schedules.map(schedule => ({
      ...schedule,
      installments: JSON.parse(schedule.installments as string),
    }));

    return NextResponse.json({ success: true, data: parsedSchedules });
  } catch (error) {
    console.error('Error fetching payment schedules:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch payment schedules' } },
      { status: 500 }
    );
  }
}

// POST /api/folio/payment-schedule - Create a payment plan
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
      bookingId,
      guestId,
      scheduleName,
      totalAmount,
      depositAmount,
      depositDueDate,
      installments: rawInstallments,
    } = body;

    if (!folioId || !bookingId || !guestId || !scheduleName || !totalAmount) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: folioId, bookingId, guestId, scheduleName, totalAmount' } },
        { status: 400 }
      );
    }

    // Validate folio
    const folio = await db.folio.findFirst({
      where: { id: folioId, tenantId },
    });

    if (!folio) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Folio not found' } }, { status: 404 });
    }

    if (!rawInstallments || !Array.isArray(rawInstallments) || rawInstallments.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'At least one installment is required' } },
        { status: 400 }
      );
    }

    // Build installments array with status
    const installments = rawInstallments.map((inst: { amount: number; dueDate: string }) => ({
      amount: parseFloat(String(inst.amount)),
      dueDate: inst.dueDate,
      status: 'pending' as const,
      paymentId: null as string | null,
      paidAt: null as string | null,
    }));

    const deposit = depositAmount ? parseFloat(String(depositAmount)) : 0;
    const totalScheduled = installments.reduce((sum: number, i: { amount: number }) => sum + i.amount, 0) + deposit;

    if (Math.abs(totalScheduled - parseFloat(String(totalAmount))) > 0.01) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Installments + deposit must equal totalAmount (${totalAmount}). Current: ${totalScheduled}` } },
        { status: 400 }
      );
    }

    const schedule = await db.paymentSchedule.create({
      data: {
        tenantId,
        propertyId: folio.propertyId,
        folioId,
        bookingId,
        guestId,
        scheduleName,
        totalAmount: parseFloat(String(totalAmount)),
        depositAmount: deposit,
        depositDueDate: depositDueDate ? new Date(depositDueDate) : null,
        installments: JSON.stringify(installments),
        currency: folio.currency,
        status: 'active',
        paidAmount: 0,
        remainingAmount: parseFloat(String(totalAmount)),
      },
    });

    return NextResponse.json({ success: true, data: { ...schedule, installments } }, { status: 201 });
  } catch (error) {
    console.error('Error creating payment schedule:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create payment schedule' } },
      { status: 500 }
    );
  }
}
