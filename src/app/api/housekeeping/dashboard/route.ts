import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

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
    if (!hasPermission(user, 'housekeeping.view') && !hasPermission(user, 'tasks.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;

    // Optional propertyId filter from query params
    const queryPropertyId = request.nextUrl.searchParams.get('propertyId');

    // Date boundaries for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const propertyWhere: Record<string, unknown> = { tenantId: user.tenantId };

    // Get properties for this tenant (optionally filtered by propertyId query param)
    if (queryPropertyId) {
      propertyWhere.id = queryPropertyId;
    }
    const properties = await db.property.findMany({
      where: propertyWhere,
      select: { id: true },
    });
    const propertyIds = properties.map(p => p.id);

    if (propertyIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          roomsToClean: 0,
          roomsInProgress: 0,
          roomsInspected: 0,
          maintenanceRequests: 0,
          taskBreakdown: { checkout: 0, stayover: 0, touchup: 0 },
          recentTasks: [],
        },
      });
    }

    // Room counts by status for housekeeping
    const roomsToClean = await db.room.count({
      where: {
        propertyId: { in: propertyIds },
        status: 'dirty',

      },
    });

    const roomsInProgress = await db.room.count({
      where: {
        propertyId: { in: propertyIds },
        status: 'cleaning',

      },
    });

    const roomsInspected = await db.room.count({
      where: {
        propertyId: { in: propertyIds },
        status: 'inspected',

      },
    });

    // Maintenance requests: tasks with category maintenance that are pending or in_progress
    const maintenanceRequests = await db.task.count({
      where: {
        propertyId: { in: propertyIds },
        category: 'maintenance',
        status: { in: ['pending', 'in_progress'] },

      },
    });

    // Task breakdown by cleaning type (exact match)
    const [checkoutTasks, stayoverTasks, touchupTasks] = await Promise.all([
      db.task.count({
        where: {
          propertyId: { in: propertyIds },
          type: 'checkout',
          status: { in: ['pending', 'in_progress'] },
  
        },
      }),
      db.task.count({
        where: {
          propertyId: { in: propertyIds },
          type: 'stayover',
          status: { in: ['pending', 'in_progress'] },
  
        },
      }),
      db.task.count({
        where: {
          propertyId: { in: propertyIds },
          type: 'touchup',
          status: { in: ['pending', 'in_progress'] },
  
        },
      }),
    ]);

    // Recent tasks with room and assignee info
    const recentTasks = await db.task.findMany({
      where: {
        propertyId: { in: propertyIds },
        category: { in: ['cleaning', 'housekeeping'] },

      },
      include: {
        room: { select: { number: true } },
        assignee: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Map to component's expected shape
    const recentTasksMapped = recentTasks.map(t => ({
      id: t.id,
      roomNumber: t.room?.number || '',
      type: formatTaskType(t.type),
      status: t.status,
      assignedTo: t.assignee
        ? `${t.assignee.firstName} ${t.assignee.lastName}`
        : 'Unassigned',
      priority: t.priority,
    }));

    return NextResponse.json({
      success: true,
      data: {
        roomsToClean,
        roomsInProgress,
        roomsInspected,
        maintenanceRequests,
        taskBreakdown: {
          checkout: checkoutTasks,
          stayover: stayoverTasks,
          touchup: touchupTasks,
        },
        recentTasks: recentTasksMapped,
      },
    });
  } catch (error) {
    console.error('Housekeeping Dashboard API error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch housekeeping dashboard data' } },
      { status: 500 }
    );
  }
}

/** Convert raw task type (e.g. "checkout_clean") to a display label (e.g. "Checkout Clean") */
function formatTaskType(type: string): string {
  return type
    .split(/[_-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
