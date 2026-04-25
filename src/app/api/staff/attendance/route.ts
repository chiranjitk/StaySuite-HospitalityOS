import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// Default shift configuration (fallback if not configured)
const DEFAULT_SHIFT_START = '09:00';
const DEFAULT_SHIFT_END = '17:00';
const DEFAULT_GRACE_MINUTES = 15;

// Helper function to get shift configuration for a tenant
async function getShiftConfig(tenantId: string): Promise<{
  shiftStart: string;
  shiftEnd: string;
  graceMinutes: number;
}> {
  try {
    // Try to get the default shift template
    const defaultShift = await db.shiftTemplate.findFirst({
      where: {
        tenantId,
        isActive: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (defaultShift) {
      return {
        shiftStart: defaultShift.startTime,
        shiftEnd: defaultShift.endTime,
        graceMinutes: 15, // Default grace period
      };
    }

    // Try to get from tenant settings
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    if (tenant?.settings) {
      try {
        const settings = JSON.parse(tenant.settings);
        if (settings.shiftConfig) {
          return {
            shiftStart: settings.shiftConfig.defaultShiftStart || DEFAULT_SHIFT_START,
            shiftEnd: settings.shiftConfig.defaultShiftEnd || DEFAULT_SHIFT_END,
            graceMinutes: settings.shiftConfig.graceMinutesLate || DEFAULT_GRACE_MINUTES,
          };
        }
      } catch {
        // Use defaults if parsing fails
      }
    }
  } catch (error) {
    console.error('Error loading shift config:', error);
  }

  // Return defaults
  return {
    shiftStart: DEFAULT_SHIFT_START,
    shiftEnd: DEFAULT_SHIFT_END,
    graceMinutes: DEFAULT_GRACE_MINUTES,
  };
}

// GET /api/staff/attendance - Get attendance records
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
    if (!hasPermission(user, 'staff.view') && !hasPermission(user, 'attendance.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view attendance' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const staffId = searchParams.get('staffId');
    const department = searchParams.get('department');
    const limit = searchParams.get('limit');

    const tenantId = user.tenantId;

    // Build where clause with tenant scoping
    const where: Record<string, unknown> = { tenantId };

    if (startDate) {
      where.date = { ...((where.date as Record<string, unknown>) || {}), gte: new Date(startDate) };
    }
    if (endDate) {
      where.date = { ...((where.date as Record<string, unknown>) || {}), lte: new Date(endDate) };
    }
    if (staffId) {
      where.userId = staffId;
    }

    // Get attendance records
    const records = await db.staffAttendance.findMany({
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
          },
        },
      },
      orderBy: { date: 'desc' },
      ...(limit && { take: Math.min(parseInt(limit, 10), 100) }),
    });

    // Filter by department if specified
    const filteredRecords = department
      ? records.filter(r => r.user.department === department)
      : records;

    // Get all staff for stats
    const staff = await db.user.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(department && department !== 'all' ? { department } : {}),
      },
      select: { id: true },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayString = today.toISOString().split('T')[0];
    const todayRecords = filteredRecords.filter(r => {
      const recordDate = new Date(r.date);
      recordDate.setHours(0, 0, 0, 0);
      return recordDate.toISOString().split('T')[0] === todayString;
    });

    // Calculate actual attendance rate from historical data
    const presentRecords = filteredRecords.filter(r => r.status === 'present' || r.status === 'late');
    const avgAttendanceRate = filteredRecords.length > 0
      ? Math.round((presentRecords.length / filteredRecords.length) * 100)
      : 100;

    // Calculate stats
    const stats = {
      totalStaff: staff.length,
      presentToday: todayRecords.filter(r => r.status === 'present').length,
      absentToday: todayRecords.filter(r => r.status === 'absent').length,
      lateToday: todayRecords.filter(r => r.status === 'late').length,
      avgAttendanceRate,
    };

    return NextResponse.json({
      success: true,
      records: filteredRecords,
      stats,
    });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch attendance' } },
      { status: 500 }
    );
  }
}

// POST /api/staff/attendance - Clock in/out
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

    // Permission check - users can clock in/out for themselves, or managers for others
    const body = await request.json();
    const { staffId, type, notes } = body;

    // Determine target staff ID
    const targetStaffId = staffId || user.id;

    // If clocking in/out for someone else, need staff.manage permission
    if (targetStaffId !== user.id && !hasPermission(user, 'staff.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to manage attendance for others' } },
        { status: 403 }
      );
    }

    // Verify the staff user exists and belongs to the same tenant
    const staffUser = await db.user.findUnique({
      where: { id: targetStaffId, tenantId: user.tenantId, deletedAt: null },
    });

    if (!staffUser) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_USER', message: 'Staff member not found or does not belong to your tenant' } },
        { status: 400 }
      );
    }

    // Validate type
    if (!type || !['clock_in', 'clock_out'].includes(type)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Type must be either "clock_in" or "clock_out"' } },
        { status: 400 }
      );
    }

    const tenantId = user.tenantId;

    // Get shift configuration
    const shiftConfig = await getShiftConfig(tenantId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find existing record for today
    let record = await db.staffAttendance.findUnique({
      where: {
        userId_date: {
          userId: targetStaffId,
          date: today,
        },
      },
    });

    const now = new Date();

    if (type === 'clock_in') {
      // Parse shift start time from configuration
      const [startHours, startMinutes] = shiftConfig.shiftStart.split(':').map(Number);
      const shiftStart = new Date(today);
      shiftStart.setHours(startHours, startMinutes, 0, 0);

      // Calculate late minutes (accounting for grace period)
      const effectiveLateTime = new Date(shiftStart.getTime() + shiftConfig.graceMinutes * 60 * 1000);
      const isLate = now > effectiveLateTime;
      const lateMinutes = isLate
        ? Math.floor((now.getTime() - shiftStart.getTime()) / (1000 * 60))
        : 0;

      if (record) {
        // Update existing record
        record = await db.staffAttendance.update({
          where: { id: record.id },
          data: {
            checkIn: now,
            status: isLate ? 'late' : 'present',
            lateMinutes: Math.max(0, lateMinutes - shiftConfig.graceMinutes),
            notes,
          },
        });
      } else {
        // Create new record
        record = await db.staffAttendance.create({
          data: {
            tenantId,
            userId: targetStaffId,
            date: today,
            checkIn: now,
            status: isLate ? 'late' : 'present',
            lateMinutes: Math.max(0, lateMinutes - shiftConfig.graceMinutes),
            notes,
          },
        });
      }
    } else if (type === 'clock_out') {
      if (!record || !record.checkIn) {
        return NextResponse.json(
          { success: false, error: { code: 'NO_CHECKIN', message: 'No check-in record found' } },
          { status: 400 }
        );
      }

      // Parse shift end time from configuration
      const [endHours, endMinutes] = shiftConfig.shiftEnd.split(':').map(Number);
      const shiftEnd = new Date(today);
      shiftEnd.setHours(endHours, endMinutes, 0, 0);

      // Calculate early leave minutes (accounting for grace period)
      const effectiveEndTime = new Date(shiftEnd.getTime() - shiftConfig.graceMinutes * 60 * 1000);
      const isEarly = now < effectiveEndTime;
      const earlyLeaveMinutes = isEarly
        ? Math.floor((shiftEnd.getTime() - now.getTime()) / (1000 * 60))
        : 0;

      record = await db.staffAttendance.update({
        where: { id: record.id },
        data: {
          checkOut: now,
          earlyLeaveMinutes: Math.max(0, earlyLeaveMinutes - shiftConfig.graceMinutes),
          notes: notes || record.notes,
        },
      });
    }

    return NextResponse.json({
      success: true,
      record,
    });
  } catch (error) {
    console.error('Error recording attendance:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to record attendance' } },
      { status: 500 }
    );
  }
}
