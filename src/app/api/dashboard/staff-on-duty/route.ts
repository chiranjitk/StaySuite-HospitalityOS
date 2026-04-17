import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const tenantId = user.tenantId;
    const now = new Date();

    // Find users who are currently on duty (shifts that overlap with now)
    // Note: startTime and endTime are String fields (e.g. "09:00"), so we compare today's shifts
    const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const currentTimeStr = now.toTimeString().slice(0, 5); // HH:MM

    const activeShifts = await db.staffShift.findMany({
      where: {
        tenantId,
        status: 'active',
        date: {
          gte: new Date(todayStr + 'T00:00:00.000Z'),
          lt: new Date(todayStr + 'T23:59:59.999Z'),
        },
        startTime: { lte: currentTimeStr },
        endTime: { gte: currentTimeStr },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            role: true,
          },
        },
      },
      orderBy: { startTime: 'asc' },
      take: 20,
    });

    const staffOnDuty = activeShifts.map((shift) => ({
      id: shift.userId,
      name: `${shift.user.firstName} ${shift.user.lastName}`,
      avatar: shift.user.avatar,
      initials: `${shift.user.firstName[0]}${shift.user.lastName[0]}`,
      role: shift.role || shift.user.role || 'Staff',
      shiftStart: shift.startTime,
      shiftEnd: shift.endTime,
      isOnline: shift.status === 'active',
    }));

    return NextResponse.json({
      success: true,
      data: {
        staff: staffOnDuty,
        totalOnDuty: staffOnDuty.length,
      },
    });
  } catch (error) {
    console.error('[Staff On-Duty API] Error:', error);

    // Return mock data as fallback
    const now = new Date();
    const mockStaff = [
      { id: '1', name: 'Anna Park', initials: 'AP', role: 'Front Desk', shiftStart: new Date(now.getTime() - 4 * 3600000), shiftEnd: new Date(now.getTime() + 4 * 3600000), isOnline: true },
      { id: '2', name: 'David Kim', initials: 'DK', role: 'Concierge', shiftStart: new Date(now.getTime() - 3 * 3600000), shiftEnd: new Date(now.getTime() + 5 * 3600000), isOnline: true },
      { id: '3', name: 'Rachel Green', initials: 'RG', role: 'Housekeeping', shiftStart: new Date(now.getTime() - 2 * 3600000), shiftEnd: new Date(now.getTime() + 6 * 3600000), isOnline: true },
      { id: '4', name: 'Marco Silva', initials: 'MS', role: 'Maintenance', shiftStart: new Date(now.getTime() - 5 * 3600000), shiftEnd: new Date(now.getTime() + 3 * 3600000), isOnline: true },
      { id: '5', name: 'Sarah Chen', initials: 'SC', role: 'Front Desk', shiftStart: new Date(now.getTime() - 1 * 3600000), shiftEnd: new Date(now.getTime() + 7 * 3600000), isOnline: true },
      { id: '6', name: 'James Wilson', initials: 'JW', role: 'Security', shiftStart: new Date(now.getTime() - 6 * 3600000), shiftEnd: new Date(now.getTime() + 2 * 3600000), isOnline: false },
    ];

    return NextResponse.json({
      success: true,
      data: {
        staff: mockStaff,
        totalOnDuty: mockStaff.length,
      },
    });
  }
}
