import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'dashboard.view');
  if (user instanceof NextResponse) return user;

  try {
    const tenantId = user.tenantId;
    const properties = await db.property.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true },
    });
    const propertyIds = properties.map(p => p.id);

    if (propertyIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          totalTasks: 0,
          lastUpdated: new Date().toISOString(),
          summary: { pending: 0, inProgress: 0, completed: 0, overdue: 0 },
          tasks: [],
          hasData: false,
        },
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fetch real maintenance tasks from service requests
    // ServiceRequest model fields: id, tenantId, propertyId, guestId?, roomId?, type, category?,
    // subject, description?, priority, assignedTo?, status, source, requestedAt, startedAt?, completedAt?
    // Relations: assignee -> User
    const maintenanceRequests = await db.serviceRequest.findMany({
      where: {
        propertyId: { in: propertyIds },
        category: 'maintenance',
      },
      include: {
        assignee: { select: { firstName: true, lastName: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Fetch room numbers for requests that have a roomId
    const roomIds = [...new Set(maintenanceRequests.map(sr => sr.roomId).filter(Boolean) as string[])];
    const rooms = roomIds.length > 0
      ? await db.room.findMany({
          where: { id: { in: roomIds } },
          select: { id: true, number: true },
        })
      : [];
    const roomMap = new Map(rooms.map(r => [r.id, r.number]));

    const pending = maintenanceRequests.filter(r => r.status === 'pending').length;
    const inProgress = maintenanceRequests.filter(r => r.status === 'in_progress').length;
    const completed = maintenanceRequests.filter(r => r.status === 'completed').length;
    // ServiceRequest has no dueDate; use requestedAt for overdue calculation
    const overdue = maintenanceRequests.filter(r =>
      r.status !== 'completed' && r.requestedAt && new Date(r.requestedAt) < new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    ).length;

    const priorityMap: Record<string, string> = {
      low: 'low',
      medium: 'medium',
      high: 'high',
      urgent: 'high',
    };

    const statusMap: Record<string, string> = {
      pending: 'pending',
      in_progress: 'inProgress',
      completed: 'completed',
    };

    const tasks = maintenanceRequests.map(sr => ({
      id: sr.id,
      title: sr.subject,
      description: sr.description || '',
      status: statusMap[sr.status] || 'pending',
      priority: priorityMap[sr.priority] || 'medium',
      assignedTo: sr.assignee ? {
        initials: `${sr.assignee.firstName[0]}${sr.assignee.lastName[0]}`,
        name: `${sr.assignee.firstName} ${sr.assignee.lastName}`,
      } : null,
      progress: sr.status === 'completed' ? 100 : sr.status === 'in_progress' ? 50 : 0,
      dueDate: sr.startedAt ? new Date(sr.startedAt).toISOString().split('T')[0] : null,
      location: sr.roomId ? `Room ${roomMap.get(sr.roomId) || ''}` : 'General',
    }));

    return NextResponse.json({
      success: true,
      data: {
        totalTasks: maintenanceRequests.length,
        lastUpdated: new Date().toISOString(),
        summary: { pending, inProgress, completed, overdue },
        tasks,
        hasData: maintenanceRequests.length > 0,
      },
    });
  } catch (error) {
    console.error('[Maintenance API] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch maintenance data' } },
      { status: 500 }
    );
  }
}
