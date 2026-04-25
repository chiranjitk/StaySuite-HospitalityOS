import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/tenant-context';
import { db } from '@/lib/db';

// Cache for availability data (keys must include tenantId for isolation: `${tenantId}-${propertyId}` or `${tenantId}-${propertyId}-${date}`)
const availabilityCache = new Map<string, {
  data: unknown;
  timestamp: number;
  ttl: number;
}>();

function buildCacheKey(tenantId: string, propertyId: string, suffix?: string): string {
  return suffix ? `${tenantId}-${propertyId}-${suffix}` : `${tenantId}-${propertyId}`;
}

const CACHE_TTL = 30000; // 30 seconds cache TTL

/**
 * GET /api/availability
 * Get real-time availability by date range
 * 
 * Query params:
 * - propertyId: Filter by property
 * - startDate: Start date for availability check
 * - endDate: End date for availability check
 * - roomTypeId: Filter by room type (optional)
 * 
 * Requires authentication.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission(request, 'rooms.view');
    if (user instanceof NextResponse) return user;
    
    const tenantId = user.tenantId;
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const roomTypeId = searchParams.get('roomTypeId');

    // Validate required params
    if (!propertyId) {
      return NextResponse.json({
        success: false,
        error: { message: 'propertyId is required' }
      }, { status: 400 });
    }

    if (!startDate || !endDate) {
      return NextResponse.json({
        success: false,
        error: { message: 'startDate and endDate are required' }
      }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({
        success: false,
        error: { message: 'Invalid date format' }
      }, { status: 400 });
    }

    // Validate date range is reasonable (max 365 days)
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 365) {
      return NextResponse.json({
        success: false,
        error: { message: 'Date range cannot exceed 365 days' }
      }, { status: 400 });
    }

    // Get property info
    const property = await db.property.findFirst({
      where: { 
        id: propertyId,
        status: 'active',
      },
      select: { 
        id: true, 
        name: true, 
        checkInTime: true, 
        checkOutTime: true,
        currency: true,
        defaultTaxRate: true,
        tenantId: true, // Include for tenant validation
      }
    });

    if (!property) {
      return NextResponse.json({
        success: false,
        error: { message: 'Property not found or not available' }
      }, { status: 404 });
    }

    // Verify the property belongs to the user's tenant
    if (user.tenantId !== property.tenantId) {
      return NextResponse.json({
        success: false,
        error: { message: 'Access denied' }
      }, { status: 403 });
    }

    // Get all room types for the property
    const roomTypes = await db.roomType.findMany({
      where: {
        propertyId,
        status: 'active',
        ...(roomTypeId ? { id: roomTypeId } : {})
      },
      include: {
        rooms: {
          where: {
            status: { not: 'out_of_order' }
          }
        },
        ratePlans: {
          where: { status: 'active' },
          take: 1
        }
      }
    });

    // Get bookings that overlap with the date range
    const bookings = await db.booking.findMany({
      where: {
        propertyId,
        roomTypeId: roomTypeId || undefined,
        OR: [
          {
            checkIn: { lt: end },
            checkOut: { gt: start }
          }
        ],
        status: { in: ['confirmed', 'checked_in'] }
      },
      select: {
        id: true,
        roomTypeId: true,
        roomId: true,
        checkIn: true,
        checkOut: true,
        status: true,
        confirmationCode: true,
        primaryGuest: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // Get inventory locks
    const locks = await db.inventoryLock.findMany({
      where: {
        propertyId,
        OR: [
          {
            startDate: { lt: end },
            endDate: { gt: start }
          }
        ]
      }
    });

    // Calculate availability by room type
    const availabilityByRoomType = roomTypes.map(rt => {
      const totalRooms = rt.rooms.length;
      const availableRooms = rt.rooms.filter(r => r.status === 'available').length;
      const occupiedRooms = rt.rooms.filter(r => r.status === 'occupied').length;
      const maintenanceRooms = rt.rooms.filter(r => r.status === 'maintenance').length;
      const dirtyRooms = rt.rooms.filter(r => r.status === 'dirty').length;

      // Bookings for this room type in date range
      const rtBookings = bookings.filter(b => b.roomTypeId === rt.id);
      
      // Calculate availability for each day in range
      const dailyAvailability: Array<{
        date: string;
        available: number;
        booked: number;
        locked: number;
      }> = [];

      const currentDate = new Date(start);
      while (currentDate <= end) {
        const dateStr = currentDate.toISOString().split('T')[0];
        
        // Count bookings that include this date
        const dayStart = new Date(currentDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(currentDate);
        dayEnd.setHours(23, 59, 59, 999);

        const dayBookings = rtBookings.filter(b => {
          const checkIn = new Date(b.checkIn);
          const checkOut = new Date(b.checkOut);
          return checkIn <= dayEnd && checkOut > dayStart;
        });

        // Count locks for this day
        const dayLocks = locks.filter(l => {
          const lockStart = new Date(l.startDate);
          const lockEnd = new Date(l.endDate);
          return lockStart <= dayEnd && lockEnd > dayStart && 
                 (l.roomTypeId === rt.id || !l.roomTypeId);
        });

        const bookedCount = dayBookings.length;
        const lockedCount = dayLocks.length;
        const available = Math.max(0, totalRooms - bookedCount - lockedCount);

        dailyAvailability.push({
          date: dateStr,
          available,
          booked: bookedCount,
          locked: lockedCount
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Get base price from rate plan
      const basePrice = rt.ratePlans[0]?.basePrice || rt.basePrice;

      // Format bookings with guest info
      const formattedBookings = rtBookings.map(b => ({
        id: b.id,
        confirmationCode: b.confirmationCode,
        checkIn: b.checkIn.toISOString(),
        checkOut: b.checkOut.toISOString(),
        status: b.status,
        guestName: `${b.primaryGuest.firstName} ${b.primaryGuest.lastName}`,
      }));

      return {
        roomTypeId: rt.id,
        roomTypeName: rt.name,
        roomTypeCode: rt.code,
        maxOccupancy: rt.maxOccupancy,
        basePrice,
        currency: rt.currency,
        totalRooms,
        availableRooms,
        occupiedRooms,
        maintenanceRooms,
        dirtyRooms,
        occupancyRate: totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0,
        dailyAvailability,
        bookings: formattedBookings
      };
    });

    // Calculate overall stats
    const totalRooms = roomTypes.reduce((sum, rt) => sum + rt.rooms.length, 0);
    const totalAvailable = roomTypes.reduce((sum, rt) => 
      sum + rt.rooms.filter(r => r.status === 'available').length, 0);
    const totalOccupied = roomTypes.reduce((sum, rt) => 
      sum + rt.rooms.filter(r => r.status === 'occupied').length, 0);

    // Calculate availability for the first day in range
    const firstDayAvailable = availabilityByRoomType.reduce((sum, rt) => {
      const firstDay = rt.dailyAvailability[0];
      return sum + (firstDay?.available || 0);
    }, 0);

    // Build result
    const result = {
      property: {
        id: property.id,
        name: property.name,
        checkInTime: property.checkInTime,
        checkOutTime: property.checkOutTime,
        currency: property.currency,
      },
      dateRange: {
        startDate: start.toISOString(),
        endDate: end.toISOString()
      },
      summary: {
        totalRooms,
        availableRooms: totalAvailable,
        occupiedRooms: totalOccupied,
        maintenanceRooms: roomTypes.reduce((sum, rt) => 
          sum + rt.rooms.filter(r => r.status === 'maintenance').length, 0),
        dirtyRooms: roomTypes.reduce((sum, rt) => 
          sum + rt.rooms.filter(r => r.status === 'dirty').length, 0),
        occupancyRate: totalRooms > 0 ? Math.round((totalOccupied / totalRooms) * 100) : 0,
        availabilityRate: totalRooms > 0 ? Math.round((totalAvailable / totalRooms) * 100) : 0,
        firstDayAvailable
      },
      availabilityByRoomType,
      lastUpdated: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error('Error fetching availability:', error);
    return NextResponse.json({
      success: false,
      error: { message: 'Failed to fetch availability' }
    }, { status: 500 });
  }
}

/**
 * POST /api/availability/invalidate
 * Invalidate cache for a property's availability
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission(request, 'rooms.view');
    if (user instanceof NextResponse) return user;

    const body = await request.json();
    const { propertyId, roomTypeId } = body;

    if (!propertyId) {
      return NextResponse.json({
        success: false,
        error: { message: 'propertyId is required' }
      }, { status: 400 });
    }

    const property = await db.property.findFirst({
      where: { 
        id: propertyId,
        tenantId: user.tenantId,
      },
    });

    if (!property) {
      return NextResponse.json({
        success: false,
        error: { message: 'Property not found' }
      }, { status: 404 });
    }

    // Clear cache entries for this property (tenant-isolated)
    let clearedCount = 0;
    const cacheKeyPrefix = buildCacheKey(user.tenantId, propertyId);
    for (const key of availabilityCache.keys()) {
      if (key.startsWith(cacheKeyPrefix)) {
        if (roomTypeId) {
          // Only clear entries for this specific room type
          if (key.includes(roomTypeId)) {
            availabilityCache.delete(key);
            clearedCount++;
          }
        } else {
          // Clear all entries for this property
          availabilityCache.delete(key);
          clearedCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Cache invalidated',
      clearedEntries: clearedCount
    });

  } catch (error) {
    console.error('Error invalidating cache:', error);
    return NextResponse.json({
      success: false,
      error: { message: 'Failed to invalidate cache' }
    }, { status: 500 });
  }
}
