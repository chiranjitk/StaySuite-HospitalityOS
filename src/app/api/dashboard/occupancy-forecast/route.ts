import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'dashboard.view');
  if (user instanceof NextResponse) return user;

  try {
    const tenantId = user.tenantId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekLater = new Date(today);
    weekLater.setDate(weekLater.getDate() + 7);

    const properties = await db.property.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, totalRooms: true },
    });
    const propertyIds = properties.map(p => p.id);
    const totalRooms = properties.reduce((s, p) => s + p.totalRooms, 0);

    if (totalRooms === 0 || propertyIds.length === 0) {
      // No properties — return empty forecast, no fake data
      const forecastData: Array<{ date: string; day: string; isToday: boolean; occupancy: number }> = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        forecastData.push({
          date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          day: d.toLocaleDateString('en-US', { weekday: 'short' }),
          isToday: i === 0,
          occupancy: 0,
        });
      }
      return NextResponse.json({
        success: true,
        data: { forecastData, avgOccupancy: 0, totalRooms: 0, hasData: false },
      });
    }

    // Fetch bookings that overlap the next 7 days
    const upcomingBookings = await db.booking.findMany({
      where: {
        propertyId: { in: propertyIds },
        status: { notIn: ['cancelled'] },
        deletedAt: null,
        OR: [
          { checkIn: { lt: weekLater, gte: today } },
          { checkOut: { gt: today, lte: weekLater } },
          { checkIn: { lt: today }, checkOut: { gt: today } },
        ],
      },
      select: { checkIn: true, checkOut: true, status: true, roomId: true },
    });

    // Build forecast day by day using real data only — no Math.random()
    const forecastData: Array<{ date: string; day: string; isToday: boolean; occupancy: number }> = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      // Count rooms occupied on this date
      const roomsInUse = new Set<string>();
      upcomingBookings.forEach(b => {
        const ci = new Date(b.checkIn);
        const co = new Date(b.checkOut);
        if (ci < nextDate && co > date) {
          if (b.roomId) roomsInUse.add(b.roomId);
        }
      });

      const occupancy = totalRooms > 0 ? Math.round((roomsInUse.size / totalRooms) * 100) : 0;

      forecastData.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        isToday: i === 0,
        occupancy: Math.min(100, Math.max(0, occupancy)),
      });
    }

    const avgOccupancy = Math.round(forecastData.reduce((s, d) => s + d.occupancy, 0) / forecastData.length);

    return NextResponse.json({
      success: true,
      data: { forecastData, avgOccupancy, totalRooms, hasData: true },
    });
  } catch (error) {
    console.error('[Occupancy Forecast API] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch occupancy forecast' } },
      { status: 500 }
    );
  }
}
