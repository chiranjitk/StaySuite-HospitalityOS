import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'dashboard.view');
  if (user instanceof NextResponse) return user;

  try {
    const tenantId = user.tenantId;
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    // Get properties for this tenant only
    const properties = await db.property.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        rooms: { select: { id: true, status: true } },
      },
    });

    if (properties.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    const results = await Promise.all(
      properties.map(async (property) => {
        const totalRooms = property.rooms.length;
        const occupiedRooms = property.rooms.filter(r => r.status === 'occupied').length;
        const availableRooms = property.rooms.filter(r => r.status === 'available').length;

        // Get bookings for the last 30 days
        const recentBookings = await db.booking.findMany({
          where: {
            propertyId: property.id,
            checkIn: { gte: thirtyDaysAgo },
            deletedAt: null,
          },
          select: {
            totalAmount: true,
            checkIn: true,
            checkOut: true,
          },
        });

        const totalRevenue = recentBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
        const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;
        const avgDailyRevenue = 30 > 0 ? totalRevenue / 30 : 0;
        const avgBookingValue = recentBookings.length > 0 ? totalRevenue / recentBookings.length : 0;
        const revPAR = totalRooms > 0 ? avgDailyRevenue * (occupiedRooms / totalRooms) : 0;

        return {
          id: property.id,
          name: property.name,
          totalRooms,
          occupiedRooms,
          availableRooms,
          occupancyRate,
          totalRevenue,
          avgDailyRevenue,
          revPAR,
          avgBookingValue,
          totalBookings: recentBookings.length,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Error fetching property comparison:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch property comparison data' } },
      { status: 500 }
    );
  }
}
