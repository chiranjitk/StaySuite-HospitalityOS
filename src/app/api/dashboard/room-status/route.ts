import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
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
    if (!hasPermission(user, 'dashboard.view') && !hasPermission(user, 'rooms.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;

    // Get current date boundaries
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get all properties for the tenant
    const properties = await db.property.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, totalRooms: true },
    });

    const propertyIds = properties.map((p) => p.id);
    const totalRooms = properties.reduce((sum, p) => sum + p.totalRooms, 0);

    // Count rooms by status
    const roomsByStatus = await db.room.groupBy({
      by: ['status'],
      where: {
        propertyId: { in: propertyIds },
        deletedAt: null,
      },
      _count: { id: true },
    });

    const statusCounts = {
      available: 0,
      occupied: 0,
      maintenance: 0,
      dirty: 0,
      out_of_order: 0,
    };

    roomsByStatus.forEach((r) => {
      if (r.status in statusCounts) {
        statusCounts[r.status as keyof typeof statusCounts] = r._count.id;
      }
    });

    // Calculate occupancy rate
    const occupancyRate =
      totalRooms > 0 ? Math.round((statusCounts.occupied / totalRooms) * 100) : 0;

    // Today's arrivals — bookings with checkIn today in confirmed or checked_in status
    const todaysArrivals = await db.booking.count({
      where: {
        propertyId: { in: propertyIds },
        checkIn: { gte: today, lt: tomorrow },
        status: { in: ['confirmed', 'checked_in'] },
        deletedAt: null,
      },
    });

    // Today's departures — bookings with checkOut today currently checked in
    const todaysDepartures = await db.booking.count({
      where: {
        propertyId: { in: propertyIds },
        checkOut: { gte: today, lt: tomorrow },
        status: 'checked_in',
        deletedAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        statusCounts,
        totalRooms,
        occupancyRate,
        todaysArrivals,
        todaysDepartures,
      },
    });
  } catch (error) {
    console.error('[Room Status API] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch room status data' } },
      { status: 500 }
    );
  }
}
