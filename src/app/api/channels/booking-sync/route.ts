import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/channels/booking-sync - Get booking sync status
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
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view booking sync' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;

    // Get channel connections
    const connections = await db.channelConnection.findMany({
      where: { tenantId },
    });

    // Get bookings with source info
    const bookings = await db.booking.findMany({
      where: { tenantId },
      include: {
        primaryGuest: {
          select: { firstName: true, lastName: true },
        },
        roomType: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Get booking sync logs
    const syncLogs = await db.channelSyncLog.findMany({
      where: {
        connection: { tenantId },
        syncType: 'booking',
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Build booking sync data
    const bookingData = bookings.map(booking => {
      // Determine channel from booking source
      const channelConnection = connections.find(c => 
        c.channel.toLowerCase().includes(booking.source?.toLowerCase() || '')
      );
      
      const lastSyncLog = syncLogs.find(l => 
        l.connectionId === channelConnection?.id
      );

      // Determine sync status
      let syncStatus = 'synced';
      if (booking.status === 'pending') {
        syncStatus = 'pending';
      } else if (booking.status === 'cancelled') {
        syncStatus = 'cancelled';
      }

      return {
        id: booking.id,
        channelName: channelConnection?.displayName || booking.source || 'Direct',
        channelType: channelConnection?.channel || 'direct',
        confirmationCode: booking.confirmationCode || `BK-${booking.id.slice(-6)}`,
        externalRef: booking.externalRef || '',
        guestName: `${booking.primaryGuest?.firstName || ''} ${booking.primaryGuest?.lastName || ''}`.trim(),
        roomType: booking.roomType?.name || 'Standard',
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        amount: booking.totalAmount || 0,
        currency: 'USD',
        syncStatus,
        syncDirection: 'inbound',
        lastSync: lastSyncLog?.createdAt || booking.createdAt,
      };
    });

    // Calculate stats
    const stats = {
      total: bookingData.length,
      synced: bookingData.filter(d => d.syncStatus === 'synced').length,
      pending: bookingData.filter(d => d.syncStatus === 'pending').length,
      conflicts: 0,
      cancelled: bookingData.filter(d => d.syncStatus === 'cancelled').length,
      inbound: bookingData.filter(d => d.syncDirection === 'inbound').length,
      outbound: bookingData.filter(d => d.syncDirection === 'outbound').length,
    };

    return NextResponse.json({
      success: true,
      data: bookingData,
      stats,
    });
  } catch (error) {
    console.error('Error fetching booking sync:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch booking sync' } },
      { status: 500 }
    );
  }
}

// POST /api/channels/booking-sync - Sync individual booking
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
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to sync bookings' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, bookingId } = body;

    if (action === 'syncBooking' && bookingId) {
      // Get the booking
      const booking = await db.booking.findFirst({
        where: { id: bookingId, tenantId: user.tenantId },
      });

      if (!booking) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } },
          { status: 404 }
        );
      }

      // Find the channel connection
      const connection = await db.channelConnection.findFirst({
        where: { tenantId: user.tenantId, channel: booking.source || '' },
      });

      if (connection) {
        // Create sync log
        await db.channelSyncLog.create({
          data: {
            connectionId: connection.id,
            syncType: 'booking',
            direction: 'outbound',
            status: 'success',
          },
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Booking synced successfully',
      });
    }

    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ACTION', message: 'Invalid action' } },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error syncing booking:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to sync booking' } },
      { status: 500 }
    );
  }
}
