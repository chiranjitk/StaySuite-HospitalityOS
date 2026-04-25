import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { subDays, startOfDay, endOfDay, format, eachDayOfInterval, eachMonthOfInterval, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { getTenantIdFromSession } from '@/lib/auth/tenant-context';

export async function GET(request: NextRequest) {
    const tenantId = await getTenantIdFromSession(request);
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }


  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const granularity = searchParams.get('granularity') || 'daily'; // daily, weekly, monthly

    // Default to last 30 days if no dates provided
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : subDays(end, 30);

    // Build where clause for bookings
    const bookingWhere: Record<string, unknown> = {
      tenantId,
      status: { notIn: ['draft', 'cancelled'] },
      createdAt: {
        gte: startOfDay(start),
        lte: endOfDay(end),
      },
    };

    if (propertyId) {
      bookingWhere.propertyId = propertyId;
    }

    // Get bookings with payment data
    const bookings = await db.booking.findMany({
      where: bookingWhere,
      include: {
        room: {
          include: {
            roomType: true,
          },
        },
        folios: {
          include: {
            payments: true,
            lineItems: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Get payments for the period
    const payments = await db.payment.findMany({
      where: {
        tenantId,
        status: 'completed',
        processedAt: {
          gte: startOfDay(start),
          lte: endOfDay(end),
        },
      },
    });

    // Calculate revenue by date
    const revenueByDate: Record<string, { revenue: number; bookings: number; taxes: number; payments: number }> = {};

    if (granularity === 'daily') {
      const days = eachDayOfInterval({ start, end });
      days.forEach(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        revenueByDate[dateKey] = { revenue: 0, bookings: 0, taxes: 0, payments: 0 };
      });
    } else if (granularity === 'monthly') {
      const months = eachMonthOfInterval({ start, end });
      months.forEach(month => {
        const dateKey = format(month, 'yyyy-MM');
        revenueByDate[dateKey] = { revenue: 0, bookings: 0, taxes: 0, payments: 0 };
      });
    }

    // Process bookings
    bookings.forEach(booking => {
      const dateKey = granularity === 'monthly'
        ? format(booking.createdAt, 'yyyy-MM')
        : format(booking.createdAt, 'yyyy-MM-dd');

      if (!revenueByDate[dateKey]) {
        revenueByDate[dateKey] = { revenue: 0, bookings: 0, taxes: 0, payments: 0 };
      }

      revenueByDate[dateKey].revenue += booking.totalAmount || 0;
      revenueByDate[dateKey].taxes += booking.taxes || 0;
      revenueByDate[dateKey].bookings += 1;
    });

    // Process payments
    payments.forEach(payment => {
      const paymentDate = payment.processedAt || payment.createdAt;
      const dateKey = granularity === 'monthly'
        ? format(paymentDate, 'yyyy-MM')
        : format(paymentDate, 'yyyy-MM-dd');

      if (!revenueByDate[dateKey]) {
        revenueByDate[dateKey] = { revenue: 0, bookings: 0, taxes: 0, payments: 0 };
      }

      revenueByDate[dateKey].payments += payment.amount;
    });

    // Convert to array for charts
    const revenueData = Object.entries(revenueByDate)
      .map(([date, data]) => ({
        date,
        revenue: Math.round(data.revenue * 100) / 100,
        bookings: data.bookings,
        taxes: Math.round(data.taxes * 100) / 100,
        payments: Math.round(data.payments * 100) / 100,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate summary stats
    const totalRevenue = revenueData.reduce((sum, d) => sum + d.revenue, 0);
    const totalBookings = revenueData.reduce((sum, d) => sum + d.bookings, 0);
    const totalPayments = revenueData.reduce((sum, d) => sum + d.payments, 0);
    const avgDailyRevenue = totalRevenue / (revenueData.length || 1);

    // Revenue by source
    const revenueBySource = await db.booking.groupBy({
      by: ['source'],
      where: bookingWhere,
      _sum: {
        totalAmount: true,
      },
      _count: {
        id: true,
      },
    });

    // Revenue by room type
    const revenueByRoomType = await db.booking.groupBy({
      by: ['roomTypeId'],
      where: bookingWhere,
      _sum: {
        totalAmount: true,
      },
      _count: {
        id: true,
      },
    });

    // Get room type names
    const roomTypes = await db.roomType.findMany({
      where: { propertyId: propertyId || undefined },
      select: { id: true, name: true },
    });

    const roomTypeMap = roomTypes.reduce((acc, rt) => {
      acc[rt.id] = rt.name;
      return acc;
    }, {} as Record<string, string>);

    const revenueByRoomTypeData = revenueByRoomType.map(item => ({
      roomTypeId: item.roomTypeId,
      roomTypeName: roomTypeMap[item.roomTypeId] || 'Unknown',
      revenue: item._sum.totalAmount || 0,
      bookings: item._count.id,
    }));

    // Previous period comparison
    const prevStart = subDays(start, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const prevEnd = subDays(start, 1);

    const prevBookings = await db.booking.findMany({
      where: {
        ...bookingWhere,
        createdAt: {
          gte: startOfDay(prevStart),
          lte: endOfDay(prevEnd),
        },
      },
      select: {
        totalAmount: true,
      },
    });

    const prevTotalRevenue = prevBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    const revenueChange = prevTotalRevenue > 0
      ? ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        revenueData,
        summary: {
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalBookings,
          totalPayments: Math.round(totalPayments * 100) / 100,
          avgDailyRevenue: Math.round(avgDailyRevenue * 100) / 100,
          revenueChange: Math.round(revenueChange * 100) / 100,
        },
        revenueBySource: revenueBySource.map(s => ({
          source: s.source,
          revenue: s._sum.totalAmount || 0,
          bookings: s._count.id,
        })),
        revenueByRoomType: revenueByRoomTypeData,
      },
    });
  } catch (error) {
    console.error('Revenue report error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate revenue report' },
      { status: 500 }
    );
  }
}
