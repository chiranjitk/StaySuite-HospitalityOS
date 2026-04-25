import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';// GET /api/chain/dashboard - Chain-level dashboard data
export async function GET(request: NextRequest) {    const user = await requirePermission(request, 'chain.view');
    if (user instanceof NextResponse) return user;

      try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = user.tenantId;
    const brandId = searchParams.get('brandId');

    // Build property filter
    const propertyWhere: Record<string, unknown> = {
      tenantId,
      deletedAt: null,
    };

    if (brandId) {
      propertyWhere.brandId = brandId;
    }

    // Get all properties
    const properties = await db.property.findMany({
      where: propertyWhere,
      include: {
        _count: {
          select: {
            rooms: true,
            roomTypes: true,
          },
        },
      },
    });

    const propertyIds = properties.map((p) => p.id);

    // Get booking stats
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

    // Current month bookings
    const currentMonthBookings = await db.booking.count({
      where: {
        propertyId: { in: propertyIds },
        createdAt: { gte: startOfMonth },
        status: { notIn: ['draft', 'cancelled'] },
      },
    });

    // Last month bookings
    const lastMonthBookings = await db.booking.count({
      where: {
        propertyId: { in: propertyIds },
        createdAt: { gte: startOfLastMonth, lt: startOfMonth },
        status: { notIn: ['draft', 'cancelled'] },
      },
    });

    // Active guests
    const activeGuests = await db.booking.count({
      where: {
        propertyId: { in: propertyIds },
        status: 'checked_in',
      },
    });

    // Today's arrivals - use Date constructor copies to avoid mutating shared object
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    const todayArrivals = await db.booking.count({
      where: {
        propertyId: { in: propertyIds },
        checkIn: {
          gte: todayStart,
          lt: todayEnd,
        },
        status: 'confirmed',
      },
    });

    // Today's departures
    const todayDepartures = await db.booking.count({
      where: {
        propertyId: { in: propertyIds },
        checkOut: {
          gte: todayStart,
          lt: todayEnd,
        },
        status: 'checked_in',
      },
    });

    // Total revenue this month
    const currentMonthRevenue = await db.payment.aggregate({
      where: {
        folio: {
          booking: {
            propertyId: { in: propertyIds },
          },
        },
        status: 'completed',
        processedAt: { gte: startOfMonth },
      },
      _sum: {
        amount: true,
      },
    });

    // Last month revenue
    const lastMonthRevenue = await db.payment.aggregate({
      where: {
        folio: {
          booking: {
            propertyId: { in: propertyIds },
          },
        },
        status: 'completed',
        processedAt: { gte: startOfLastMonth, lt: startOfMonth },
      },
      _sum: {
        amount: true,
      },
    });

    // Total rooms
    const totalRooms = properties.reduce((sum, p) => sum + p._count.rooms, 0);

    // Occupied rooms - count distinct rooms, not bookings
    const occupiedRoomRecords = await db.booking.findMany({
      where: {
        propertyId: { in: propertyIds },
        status: 'checked_in',
        roomId: { not: null },
      },
      select: { roomId: true },
      distinct: ['roomId'],
    });
    const occupiedRooms = occupiedRoomRecords.length;

    // Occupancy rate
    const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

    // Get brands
    const brands = await db.brand.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { properties: true },
        },
      },
    });

    // Property performance - batch query optimization
    // Get all bookings for this month in one query
    const propBookingsAll = await db.booking.findMany({
      where: {
        propertyId: { in: propertyIds },
        status: { notIn: ['draft', 'cancelled'] },
        createdAt: { gte: startOfMonth },
      },
      select: { propertyId: true, roomId: true, id: true },
    });

    // Get all checked-in bookings in one query
    const checkedInBookingsAll = await db.booking.findMany({
      where: {
        propertyId: { in: propertyIds },
        status: 'checked_in',
        roomId: { not: null },
      },
      select: { propertyId: true, roomId: true },
    });

    // Get all payments aggregated by property in one query
    const paymentsByProperty = await db.payment.groupBy({
      by: ['folioId'],
      where: {
        status: 'completed',
        processedAt: { gte: startOfMonth },
      },
      _sum: { amount: true },
    });

    // Get folio-property mapping
    const folios = await db.folio.findMany({
      where: {
        booking: { propertyId: { in: propertyIds } },
      },
      select: { id: true, booking: { select: { propertyId: true } } },
    });
    const folioPropertyMap = new Map(folios.map(f => [f.id, f.booking?.propertyId]));

    // Build revenue map from folio
    const revenueByProperty = new Map<string, number>();
    for (const p of paymentsByProperty) {
      const propId = folioPropertyMap.get(p.folioId);
      if (propId) {
        revenueByProperty.set(propId, (revenueByProperty.get(propId) || 0) + (p._sum.amount || 0));
      }
    }

    const propertyPerformance = properties.map((property) => {
      const propBookings = propBookingsAll.filter(b => b.propertyId === property.id).length;
      const propRevenue = revenueByProperty.get(property.id) || 0;
      const propOccupiedRooms = new Set(
        checkedInBookingsAll.filter(b => b.propertyId === property.id).map(b => b.roomId).filter(Boolean)
      ).size;

      return {
        id: property.id,
        name: property.name,
        city: property.city,
        country: property.country,
        type: property.type,
        status: property.status,
        totalRooms: property._count.rooms,
        bookings: propBookings,
        revenue: propRevenue,
        occupancy: property._count.rooms > 0 ? (propOccupiedRooms / property._count.rooms) * 100 : 0,
      };
    });

    // Calculate changes
    const bookingChange = lastMonthBookings > 0 
      ? ((currentMonthBookings - lastMonthBookings) / lastMonthBookings) * 100 
      : 0;
    const revenueChange = (lastMonthRevenue._sum.amount || 0) > 0 
      ? (((currentMonthRevenue._sum.amount || 0) - (lastMonthRevenue._sum.amount || 0)) / (lastMonthRevenue._sum.amount || 1)) * 100 
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalProperties: properties.length,
          totalRooms,
          totalBrands: brands.length,
          occupancyRate: Math.round(occupancyRate * 10) / 10,
          activeGuests,
          todayArrivals,
          todayDepartures,
        },
        metrics: {
          bookings: {
            current: currentMonthBookings,
            previous: lastMonthBookings,
            change: Math.round(bookingChange * 10) / 10,
          },
          revenue: {
            current: currentMonthRevenue._sum.amount || 0,
            previous: lastMonthRevenue._sum.amount || 0,
            change: Math.round(revenueChange * 10) / 10,
          },
        },
        brands: brands.map((b) => ({
          id: b.id,
          name: b.name,
          code: b.code,
          logo: b.logo,
          primaryColor: b.primaryColor,
          propertyCount: b._count.properties,
          status: b.status,
        })),
        properties: propertyPerformance,
      },
    });
  } catch (error) {
    console.error('Error fetching chain dashboard:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch chain dashboard' } },
      { status: 500 }
    );
  }
}
