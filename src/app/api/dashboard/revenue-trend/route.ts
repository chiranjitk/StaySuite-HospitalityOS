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
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 6);

    const properties = await db.property.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, totalRooms: true },
    });
    const propertyIds = properties.map(p => p.id);

    // Fetch all bookings in the 7-day window
    const bookings = await db.booking.findMany({
      where: {
        propertyId: { in: propertyIds },
        checkIn: { gte: weekAgo, lt: tomorrow },
        status: { notIn: ['cancelled'] },
        deletedAt: null,
      },
      select: { checkIn: true, totalAmount: true },
    });

    // Build daily data for last 7 days
    const dailyData: Array<{ day: string; revenue: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayRevenue = bookings
        .filter(b => {
          const ci = new Date(b.checkIn);
          return ci >= date && ci < nextDate;
        })
        .reduce((sum, b) => sum + b.totalAmount, 0);

      dailyData.push({
        day: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        revenue: Math.round(dayRevenue),
      });
    }

    const todayRevenue = dailyData[dailyData.length - 1].revenue;
    const yesterdayRevenue = dailyData[dailyData.length - 2].revenue;
    const weeklyTotal = dailyData.reduce((s, d) => s + d.revenue, 0);
    const changePercent = yesterdayRevenue > 0
      ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue * 100)
      : (todayRevenue > 0 ? 100 : 0);

    return NextResponse.json({
      success: true,
      data: {
        todayRevenue,
        yesterdayRevenue,
        weeklyTotal,
        changePercent: Math.round(changePercent * 10) / 10,
        dailyData,
      },
    });
  } catch (error) {
    console.error('[Revenue Trend API] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch revenue trend data' } },
      { status: 500 }
    );
  }
}
