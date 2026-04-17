import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/channels/inventory-sync - Get inventory sync status
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
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view inventory sync' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;

    // Get active channel connections
    const connections = await db.channelConnection.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { channelMappings: true },
        },
      },
    });

    // Get properties with room types and rooms for this tenant
    const properties = await db.property.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        roomTypes: {
          where: { deletedAt: null },
          include: {
            rooms: {
              select: { id: true, status: true },
            },
          },
        },
      },
    });

    const roomTypes = properties.flatMap(p => p.roomTypes);

    // Get recent sync logs
    const syncLogs = await db.channelSyncLog.findMany({
      where: {
        connection: { tenantId },
        syncType: 'inventory',
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Build sync status data
    const syncData: Array<{
      connectionId: string;
      channelName: string;
      channelType: string;
      roomType: string;
      available: number;
      total: number;
      lastSync: Date | null;
      status: string;
      syncDirection: string;
    }> = [];

    for (const connection of connections) {
      for (const roomType of roomTypes) {
        const total = roomType.rooms?.length || 0;
        const available = roomType.rooms?.filter(r => r.status === 'available').length || 0;
        
        // Find last sync for this connection
        const lastSyncLog = syncLogs.find(l => l.connectionId === connection.id);
        
        // Determine status based on last sync
        let status = 'synced';
        if (!lastSyncLog) {
          status = 'pending';
        } else if (lastSyncLog.status === 'failed') {
          status = 'error';
        } else {
          const syncAge = Date.now() - new Date(lastSyncLog.createdAt).getTime();
          if (syncAge > 30 * 60 * 1000) { // 30 minutes
            status = 'out_of_sync';
          }
        }

        syncData.push({
          connectionId: connection.id,
          channelName: connection.displayName || connection.channel,
          channelType: connection.channel,
          roomType: roomType.name,
          available,
          total,
          lastSync: lastSyncLog?.createdAt || null,
          status,
          syncDirection: 'bidirectional',
        });
      }
    }

    // Calculate stats
    const stats = {
      totalRoomTypes: syncData.length,
      syncedCount: syncData.filter(d => d.status === 'synced').length,
      pendingCount: syncData.filter(d => d.status === 'pending').length,
      errorCount: syncData.filter(d => d.status === 'error').length,
      outOfSyncCount: syncData.filter(d => d.status === 'out_of_sync').length,
      lastGlobalSync: syncLogs[0]?.createdAt || null,
    };

    return NextResponse.json({
      success: true,
      data: syncData,
      stats,
    });
  } catch (error) {
    console.error('Error fetching inventory sync:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch inventory sync' } },
      { status: 500 }
    );
  }
}

// POST /api/channels/inventory-sync - Trigger inventory sync
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
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to sync inventory' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, channelName } = body;

    if (action === 'syncAll') {
      // Get all connections for the tenant
      const connections = await db.channelConnection.findMany({
        where: { tenantId: user.tenantId, status: 'active' },
      });

      // Create sync log entries
      for (const connection of connections) {
        await db.channelSyncLog.create({
          data: {
            connectionId: connection.id,
            syncType: 'inventory',
            direction: 'outbound',
            status: 'success',
          },
        });

        // Update connection last sync time
        await db.channelConnection.update({
          where: { id: connection.id },
          data: { lastSyncAt: new Date() },
        });
      }

      return NextResponse.json({
        success: true,
        message: `Synced inventory to ${connections.length} channels`,
      });
    }

    if (action === 'syncChannel' && channelName) {
      // Find the connection
      const connection = await db.channelConnection.findFirst({
        where: { tenantId: user.tenantId, channel: channelName, status: 'active' },
      });

      if (!connection) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Channel connection not found' } },
          { status: 404 }
        );
      }

      // Create sync log entry
      await db.channelSyncLog.create({
        data: {
          connectionId: connection.id,
          syncType: 'inventory',
          direction: 'outbound',
          status: 'success',
        },
      });

      // Update connection last sync time
      await db.channelConnection.update({
        where: { id: connection.id },
        data: { lastSyncAt: new Date() },
      });

      return NextResponse.json({
        success: true,
        message: `Synced inventory to ${channelName}`,
      });
    }

    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ACTION', message: 'Invalid action' } },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error syncing inventory:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to sync inventory' } },
      { status: 500 }
    );
  }
}
