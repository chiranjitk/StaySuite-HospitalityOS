import { NextRequest, NextResponse } from 'next/server';
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
    if (!hasPermission(user, 'frontdesk.view') && !hasPermission(user, 'bookings.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;

    // Date boundaries for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get all properties for this tenant
    const properties = await db.property.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, totalRooms: true },
    });
    const propertyIds = properties.map(p => p.id);
    const totalRooms = properties.reduce((sum, p) => sum + p.totalRooms, 0);

    if (propertyIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          arrivalsToday: 0,
          departuresToday: 0,
          checkedIn: 0,
          availableRooms: 0,
          totalRooms: 0,
          occupancyRate: 0,
          checkInsCompleted: 0,
          checkOutsCompleted: 0,
          avgCheckInTime: 0,
          avgCheckOutTime: 0,
          pendingActions: 0,
          arrivals: [],
          departures: [],
        },
      });
    }

    // Fetch today's arrivals (bookings checking in today that are confirmed/pending/checked_in)
    const arrivalsTodayBookings = await db.booking.findMany({
      where: {
        propertyId: { in: propertyIds },
        checkIn: { gte: today, lt: tomorrow },
        status: { in: ['confirmed', 'pending', 'checked_in'] },
        deletedAt: null,
      },
      include: {
        primaryGuest: { select: { firstName: true, lastName: true, phone: true, email: true } },
        roomType: { select: { name: true } },
        room: { select: { number: true } },
      },
      orderBy: { checkIn: 'asc' },
    });

    // Fetch today's departures (bookings checking out today that are checked_in)
    const departuresTodayBookings = await db.booking.findMany({
      where: {
        propertyId: { in: propertyIds },
        checkOut: { gte: today, lt: tomorrow },
        status: 'checked_in',
        deletedAt: null,
      },
      include: {
        primaryGuest: { select: { firstName: true, lastName: true } },
        room: {
          select: {
            number: true,
            roomType: { select: { name: true } },
          },
        },
        folios: { select: { balance: true } },
      },
      orderBy: { checkOut: 'asc' },
    });

    // Room counts by status
    const roomsByStatus = await db.room.groupBy({
      by: ['status'],
      where: {
        propertyId: { in: propertyIds },
        deletedAt: null,
      },
      _count: { id: true },
    });

    const roomStatusMap = roomsByStatus.reduce((acc, r) => {
      acc[r.status] = r._count.id;
      return acc;
    }, {} as Record<string, number>);

    const availableRooms = roomStatusMap['available'] || 0;
    const occupiedRooms = roomStatusMap['occupied'] || 0;

    // Count currently checked-in bookings
    const checkedInCount = await db.booking.count({
      where: {
        propertyId: { in: propertyIds },
        status: 'checked_in',
        deletedAt: null,
      },
    });

    // Count check-ins completed today (bookings that transitioned to checked_in today)
    const checkInsCompleted = arrivalsTodayBookings.filter(b => b.status === 'checked_in').length;

    // Count check-outs completed today (bookings that transitioned to checked_out today)
    const checkOutsCompleted = await db.booking.count({
      where: {
        propertyId: { in: propertyIds },
        status: 'checked_out',
        actualCheckOut: { gte: today, lt: tomorrow },
        deletedAt: null,
      },
    });

    // Pending service requests
    const pendingServiceRequests = await db.serviceRequest.count({
      where: { status: 'pending' },
    });

    // Pending actions count (service requests + rooms needing attention)
    const roomsNeedingAttention = await db.room.count({
      where: {
        propertyId: { in: propertyIds },
        status: { in: ['maintenance', 'dirty'] },
        deletedAt: null,
      },
    });

    const pendingActions = pendingServiceRequests + roomsNeedingAttention;

    // Calculate occupancy rate
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

    // Map arrivals to component's expected shape with ISO time
    const arrivals = arrivalsTodayBookings.map(b => ({
      id: b.id,
      guestName: `${b.primaryGuest.firstName} ${b.primaryGuest.lastName}`,
      roomType: b.roomType?.name || 'Standard',
      checkIn: b.checkIn.toISOString(),
      status: b.status,
      phone: b.primaryGuest.phone || undefined,
      email: b.primaryGuest.email || undefined,
      time: b.checkIn.toISOString(),
    }));

    // Map departures to component's expected shape with ISO time
    const departures = departuresTodayBookings.map(b => ({
      id: b.id,
      guestName: `${b.primaryGuest.firstName} ${b.primaryGuest.lastName}`,
      roomNumber: b.room?.number || 'TBD',
      checkOut: b.checkOut.toISOString(),
      balance: b.folios.reduce((sum, f) => sum + f.balance, 0),
      time: b.checkOut.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: {
        arrivalsToday: arrivalsTodayBookings.length,
        departuresToday: departuresTodayBookings.length,
        checkedIn: checkedInCount,
        availableRooms,
        totalRooms,
        occupancyRate,
        checkInsCompleted,
        checkOutsCompleted,
        avgCheckInTime: 8, // Default average, could be calculated from actual check-in logs
        avgCheckOutTime: 6, // Default average
        pendingActions,
        arrivals,
        departures,
      },
    });
  } catch (error) {
    console.error('Front Desk Dashboard API error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch front desk dashboard data' } },
      { status: 500 }
    );
  }
}
