import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/room-types - List all room types
export async function GET(request: NextRequest) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }


    // RBAC check
    if (!hasPermission(user, 'room-types.view') && !hasPermission(user, 'room-types.*') && user.roleName !== 'admin'
        && !hasPermission(user, 'housekeeping.view') && !hasPermission(user, 'tasks.view')) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    
    // Tenant isolation: only show room types for user's tenant via property
    const where: Record<string, unknown> = {
      deletedAt: null,
      property: {
        tenantId: user.tenantId,
      },
    };
    
    if (propertyId) {
      where.propertyId = propertyId;
    }
    
    if (status) {
      where.status = status;
    }
    
    const total = await db.roomType.count({ where });

    const roomTypes = await db.roomType.findMany({
      where,
      include: {
        property: {
          select: {
            id: true,
            name: true,
            currency: true,
          },
        },
        wifiPlan: {
          select: {
            id: true,
            name: true,
            downloadSpeed: true,
            uploadSpeed: true,
            validityDays: true,
            status: true,
          },
        },
        _count: {
          select: {
            rooms: true,
          },
        },
      },
      orderBy: [
        { propertyId: 'asc' },
        { sortOrder: 'asc' },
      ],
      take: limit,
      skip: offset,
    });
    
    // Get overbooking statistics
    const overbookingStats = await Promise.all(
      roomTypes.map(async (rt) => {
        // Count bookings for each room type
        const activeBookings = await db.booking.count({
          where: {
            roomTypeId: rt.id,
            status: { in: ['confirmed', 'checked_in'] },
            deletedAt: null,
          },
        });
        return {
          roomTypeId: rt.id,
          activeBookings,
        };
      })
    );
    const overbookingStatsMap = new Map(overbookingStats.map(s => [s.roomTypeId, s.activeBookings]));
    
    return NextResponse.json({
      success: true,
      pagination: { total, limit, offset },
      data: roomTypes.map((rt) => ({
        ...rt,
        totalRooms: rt._count.rooms,
        amenities: JSON.parse(rt.amenities),
        images: JSON.parse(rt.images),
        overbookingStats: {
          activeBookings: overbookingStatsMap.get(rt.id) || 0,
          availableForOverbooking: rt.overbookingEnabled 
            ? Math.min(rt.overbookingLimit, Math.ceil(rt._count.rooms * (rt.overbookingPercentage / 100)))
            : 0,
        },
      })),
    });
  } catch (error) {
    console.error('Error fetching room types:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch room types' } },
      { status: 500 }
    );
  }
}

// POST /api/room-types - Create a new room type
export async function POST(request: NextRequest) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }


    // RBAC check
    if (!hasPermission(user, 'room-types.create') && !hasPermission(user, 'room-types.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

  try {
    const body = await request.json();
    
    const {
      propertyId,
      name,
      code,
      description,
      maxAdults = 2,
      maxChildren = 0,
      maxOccupancy = 2,
      sizeSqMeters,
      sizeSqFeet,
      amenities = [],
      basePrice,
      currency = 'USD',
      images = [],
      sortOrder = 0,
      status = 'active',
      overbookingEnabled = false,
      overbookingPercentage = 0,
      overbookingLimit = 0,
      wifiPlanId,
    } = body;
    
    // Validate required fields
    if (!propertyId || !name || !code || basePrice === undefined) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } },
        { status: 400 }
      );
    }
    
    // Verify the property belongs to the user's tenant
    const property = await db.property.findUnique({
      where: { id: propertyId },
      select: { tenantId: true },
    });
    if (!property || property.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Property not found or not accessible' } },
        { status: 403 }
      );
    }

    // Check if code already exists for this property
    const existingRoomType = await db.roomType.findUnique({
      where: {
        propertyId_code: {
          propertyId,
          code,
        },
      },
    });
    
    if (existingRoomType) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_CODE', message: 'A room type with this code already exists' } },
        { status: 400 }
      );
    }
    
    const roomType = await db.roomType.create({
      data: {
        propertyId,
        name,
        code,
        description,
        maxAdults,
        maxChildren,
        maxOccupancy,
        sizeSqMeters: sizeSqMeters ? parseFloat(sizeSqMeters) : null,
        sizeSqFeet: sizeSqFeet ? parseFloat(sizeSqFeet) : null,
        amenities: JSON.stringify(amenities),
        basePrice: parseFloat(basePrice),
        currency,
        images: JSON.stringify(images),
        sortOrder,
        status,
        overbookingEnabled,
        overbookingPercentage: parseFloat(overbookingPercentage),
        overbookingLimit: parseInt(overbookingLimit, 10),
        ...(wifiPlanId && { wifiPlanId }),
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            currency: true,
          },
        },
        wifiPlan: {
          select: {
            id: true,
            name: true,
            downloadSpeed: true,
            uploadSpeed: true,
            validityDays: true,
            status: true,
          },
        },
      },
    });
    
    return NextResponse.json({ 
      success: true, 
      data: {
        ...roomType,
        amenities: JSON.parse(roomType.amenities),
        images: JSON.parse(roomType.images),
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating room type:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create room type' } },
      { status: 500 }
    );
  }
}
