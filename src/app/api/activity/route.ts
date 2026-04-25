import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';

type ActivityCategory = 'booking' | 'payment' | 'housekeeping' | 'guest' | 'system';

interface ActivityItem {
  id: string;
  category: ActivityCategory;
  type: string;
  title: string;
  description: string;
  guest?: { name: string; initials: string };
  room?: string;
  timestamp: Date;
  status?: string;
  amount?: number;
  user?: { name: string; initials: string };
  metadata?: Record<string, unknown>;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
    const offset = parseInt(searchParams.get('offset') || '0');
    const category = searchParams.get('category') || 'all';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const tenantId = user.tenantId;

    let activities: ActivityItem[] = [];
    let total = 0;

    const whereClause: Record<string, unknown> = { tenantId };

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) (whereClause.createdAt as Record<string, unknown>).gte = new Date(startDate);
      if (endDate) (whereClause.createdAt as Record<string, unknown>).lte = new Date(endDate);
    }

    const moduleFilter: Record<string, string[]> = {
      booking: ['bookings', 'reservations', 'booking-engine'],
      payment: ['payments', 'folios', 'invoices', 'accounting'],
      housekeeping: ['housekeeping', 'maintenance', 'rooms', 'tasks'],
      guest: ['guests', 'crm', 'communications', 'loyalty'],
      system: ['system', 'settings', 'integrations', 'audit'],
    };

    if (category && category !== 'all' && moduleFilter[category]) {
      whereClause.module = { in: moduleFilter[category] };
    }

    const auditLogs = await db.auditLog.findMany({
      where: whereClause,
      include: {
        user: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    total = await db.auditLog.count({ where: whereClause });

    const categoryMap: Record<string, ActivityCategory> = {
      bookings: 'booking',
      reservations: 'booking',
      'booking-engine': 'booking',
      payments: 'payment',
      folios: 'payment',
      invoices: 'payment',
      accounting: 'payment',
      housekeeping: 'housekeeping',
      maintenance: 'housekeeping',
      rooms: 'housekeeping',
      tasks: 'housekeeping',
      guests: 'guest',
      crm: 'guest',
      communications: 'guest',
      loyalty: 'guest',
      system: 'system',
      settings: 'system',
      integrations: 'system',
      audit: 'system',
    };

    const actionTitles: Record<string, string> = {
      create: 'Created',
      update: 'Updated',
      delete: 'Deleted',
      check_in: 'Checked In',
      check_out: 'Checked Out',
      cancel: 'Cancelled',
      confirm: 'Confirmed',
      process: 'Processed',
      sync: 'Synchronized',
      login: 'Logged In',
    };

    activities = auditLogs.map(log => ({
      id: log.id,
      category: categoryMap[log.module] || 'system',
      type: log.action,
      title: `${actionTitles[log.action] || log.action} ${log.entityType}`,
      description: (() => {
        try {
          if (log.newValue) {
            const parsed = JSON.parse(log.newValue);
            if (parsed.description) return parsed.description;
          }
        } catch { /* ignore */ }
        return `${log.action} ${log.entityType}${log.entityId ? ` #${log.entityId.slice(-6)}` : ''}`;
      })(),
      timestamp: log.createdAt,
      user: log.user ? {
        name: `${log.user.firstName} ${log.user.lastName}`,
        initials: `${log.user.firstName[0]}${log.user.lastName[0]}`,
      } : undefined,
      metadata: {
        module: log.module,
        entityType: log.entityType,
        entityId: log.entityId,
        ipAddress: log.ipAddress,
      },
    }));

    return NextResponse.json({
      success: true,
      data: {
        activities,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      },
    });
  } catch (error) {
    console.error('Activity API error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch activity data' } },
      { status: 500 }
    );
  }
}
