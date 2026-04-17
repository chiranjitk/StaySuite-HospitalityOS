import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET - List delivery logs
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Permission check for viewing delivery logs
    if (!hasPermission(user, 'notifications.view')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
    };

    if (status) {
      where.status = status;
    }

    if (type) {
      where.channel = type;
    }

    const logs = await db.notificationLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await db.notificationLog.count({ where });

    const result = logs.map((log) => ({
      id: log.id,
      type: log.channel as 'email' | 'sms' | 'push' | 'in_app',
      template: 'Notification', // Would need to join with template
      recipient: log.recipientEmail || log.recipientPhone || log.recipientId,
      subject: log.subject || undefined,
      body: log.body,
      status: log.status as 'delivered' | 'failed' | 'bounced' | 'pending',
      sentAt: log.sentAt?.toISOString() || log.createdAt.toISOString(),
      deliveredAt: log.deliveredAt?.toISOString(),
      openedAt: undefined, // Would need additional tracking
      clickedAt: undefined,
      errorMessage: log.errorMessage || undefined,
      tenantId: log.tenantId,
    }));

    // Calculate stats
    const allLogs = await db.notificationLog.findMany({
      where: { tenantId: user.tenantId },
      select: { status: true },
    });

    const stats = {
      total: allLogs.length,
      delivered: allLogs.filter((l) => l.status === 'delivered').length,
      failed: allLogs.filter((l) => l.status === 'failed').length,
      bounced: allLogs.filter((l) => l.status === 'bounced').length,
      pending: allLogs.filter((l) => l.status === 'pending').length,
      deliveryRate:
        allLogs.length > 0
          ? ((allLogs.filter((l) => l.status === 'delivered').length / allLogs.length) * 100).toFixed(1)
          : '0',
    };

    return NextResponse.json({
      success: true,
      data: {
        logs: result,
        total,
        stats,
      },
    });
  } catch (error) {
    console.error('Error fetching delivery logs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch delivery logs' },
      { status: 500 }
    );
  }
}
