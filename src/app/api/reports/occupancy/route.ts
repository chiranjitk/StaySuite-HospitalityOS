import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { subDays, startOfDay, endOfDay, format, eachDayOfInterval, eachMonthOfInterval, startOfMonth, endOfMonth } from 'date-fns';
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

    // Get total rooms
    const roomWhere: Record<string, unknown> = {};
    if (propertyId) {
      roomWhere.propertyId = propertyId;
    }

    const rooms = await db.room.findMany({
      where: roomWhere,
      include: {
        roomType: true,
      },
    });

    const totalRooms = rooms.length;

    // Get room types for grouping
    const roomTypes = await db.roomType.findMany({
      where: propertyId ? { propertyId } : undefined,
      select: { id: true, name: true },
    });

    // Get rooms count by type
    const roomsByType = rooms.reduce((acc, room) => {
      const typeId = room.roomTypeId;
      if (!acc[typeId]) {
        acc[typeId] = { count: 0, name: room.roomType?.name || 'Unknown' };
      }
      acc[typeId].count++;
      return acc;
    }, {} as Record<string, { count: number; name: string }>);

    // Build where clause for bookings
    const bookingWhere: Record<string, unknown> = {
      tenantId,
      status: { notIn: ['draft', 'cancelled'] },
      checkIn: { lte: end },
      checkOut: { gte: start },
    };

    if (propertyId) {
      bookingWhere.propertyId = propertyId;
    }

    // Get active bookings in the period
    const bookings = await db.booking.findMany({
      where: bookingWhere,
      include: {
        room: {
          include: {
            roomType: true,
          },
        },
      },
    });

    // Calculate occupancy by date
    const occupancyByDate: Record<string, { occupied: number; total: number }> = {};

    if (granularity === 'daily') {
      const days = eachDayOfInterval({ start, end });
      days.forEach(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        occupancyByDate[dateKey] = { occupied: 0, total: totalRooms };
      });
    } else if (granularity === 'monthly') {
      const months = eachMonthOfInterval({ start, end });
      months.forEach(month => {
        const dateKey = format(month, 'yyyy-MM');
        occupancyByDate[dateKey] = { occupied: 0, total: totalRooms };
      });
    }

    // Count occupied rooms per day
    if (granularity === 'daily') {
      const days = eachDayOfInterval({ start, end });
      days.forEach(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const dayStart = startOfDay(day);
        const dayEnd = endOfDay(day);

        const occupiedOnDay = bookings.filter(booking => {
          const checkIn = new Date(booking.checkIn);
          const checkOut = new Date(booking.checkOut);
          // Room is occupied if check-in is before or on this day AND check-out is after this day
          return checkIn <= dayEnd && checkOut > dayStart;
        });

        occupancyByDate[dateKey].occupied = occupiedOnDay.length;
      });
    } else if (granularity === 'monthly') {
      const months = eachMonthOfInterval({ start, end });
      months.forEach(month => {
        const dateKey = format(month, 'yyyy-MM');
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);
        const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

        let totalOccupiedRoomNights = 0;
        daysInMonth.forEach(day => {
          const dayStart = startOfDay(day);
          const dayEnd = endOfDay(day);

          const occupiedOnDay = bookings.filter(booking => {
            const checkIn = new Date(booking.checkIn);
            const checkOut = new Date(booking.checkOut);
            return checkIn <= dayEnd && checkOut > dayStart;
          });

          totalOccupiedRoomNights += occupiedOnDay.length;
        });

        // Average occupancy for the month
        const avgOccupied = Math.round(totalOccupiedRoomNights / daysInMonth.length);
        occupancyByDate[dateKey].occupied = avgOccupied;
      });
    }

    // Convert to array for charts
    const occupancyData = Object.entries(occupancyByDate)
      .map(([date, data]) => ({
        date,
        occupied: data.occupied,
        total: data.total,
        occupancy: data.total > 0 ? Math.round((data.occupied / data.total) * 100) : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate summary stats
    const avgOccupancy = occupancyData.length > 0
      ? occupancyData.reduce((sum, d) => sum + d.occupancy, 0) / occupancyData.length
      : 0;

    const maxOccupancy = Math.max(...occupancyData.map(d => d.occupancy), 0);
    const minOccupancy = Math.min(...occupancyData.map(d => d.occupancy), 100);

    // Occupancy by room type
    const occupancyByRoomType = Object.entries(roomsByType).map(([typeId, data]) => {
      const roomsOfType = rooms.filter(r => r.roomTypeId === typeId);
      const occupiedRooms = roomsOfType.filter(r => r.status === 'occupied').length;

      return {
        roomTypeId: typeId,
        roomTypeName: data.name,
        total: data.count,
        occupied: occupiedRooms,
        occupancy: data.count > 0 ? Math.round((occupiedRooms / data.count) * 100) : 0,
      };
    });

    // Room status distribution
    const statusDistribution = rooms.reduce((acc, room) => {
      const status = room.status;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Previous period comparison
    const periodDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const prevStart = subDays(start, periodDays);
    const prevEnd = subDays(start, 1);

    // Calculate previous period occupancy
    const prevDays = eachDayOfInterval({ start: prevStart, end: prevEnd });
    let prevTotalOccupied = 0;

    prevDays.forEach(day => {
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);

      const occupiedOnDay = bookings.filter(booking => {
        const checkIn = new Date(booking.checkIn);
        const checkOut = new Date(booking.checkOut);
        return checkIn <= dayEnd && checkOut > dayStart;
      });

      prevTotalOccupied += occupiedOnDay.length;
    });

    const prevAvgOccupancy = totalRooms > 0
      ? (prevTotalOccupied / prevDays.length / totalRooms) * 100
      : 0;

    const occupancyChange = prevAvgOccupancy > 0
      ? avgOccupancy - prevAvgOccupancy
      : 0;

    // Peak days analysis
    const peakDays = occupancyData
      .filter(d => d.occupancy >= 90)
      .map(d => d.date);

    const lowOccupancyDays = occupancyData
      .filter(d => d.occupancy < 50)
      .map(d => d.date);

    return NextResponse.json({
      success: true,
      data: {
        occupancyData,
        summary: {
          avgOccupancy: Math.round(avgOccupancy * 100) / 100,
          maxOccupancy,
          minOccupancy,
          totalRooms,
          occupancyChange: Math.round(occupancyChange * 100) / 100,
        },
        occupancyByRoomType,
        statusDistribution: Object.entries(statusDistribution).map(([status, count]) => ({
          status,
          count,
        })),
        peakDays: peakDays.slice(0, 10),
        lowOccupancyDays: lowOccupancyDays.slice(0, 10),
      },
    });
  } catch (error) {
    console.error('Occupancy report error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate occupancy report' },
      { status: 500 }
    );
  }
}
