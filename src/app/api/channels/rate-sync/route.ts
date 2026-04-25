import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/channels/rate-sync - Get rate sync status
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
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view rate sync' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;

    // Get active channel connections
    const connections = await db.channelConnection.findMany({
      where: { tenantId },
    });

    // Get rate plans through property relationship
    const ratePlans = await db.ratePlan.findMany({
      where: { 
        roomType: { property: { tenantId } },
        deletedAt: null 
      },
      include: {
        roomType: {
          select: { name: true },
        },
      },
    });

    // Get channel mappings for rate info
    const mappings = await db.channelMapping.findMany({
      where: {
        connection: { tenantId },
        syncRates: true,
      },
    });

    // Get recent rate sync logs
    const syncLogs = await db.channelSyncLog.findMany({
      where: {
        connection: { tenantId },
        syncType: 'rate',
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Get price overrides for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const priceOverrides = await db.priceOverride.findMany({
      where: {
        ratePlan: { roomType: { property: { tenantId } } },
        date: today,
      },
    });

    // Build rate sync data
    const rateData: Array<{
      id: string;
      connectionId: string;
      channelName: string;
      channelType: string;
      roomType: string;
      ratePlan: string;
      basePrice: number;
      channelPrice: number;
      priceDiff: number;
      currency: string;
      lastSync: Date | null;
      status: string;
      autoAdjust: boolean;
    }> = [];

    for (const connection of connections) {
      for (const ratePlan of ratePlans) {
        const lastSyncLog = syncLogs.find(l => l.connectionId === connection.id);
        const mapping = mappings.find(m => m.connectionId === connection.id && m.roomTypeId === ratePlan.roomTypeId);

        // Get base price from rate plan or override
        const priceOverride = priceOverrides.find(po => po.ratePlanId === ratePlan.id);
        const basePrice = priceOverride?.price || ratePlan.basePrice;

        // Channel price comes from the mapping or sync log data
        // If we have a sync log with response data, use that
        // Otherwise, assume rates are synced (channelPrice = basePrice)
        let channelPrice = basePrice;
        let priceDiff = 0;

        if (lastSyncLog?.responsePayload) {
          try {
            const responseData = JSON.parse(lastSyncLog.responsePayload as string);
            if (responseData.channelPrice !== undefined) {
              channelPrice = responseData.channelPrice;
              priceDiff = Math.round((channelPrice - basePrice) * 100) / 100;
            }
          } catch {
            // Invalid JSON, use default
          }
        }

        // Determine status
        let status = 'synced';
        if (!mapping) {
          status = 'not_mapped';
        } else if (!lastSyncLog) {
          status = 'pending';
        } else if (lastSyncLog.status === 'failed') {
          status = 'error';
        } else if (Math.abs(priceDiff) > 1) {
          status = priceDiff > 0 ? 'higher' : 'lower';
        }

        rateData.push({
          // Use '::' as a safer composite delimiter (UUIDs contain '-')
          id: `${connection.id}::${ratePlan.id}`,
          connectionId: connection.id,
          channelName: connection.displayName || connection.channel,
          channelType: connection.channel,
          roomType: ratePlan.roomType?.name || 'Unknown',
          ratePlan: ratePlan.name,
          basePrice,
          channelPrice,
          priceDiff,
          currency: 'USD',
          lastSync: lastSyncLog?.createdAt || null,
          status,
          autoAdjust: connection.autoSync,
        });
      }
    }

    // Calculate stats
    const stats = {
      total: rateData.length,
      synced: rateData.filter(d => d.status === 'synced').length,
      outOfSync: rateData.filter(d => ['higher', 'lower'].includes(d.status)).length,
      errors: rateData.filter(d => d.status === 'error').length,
      pending: rateData.filter(d => d.status === 'pending').length,
      notMapped: rateData.filter(d => d.status === 'not_mapped').length,
      avgBasePrice: rateData.length > 0
        ? Math.round(rateData.reduce((sum, d) => sum + d.basePrice, 0) / rateData.length)
        : 0,
    };

    return NextResponse.json({
      success: true,
      data: rateData,
      stats,
    });
  } catch (error) {
    console.error('Error fetching rate sync:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch rate sync' } },
      { status: 500 }
    );
  }
}

// POST /api/channels/rate-sync - Update rate sync settings or trigger sync
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
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to update rates' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, id, channelPrice } = body;

    if (action === 'updatePrice' && id && channelPrice !== undefined) {
      // Parse connectionId and ratePlanId from composite id
      // Format: connectionId::ratePlanId (uses '::' delimiter since UUIDs contain '-')
      // Fallback: if only one part after '::', try '-' split as legacy support
      let connectionId: string | undefined;
      let ratePlanId: string | undefined;

      if (id.includes('::')) {
        const parts = id.split('::');
        connectionId = parts[0];
        ratePlanId = parts.slice(1).join('::'); // ratePlanId might contain '::' in theory
      } else {
        // Legacy fallback for old '-' format - less reliable with UUIDs
        const parts = id.split('-');
        if (parts.length >= 2) {
          connectionId = parts[0];
          ratePlanId = parts.slice(1).join('-');
        }
      }

      if (!connectionId || !ratePlanId) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_ID', message: 'Invalid composite ID format' } },
          { status: 400 }
        );
      }

      // Verify connection belongs to user's tenant
      const connection = await db.channelConnection.findFirst({
        where: { id: connectionId, tenantId: user.tenantId },
      });

      if (!connection) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Connection not found' } },
          { status: 404 }
        );
      }

      // Create a sync log entry for the rate update
      await db.channelSyncLog.create({
        data: {
          connectionId,
          syncType: 'rate',
          direction: 'outbound',
          status: 'success',
          requestPayload: JSON.stringify({ ratePlanId, channelPrice }),
          responsePayload: JSON.stringify({ channelPrice, syncedAt: new Date().toISOString() }),
        },
      });

      // Update connection last sync time
      await db.channelConnection.update({
        where: { id: connectionId },
        data: { lastSyncAt: new Date() },
      });

      return NextResponse.json({
        success: true,
        message: 'Rate updated successfully',
        data: { id, channelPrice },
      });
    }

    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ACTION', message: 'Invalid action or missing parameters' } },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating rate sync:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update rate sync' } },
      { status: 500 }
    );
  }
}
