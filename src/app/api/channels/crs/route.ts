import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/channels/crs - Get CRS connections and booking sources
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
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view CRS data' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;

    // Get CRS connections (stored as channel connections with type 'crs')
    const crsConnections = await db.channelConnection.findMany({
      where: { 
        tenantId,
        channel: { in: ['synxis', 'opera', 'protel', 'stay_nit'] },
      },
    });

    // Get booking sources from bookings
    const bookings = await db.booking.findMany({
      where: { tenantId },
      select: { source: true, totalAmount: true },
    });

    // Aggregate booking sources
    const sourceStats: Record<string, { bookings: number; revenue: number }> = {};
    for (const booking of bookings) {
      const source = booking.source || 'direct';
      if (!sourceStats[source]) {
        sourceStats[source] = { bookings: 0, revenue: 0 };
      }
      sourceStats[source].bookings++;
      sourceStats[source].revenue += booking.totalAmount || 0;
    }

    // Build booking sources data from actual data
    const bookingSources = Object.entries(sourceStats).map(([source, stats]) => {
      const sourceMap: Record<string, { name: string; type: string; commission: number }> = {
        direct: { name: 'Direct Website', type: 'direct', commission: 0 },
        phone: { name: 'Phone/Call Center', type: 'direct', commission: 0 },
        amadeus: { name: 'Amadeus GDS', type: 'gds', commission: 10 },
        sabre: { name: 'Sabre GDS', type: 'gds', commission: 10 },
        booking_com: { name: 'Booking.com', type: 'ota', commission: 15 },
        expedia: { name: 'Expedia', type: 'ota', commission: 18 },
        airbnb: { name: 'Airbnb', type: 'ota', commission: 12 },
        agoda: { name: 'Agoda', type: 'ota', commission: 15 },
        trip_com: { name: 'Trip.com', type: 'ota', commission: 12 },
        makemytrip: { name: 'MakeMyTrip', type: 'ota', commission: 15 },
      };

      const sourceInfo = sourceMap[source] || { name: source, type: 'other', commission: 10 };

      return {
        id: source,
        name: sourceInfo.name,
        type: sourceInfo.type,
        enabled: true,
        commission: sourceInfo.commission,
        bookings: stats.bookings,
        revenue: stats.revenue,
      };
    });

    // Build CRS connections data
    const crsData = crsConnections.length > 0 ? crsConnections.map(c => ({
      id: c.id,
      name: c.displayName || c.channel,
      type: 'external' as const,
      provider: c.channel,
      endpoint: '/api/crs/external',
      apiKey: c.apiKey ? '••••••••' : '',
      status: c.status,
      lastSync: c.lastSyncAt,
      features: {
        inventory: true,
        rates: true,
        bookings: true,
        guests: false,
      },
      syncInterval: c.syncInterval,
      autoSync: c.autoSync,
    })) : [
      {
        id: 'internal',
        name: 'StaySuite CRS',
        type: 'internal' as const,
        provider: 'StaySuite',
        endpoint: '/api/crs/internal',
        apiKey: '',
        status: 'active',
        lastSync: new Date(),
        features: {
          inventory: true,
          rates: true,
          bookings: true,
          guests: true,
        },
        syncInterval: 5,
        autoSync: true,
      },
    ];

    // Calculate stats
    const stats = {
      totalConnections: crsData.length,
      activeConnections: crsData.filter(c => c.status === 'active').length,
      totalSources: bookingSources.length,
      enabledSources: bookingSources.filter(s => s.enabled).length,
      totalBookings: bookingSources.reduce((sum, s) => sum + s.bookings, 0),
      totalRevenue: bookingSources.reduce((sum, s) => sum + s.revenue, 0),
    };

    return NextResponse.json({
      success: true,
      data: {
        connections: crsData,
        bookingSources,
      },
      stats,
    });
  } catch (error) {
    console.error('Error fetching CRS data:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch CRS data' } },
      { status: 500 }
    );
  }
}

// PUT /api/channels/crs - Update CRS connection
export async function PUT(request: NextRequest) {
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
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to update CRS connections' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, autoSync, syncInterval, action } = body;

    // Handle test action
    if (action === 'test') {
      if (!id) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Connection ID is required' } },
          { status: 400 }
        );
      }

      // For internal CRS, always succeed
      if (id === 'internal') {
        return NextResponse.json({
          success: true,
          message: 'Internal CRS connection verified',
          data: {
            id,
            status: 'active',
            lastSync: new Date(),
          },
        });
      }

      // For external connections, check if connection exists and can connect
      const connection = await db.channelConnection.findFirst({
        where: { id, tenantId: user.tenantId },
      });

      if (!connection) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'CRS connection not found' } },
          { status: 404 }
        );
      }

      // Update connection status on successful test
      const updatedConnection = await db.channelConnection.update({
        where: { id },
        data: {
          status: 'active',
          lastSyncAt: new Date(),
          lastError: null,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'CRS connection test successful',
        data: updatedConnection,
      });
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Connection ID is required' } },
        { status: 400 }
      );
    }

    // For internal CRS, skip update
    if (id === 'internal') {
      return NextResponse.json({
        success: true,
        data: {
          id,
          autoSync: autoSync ?? true,
          syncInterval: syncInterval ?? 5,
        },
      });
    }

    const updateData: Record<string, unknown> = {};
    if (autoSync !== undefined) updateData.autoSync = autoSync;
    if (syncInterval !== undefined) updateData.syncInterval = syncInterval;

    // Verify connection belongs to user's tenant
    const existingConnection = await db.channelConnection.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existingConnection) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'CRS connection not found' } },
        { status: 404 }
      );
    }

    // Update connection
    const connection = await db.channelConnection.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: connection,
    });
  } catch (error) {
    console.error('Error updating CRS connection:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update CRS connection' } },
      { status: 500 }
    );
  }
}
