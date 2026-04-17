import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/staff/shifts/[id] - Get a single shift
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const shift = await db.staffSchedule.findUnique({
      where: { id, tenantId: user.tenantId },
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

    if (!shift) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Shift not found' } },
        { status: 404 }
      );
    }

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
    });
  } catch (error) {
    console.error('Error fetching shift:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch shift' } },
      { status: 500 }
    );
  }
}

// PUT /api/staff/shifts/[id] - Update a shift
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to update shifts' } },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { startTime, endTime, department, status, notes } = body;

    // Get existing shift with tenant scoping
    const existingShift = await db.staffSchedule.findUnique({
      where: { id, tenantId: user.tenantId },
    });

    if (!existingShift) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Shift not found' } },
        { status: 404 }
      );
    }

    // Validate time format if provided
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    const newStartTime = startTime || existingShift.startTime;
    const newEndTime = endTime || existingShift.endTime;

    if (startTime && !timeRegex.test(startTime)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TIME_FORMAT', message: 'Start time must be in HH:MM format' } },
        { status: 400 }
      );
    }

    if (endTime && !timeRegex.test(endTime)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TIME_FORMAT', message: 'End time must be in HH:MM format' } },
        { status: 400 }
      );
    }

    // Validate start is before end
    if (newStartTime >= newEndTime) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TIME_RANGE', message: 'Start time must be before end time' } },
        { status: 400 }
      );
    }

    // Validate status transitions
    const validStatuses = ['scheduled', 'in_progress', 'completed', 'cancelled'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: `Status must be one of: ${validStatuses.join(', ')}` } },
        { status: 400 }
      );
    }

    // Update the shift
    const shift = await db.staffSchedule.update({
      where: { id },
      data: {
        startTime: newStartTime,
        endTime: newEndTime,
        department,
        status,
        notes,
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
    });
  } catch (error) {
    console.error('Error updating shift:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update shift' } },
      { status: 500 }
    );
  }
}

// DELETE /api/staff/shifts/[id] - Delete a shift
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to delete shifts' } },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Check if shift exists and belongs to user's tenant
    const existingShift = await db.staffSchedule.findUnique({
      where: { id, tenantId: user.tenantId },
    });

    if (!existingShift) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Shift not found' } },
        { status: 404 }
      );
    }

    // Only allow deleting scheduled shifts
    if (existingShift.status === 'in_progress' || existingShift.status === 'completed') {
      return NextResponse.json(
        { success: false, error: { code: 'CANNOT_DELETE', message: 'Cannot delete shifts that are in progress or completed' } },
        { status: 400 }
      );
    }

    await db.staffSchedule.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Shift deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting shift:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete shift' } },
      { status: 500 }
    );
  }
}
