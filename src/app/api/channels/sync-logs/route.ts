import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/channels/sync-logs - List all sync logs
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
    if (!hasPermission(user, 'channels.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view sync logs' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const searchParams = request.nextUrl.searchParams;
    const connectionId = searchParams.get('connectionId');
    const syncType = searchParams.get('syncType');
    const direction = searchParams.get('direction');
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build connection filter
    const connectionWhere: Record<string, unknown> = { tenantId };
    if (connectionId) {
      connectionWhere.id = connectionId;
    }

    // Get connections for this tenant
    const connections = await db.channelConnection.findMany({
      where: connectionWhere,
      select: { id: true, channel: true, displayName: true },
    });

    const connectionIds = connections.map(c => c.id);

    if (connectionIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        pagination: { total: 0, limit, offset },
        stats: {
          total: 0,
          success: 0,
          failed: 0,
          byType: [],
          byChannel: [],
        },
      });
    }

    // Build log filter
    const logWhere: Record<string, unknown> = {
      connectionId: { in: connectionIds },
    };

    if (syncType) {
      logWhere.syncType = syncType;
    }

    if (direction) {
      logWhere.direction = direction;
    }

    if (status) {
      logWhere.status = status;
    }

    const logs = await db.channelSyncLog.findMany({
      where: logWhere,
      include: {
        connection: {
          select: {
            channel: true,
            displayName: true,
          },
        },
      },
      orderBy: [
        { createdAt: 'desc' },
      ],
      take: limit,
      skip: offset,
    });

    const total = await db.channelSyncLog.count({ where: logWhere });

    // Stats
    const successCount = await db.channelSyncLog.count({
      where: { ...logWhere, status: 'success' },
    });

    const failedCount = await db.channelSyncLog.count({
      where: { ...logWhere, status: 'failed' },
    });

    // By type distribution
    const byType = await db.channelSyncLog.groupBy({
      by: ['syncType'],
      where: logWhere,
      _count: true,
    });

    // By channel distribution
    const byChannel = await db.channelSyncLog.groupBy({
      by: ['connectionId'],
      where: logWhere,
      _count: true,
    });

    const channelStats = byChannel.map(stat => {
      const conn = connections.find(c => c.id === stat.connectionId);
      return {
        connectionId: stat.connectionId,
        channel: conn?.channel || 'unknown',
        displayName: conn?.displayName || 'Unknown',
        count: stat._count,
      };
    });

    // Last 24 hours stats
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const last24hWhere = {
      ...logWhere,
      createdAt: { gte: yesterday },
    };

    const last24hTotal = await db.channelSyncLog.count({ where: last24hWhere });
    const last24hSuccess = await db.channelSyncLog.count({
      where: { ...last24hWhere, status: 'success' },
    });
    const last24hFailed = await db.channelSyncLog.count({
      where: { ...last24hWhere, status: 'failed' },
    });

    return NextResponse.json({
      success: true,
      data: logs.map(log => ({
        ...log,
        channelName: log.connection.displayName,
        channelType: log.connection.channel,
      })),
      pagination: {
        total,
        limit,
        offset,
      },
      stats: {
        total,
        success: successCount,
        failed: failedCount,
        successRate: total > 0 ? Math.round((successCount / total) * 100) : 0,
        byType: byType.map(t => ({ type: t.syncType, count: t._count })),
        byChannel: channelStats,
        last24h: {
          total: last24hTotal,
          success: last24hSuccess,
          failed: last24hFailed,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching sync logs:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch sync logs' } },
      { status: 500 }
    );
  }
}

// POST /api/channels/sync-logs - Create a sync log entry
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
    if (!hasPermission(user, 'channels.update')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to create sync logs' } },
        { status: 403 }
      );
    }

    const body = await request.json();

    const {
      connectionId,
      syncType,
      direction,
      requestPayload,
      responsePayload,
      statusCode,
      status,
      errorMessage,
      correlationId,
      attemptCount = 1,
    } = body;

    if (!connectionId || !syncType || !direction || !status) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } },
        { status: 400 }
      );
    }

    // Verify connection belongs to user's tenant
    const connection = await db.channelConnection.findFirst({
      where: { id: connectionId, tenantId: user.tenantId },
    });

    if (!connection) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Channel connection not found or access denied' } },
        { status: 404 }
      );
    }

    const log = await db.channelSyncLog.create({
      data: {
        connectionId,
        syncType,
        direction,
        requestPayload,
        responsePayload,
        statusCode,
        status,
        errorMessage,
        correlationId,
        attemptCount,
      },
    });

    // Update connection lastSyncAt if successful
    if (status === 'success') {
      await db.channelConnection.update({
        where: { id: connectionId },
        data: { lastSyncAt: new Date(), lastError: null },
      });
    } else if (status === 'failed' && errorMessage) {
      await db.channelConnection.update({
        where: { id: connectionId },
        data: { lastError: errorMessage },
      });
    }

    return NextResponse.json({ success: true, data: log }, { status: 201 });
  } catch (error) {
    console.error('Error creating sync log:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create sync log' } },
      { status: 500 }
    );
  }
}

// DELETE /api/channels/sync-logs - Delete old sync logs (cleanup)
export async function DELETE(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check - only admins can delete sync logs
    if (!hasPermission(user, 'channels.delete')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to delete sync logs' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const beforeDate = searchParams.get('beforeDate');
    const connectionId = searchParams.get('connectionId');

    if (!beforeDate) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Before date is required' } },
        { status: 400 }
      );
    }

    // Get user's connections
    const connections = await db.channelConnection.findMany({
      where: { tenantId: user.tenantId },
      select: { id: true },
    });

    const connectionIds = connections.map(c => c.id);

    const where: Record<string, unknown> = {
      createdAt: { lt: new Date(beforeDate) },
      connectionId: { in: connectionIds },
    };

    if (connectionId) {
      if (!connectionIds.includes(connectionId)) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Access denied to this connection' } },
          { status: 403 }
        );
      }
      where.connectionId = connectionId;
    }

    const result = await db.channelSyncLog.deleteMany({ where });

    return NextResponse.json({
      success: true,
      message: `Deleted ${result.count} sync logs`,
    });
  } catch (error) {
    console.error('Error deleting sync logs:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete sync logs' } },
      { status: 500 }
    );
  }
}
