import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, hasPermission } from '@/lib/auth/tenant-context';

// GET /api/chain/analytics - Cross-property analytics
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const user = await requirePermission(request, 'chain.view'); if (user instanceof NextResponse) return user;
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // requirePermission already validated 'chain.view', no need for double-check
    // The redundant hasPermission check below is removed since requirePermission already ensures the user has 'chain.view' permission

    const searchParams = request.nextUrl.searchParams;
    const tenantId = user.tenantId; // Use authenticated user's tenant
    const brandId = searchParams.get('brandId');
    const period = searchParams.get('period') || 'month'; // day, week, month, year

    // Calculate date range based on period
    const today = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'day': {
        const now = new Date();
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        break;
      }
      case 'week': {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        startDate = weekAgo;
        break;
      }
      case 'year': {
        const yearAgo = new Date();
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        startDate = yearAgo;
        break;
      }
      default: { // month
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        startDate = monthAgo;
        break;
      }
    }

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
        rooms: true,
        roomTypes: true,
      },
    });

    const propertyIds = properties.map((p) => p.id);

    // Get bookings for analysis
    const bookings = await db.booking.findMany({
      where: {
        propertyId: { in: propertyIds },
        createdAt: { gte: startDate },
        status: { notIn: ['draft', 'cancelled'] },
      },
      include: {
        primaryGuest: true,
      },
    });

    // Get payments for revenue analysis
    const payments = await db.payment.findMany({
      where: {
        folio: {
          booking: {
            propertyId: { in: propertyIds },
          },
        },
        status: 'completed',
        processedAt: { gte: startDate },
      },
    });

    // Revenue by property - batch query optimization
    // Get all property payments in one aggregation
    const allPropertyPayments = await db.payment.findMany({
      where: {
        folio: {
          booking: {
            propertyId: { in: propertyIds },
          },
        },
        status: 'completed',
        processedAt: { gte: startDate },
      },
      include: {
        folio: {
          select: {
            booking: {
              select: { propertyId: true },
            },
          },
        },
      },
    });

    // Aggregate payments by property
    const paymentByProperty = new Map<string, number>();
    for (const p of allPropertyPayments) {
      const propId = p.folio?.booking?.propertyId;
      if (propId) {
        paymentByProperty.set(propId, (paymentByProperty.get(propId) || 0) + (p.amount || 0));
      }
    }

    // Count bookings by property
    const bookingByProperty = new Map<string, number>();
    for (const booking of bookings) {
      bookingByProperty.set(booking.propertyId, (bookingByProperty.get(booking.propertyId) || 0) + 1);
    }

    // Get occupied rooms per property
    const checkedInAll = await db.booking.findMany({
      where: {
        propertyId: { in: propertyIds },
        status: 'checked_in',
        roomId: { not: null },
      },
      select: { propertyId: true, roomId: true },
    });

    const occupiedRoomsByProperty = new Map<string, Set<string>>();
    for (const b of checkedInAll) {
      if (!occupiedRoomsByProperty.has(b.propertyId)) {
        occupiedRoomsByProperty.set(b.propertyId, new Set());
      }
      if (b.roomId) {
        occupiedRoomsByProperty.get(b.propertyId)!.add(b.roomId);
      }
    }

    const revenueByProperty = properties.map((property) => {
      const propRooms = property.rooms.length;
      const occupiedRoomSet = occupiedRoomsByProperty.get(property.id) || new Set<string>();
      const occupiedCount = occupiedRoomSet.size;
      const propRevenue = paymentByProperty.get(property.id) || 0;
      const propBookings = bookingByProperty.get(property.id) || 0;

      return {
        propertyId: property.id,
        propertyName: property.name,
        propertyType: property.type,
        city: property.city,
        country: property.country,
        brandId: property.brandId,
        revenue: propRevenue,
        bookings: propBookings,
        totalRooms: propRooms,
        occupancyRate: propRooms > 0 ? (occupiedCount / propRooms) * 100 : 0,
        adr: propBookings > 0 ? propRevenue / propBookings : 0,
      };
    });

    // Revenue by brand - batch query optimization
    // Already have paymentByProperty from above, use it
    const brands = await db.brand.findMany({
      where: { tenantId },
    });

    const revenueByBrand = brands.map((brand) => {
      const brandProperties = properties.filter((p) => p.brandId === brand.id);
      const brandPropertyIds = brandProperties.map((p) => p.id);

      let brandRevenue = 0;
      let brandBookings = 0;
      for (const propId of brandPropertyIds) {
        brandRevenue += paymentByProperty.get(propId) || 0;
        brandBookings += bookingByProperty.get(propId) || 0;
      }

      return {
        brandId: brand.id,
        brandName: brand.name,
        brandCode: brand.code,
        propertyCount: brandProperties.length,
        revenue: brandRevenue,
        bookings: brandBookings,
        avgRevenuePerProperty: brandProperties.length > 0 
          ? brandRevenue / brandProperties.length 
          : 0,
      };
    });

    // Booking source breakdown
    const sourceBreakdown: Record<string, number> = {};
    bookings.forEach((booking) => {
      sourceBreakdown[booking.source] = (sourceBreakdown[booking.source] || 0) + 1;
    });

    // Guest demographics
    const guestNationalities: Record<string, number> = {};
    bookings.forEach((booking) => {
      if (booking.primaryGuest?.nationality) {
        guestNationalities[booking.primaryGuest.nationality] = 
          (guestNationalities[booking.primaryGuest.nationality] || 0) + 1;
      }
    });

    // Daily revenue trend
    const dailyRevenue: Record<string, number> = {};
    payments.forEach((payment) => {
      if (payment.processedAt) {
        const dateKey = payment.processedAt.toISOString().split('T')[0];
        dailyRevenue[dateKey] = (dailyRevenue[dateKey] || 0) + (payment.amount || 0);
      }
    });

    // Room type performance - batch query
    const allRoomTypes = await db.roomType.findMany({
      where: { propertyId: { in: propertyIds } },
      include: {
        _count: {
          select: { rooms: true, bookings: true },
        },
      },
    });

    const roomTypePerformance = allRoomTypes.map((rt) => ({
      propertyId: rt.propertyId,
      propertyName: properties.find(p => p.id === rt.propertyId)?.name || 'Unknown',
      roomTypeId: rt.id,
      roomTypeName: rt.name,
      totalRooms: rt._count.rooms,
      totalBookings: rt._count.bookings,
      basePrice: rt.basePrice,
    }));

    // Performance rankings
    const topPerformers = {
      byRevenue: [...revenueByProperty]
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5),
      byOccupancy: [...revenueByProperty]
        .sort((a, b) => b.occupancyRate - a.occupancyRate)
        .slice(0, 5),
      byBookings: [...revenueByProperty]
        .sort((a, b) => b.bookings - a.bookings)
        .slice(0, 5),
    };

    // Summary stats
    const totalRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalBookings = bookings.length;
    // Occupancy: count distinct rooms, not bookings
    const occupiedRoomIds = new Set(
      bookings.filter((b) => b.status === 'checked_in' && b.roomId).map((b) => b.roomId)
    );
    const totalRooms = properties.reduce((sum, p) => sum + p.rooms.length, 0);
    const occupiedRooms = occupiedRoomIds.size;

    return NextResponse.json({
      success: true,
      data: {
        period,
        dateRange: {
          start: startDate,
          end: new Date(),
        },
        summary: {
          totalProperties: properties.length,
          totalBrands: brands.length,
          totalRooms,
          totalBookings,
          totalRevenue,
          averageOccupancy: totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0,
          averageADR: totalBookings > 0 ? totalRevenue / totalBookings : 0,
        },
        revenueByProperty,
        revenueByBrand,
        sourceBreakdown: Object.entries(sourceBreakdown).map(([source, count]) => ({
          source,
          count,
          percentage: totalBookings > 0 ? (count / totalBookings) * 100 : 0,
        })),
        guestDemographics: {
          nationalities: Object.entries(guestNationalities)
            .map(([nationality, count]) => ({
              nationality,
              count,
              percentage: bookings.length > 0 ? (count / bookings.length) * 100 : 0,
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10),
        },
        dailyRevenue: Object.entries(dailyRevenue)
          .map(([date, revenue]) => ({ date, revenue }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        roomTypePerformance: roomTypePerformance.flat(),
        topPerformers,
      },
    });
  } catch (error) {
    console.error('Error fetching chain analytics:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch chain analytics' } },
      { status: 500 }
    );
  }
}
