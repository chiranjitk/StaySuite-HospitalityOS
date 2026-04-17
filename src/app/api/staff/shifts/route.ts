import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/staff/shifts - Get shifts for a date
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'staff.view') && !hasPermission(user, 'schedules.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view shifts' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date');
    const staffId = searchParams.get('staffId');
    const department = searchParams.get('department');
    const status = searchParams.get('status');
    const limit = searchParams.get('limit');

    // Build where clause with tenant scoping
    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (date) {
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      where.date = { gte: targetDate, lt: nextDay };
    }

    if (staffId) where.userId = staffId;
    if (department) where.department = department;
    if (status) where.status = status;

    const shifts = await db.staffSchedule.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            department: true,
            jobTitle: true,
            status: true,
          },
        },
      },
      orderBy: { startTime: 'asc' },
      ...(limit && { take: Math.min(parseInt(limit, 10), 100) }),
    });

    // Format response
    const formattedShifts = shifts.map(shift => ({
      id: shift.id,
      staffId: shift.userId,
      date: shift.date.toISOString().split('T')[0],
      startTime: shift.startTime,
      endTime: shift.endTime,
      department: shift.department || shift.user.department,
      status: shift.status,
      notes: shift.notes,
      staff: {
        id: shift.user.id,
        firstName: shift.user.firstName,
        lastName: shift.user.lastName,
        email: shift.user.email,
        department: shift.user.department,
        jobTitle: shift.user.jobTitle,
        status: shift.user.status,
      },
    }));

    // Calculate stats
    const stats = {
      total: shifts.length,
      scheduled: shifts.filter(s => s.status === 'scheduled').length,
      inProgress: shifts.filter(s => s.status === 'in_progress').length,
      completed: shifts.filter(s => s.status === 'completed').length,
      cancelled: shifts.filter(s => s.status === 'cancelled').length,
    };

    return NextResponse.json({
      success: true,
      shifts: formattedShifts,
      stats,
    });
  } catch (error) {
    console.error('Error fetching shifts:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch shifts' } },
      { status: 500 }
    );
  }
}

// POST /api/staff/shifts - Create a new shift
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'staff.manage') && !hasPermission(user, 'schedules.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to create shifts' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      staffId,
      date,
      startTime,
      endTime,
      department,
      notes,
      shiftTemplateId,
      propertyId,
    } = body;

    // Validate required fields
    if (!staffId || !date || !startTime || !endTime) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Staff ID, date, start time, and end time are required' } },
        { status: 400 }
      );
    }

    // Validate time format
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TIME_FORMAT', message: 'Time must be in HH:MM format' } },
        { status: 400 }
      );
    }

    // Validate start is before end
    if (startTime >= endTime) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TIME_RANGE', message: 'Start time must be before end time' } },
        { status: 400 }
      );
    }

    // Verify the staff user exists and belongs to the same tenant
    const staffUser = await db.user.findUnique({
      where: { id: staffId, tenantId: user.tenantId, deletedAt: null },
    });

    if (!staffUser) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_USER', message: 'Staff member not found or does not belong to your tenant' } },
        { status: 400 }
      );
    }

    // Parse date and set to midnight
    const shiftDate = new Date(date);
    shiftDate.setHours(0, 0, 0, 0);

    // Check for existing shift on the same date
    const existingShift = await db.staffSchedule.findUnique({
      where: {
        userId_date: {
          userId: staffId,
          date: shiftDate,
        },
      },
    });

    if (existingShift) {
      return NextResponse.json(
        { success: false, error: { code: 'SHIFT_EXISTS', message: 'A shift already exists for this staff member on this date' } },
        { status: 400 }
      );
    }

    // Create the shift
    const shift = await db.staffSchedule.create({
      data: {
        tenantId: user.tenantId,
        userId: staffId,
        date: shiftDate,
        startTime,
        endTime,
        department: department || staffUser.department,
        notes,
        shiftTemplateId,
        propertyId,
        assignedBy: user.id,
        status: 'scheduled',
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            department: true,
            jobTitle: true,
            status: true,
          },
        },
      },
    });

    // Format response
    const formattedShift = {
      id: shift.id,
      staffId: shift.userId,
      date: shift.date.toISOString().split('T')[0],
      startTime: shift.startTime,
      endTime: shift.endTime,
      department: shift.department,
      status: shift.status,
      notes: shift.notes,
      staff: {
        id: shift.user.id,
        firstName: shift.user.firstName,
        lastName: shift.user.lastName,
        email: shift.user.email,
        department: shift.user.department,
        jobTitle: shift.user.jobTitle,
        status: shift.user.status,
      },
    };

    return NextResponse.json({
      success: true,
      shift: formattedShift,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating shift:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create shift' } },
      { status: 500 }
    );
  }
}
