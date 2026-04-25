import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/inventory - Get inventory data for calendar
export async function GET(request: NextRequest) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    // RBAC check
    if (!hasPermission(user, 'inventory.view') && !hasPermission(user, 'inventory.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Property ID is required' } },
        { status: 400 }
      );
    }
    
    // Default to next 60 days if dates not provided
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    
    // Set to start of day
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    
    // Get room types with their rooms
    const roomTypes = await db.roomType.findMany({
      where: {
        propertyId,
        deletedAt: null,
        status: 'active',
      },
      include: {
        rooms: {
          where: { deletedAt: null },
        },
        ratePlans: {
          where: {
            deletedAt: null,
            status: 'active',
          },
          include: {
            priceOverrides: {
              where: {
                date: { gte: start, lte: end },
              },
            },
          },
        },
      },
    });
    
    // Get bookings for the date range
    const bookings = await db.booking.findMany({
      where: {
        propertyId,
        status: { in: ['confirmed', 'checked_in'] },
        OR: [
          { checkIn: { lte: end }, checkOut: { gte: start } },
        ],
      },
      select: {
        id: true,
        roomTypeId: true,
        checkIn: true,
        checkOut: true,
        status: true,
      },
    });
    
    // Calculate inventory for each day
    const inventoryData: Record<string, Record<string, { available: number; total: number; price: number }>> = {};
    
    // Generate all dates in range
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0];
      inventoryData[dateStr] = {};
      
      for (const roomType of roomTypes) {
        const totalRooms = roomType.rooms.length;
        
        // Count booked rooms for this date
        const bookedRooms = bookings.filter(b => {
          if (b.roomTypeId !== roomType.id) return false;
          const checkIn = new Date(b.checkIn);
          const checkOut = new Date(b.checkOut);
          return currentDate >= checkIn && currentDate < checkOut;
        }).length;
        
        const available = Math.max(0, totalRooms - bookedRooms);
        
        // Get base price from first active rate plan
        let price = roomType.basePrice;
        const activeRatePlan = roomType.ratePlans[0];
        if (activeRatePlan) {
          price = activeRatePlan.basePrice;
          
          // Check for price overrides
          const override = activeRatePlan.priceOverrides.find(
            po => new Date(po.date).toISOString().split('T')[0] === dateStr
          );
          if (override) {
            price = override.price;
          }
        }
        
        inventoryData[dateStr][roomType.id] = {
          available,
          total: totalRooms,
          price: Math.round(price),
        };
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Transform to array format for easier consumption
    const result = Object.entries(inventoryData).flatMap(([date, roomTypesData]) =>
      Object.entries(roomTypesData).map(([roomTypeId, data]) => ({
        date,
        roomTypeId,
        available: data.available,
        total: data.total,
        price: data.price,
      }))
    );
    
    return NextResponse.json({
      success: true,
      data: result,
      roomTypes: roomTypes.map(rt => ({
        id: rt.id,
        name: rt.name,
        code: rt.code,
        basePrice: rt.basePrice,
        totalRooms: rt.rooms.length,
      })),
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch inventory' } },
      { status: 500 }
    );
  }
}

// PATCH /api/inventory - Update room availability (close/open rooms for dates)
export async function PATCH(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  // RBAC check
  if (!hasPermission(user, 'inventory.manage') && !hasPermission(user, 'inventory.*') && user.roleName !== 'admin') {
    return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      propertyId,
      roomTypeId,
      date,
      action,
      available,
      startDate,
      endDate,
      minStay,
      maxStay,
      reason,
    } = body;

    // Validate required fields
    if (!propertyId || !roomTypeId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Property ID and Room Type ID are required' } },
        { status: 400 }
      );
    }

    // Verify room type belongs to property
    const roomType = await db.roomType.findFirst({
      where: { id: roomTypeId, propertyId, deletedAt: null },
      include: { rooms: { where: { deletedAt: null } } },
    });

    if (!roomType) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Room type not found' } },
        { status: 404 }
      );
    }

    const totalRooms = roomType.rooms.length;

    // If action is 'close', create InventoryLock records
    if (action === 'close') {
      const lockStart = startDate || date;
      const lockEnd = endDate || date;

      if (!lockStart || !lockEnd) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Date or date range is required' } },
          { status: 400 }
        );
      }

      const start = new Date(lockStart);
      start.setHours(0, 0, 0, 0);
      const end = new Date(lockEnd);
      end.setHours(23, 59, 59, 999);

      // Upsert inventory lock for the date range
      // Delete only existing locks matching the same lock type for this room type in the range
      const closeLockType = (body as Record<string, unknown>).lockType as string || 'maintenance';
      await db.inventoryLock.deleteMany({
        where: {
          tenantId: user.tenantId,
          propertyId,
          roomTypeId,
          startDate: { gte: start, lte: end },
          lockType: closeLockType,
        },
      });

      // Create a single lock covering the range
      await db.inventoryLock.create({
        data: {
          tenantId: user.tenantId,
          propertyId,
          roomTypeId,
          startDate: start,
          endDate: end,
          reason: reason || 'Manual closure',
          lockType: closeLockType,
          createdBy: user.id,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Availability closed for ${roomType.name} from ${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`,
        data: {
          roomTypeId,
          startDate: start,
          endDate: end,
          action: 'closed',
        },
      });
    }

    // If action is 'open', remove InventoryLock records
    if (action === 'open') {
      const lockStart = startDate || date;
      const lockEnd = endDate || date;

      if (!lockStart || !lockEnd) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Date or date range is required' } },
          { status: 400 }
        );
      }

      const start = new Date(lockStart);
      start.setHours(0, 0, 0, 0);
      const end = new Date(lockEnd);
      end.setHours(23, 59, 59, 999);

      const result = await db.inventoryLock.deleteMany({
        where: {
          tenantId: user.tenantId,
          propertyId,
          roomTypeId,
          startDate: { gte: start, lte: end },
        },
      });

      return NextResponse.json({
        success: true,
        message: `Availability opened for ${roomType.name} from ${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`,
        data: {
          roomTypeId,
          startDate: start,
          endDate: end,
          action: 'opened',
          locksRemoved: result.count,
        },
      });
    }

    // If 'available' is provided directly, update via InventoryLock
    if (available !== undefined) {
      const targetDate = date ? new Date(date) : new Date();
      targetDate.setHours(0, 0, 0, 0);

      // Remove existing lock for this date
      await db.inventoryLock.deleteMany({
        where: {
          tenantId: user.tenantId,
          propertyId,
          roomTypeId,
          startDate: { lte: targetDate },
          endDate: { gte: targetDate },
        },
      });

      // If available < total, create a lock
      if (available < totalRooms) {
        const roomsToClose = totalRooms - available;
        await db.inventoryLock.create({
          data: {
            tenantId: user.tenantId,
            propertyId,
            roomTypeId,
            startDate: targetDate,
            endDate: targetDate,
            reason: `Manual adjustment: ${roomsToClose} room(s) closed`,
            lockType: 'maintenance',
            createdBy: user.id,
          },
        });
      }

      // Update min/max stay on PriceOverride if provided
      if (minStay !== undefined || maxStay !== undefined) {
        const activeRatePlan = await db.ratePlan.findFirst({
          where: { roomTypeId, deletedAt: null, status: 'active' },
        });

        if (activeRatePlan) {
          const overrideData: Record<string, unknown> = {};
          if (minStay !== undefined) overrideData.minStay = minStay;
          if (maxStay !== undefined) overrideData.maxStay = maxStay;

          await db.priceOverride.upsert({
            where: {
              ratePlanId_date: {
                ratePlanId: activeRatePlan.id,
                date: targetDate,
              },
            },
            create: {
              ratePlanId: activeRatePlan.id,
              date: targetDate,
              price: activeRatePlan.basePrice,
              ...overrideData,
            },
            update: overrideData,
          });
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Availability updated successfully',
        data: {
          roomTypeId,
          date: targetDate.toISOString().split('T')[0],
          available,
          total: totalRooms,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Provide action (close/open) or available count' } },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating inventory:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update inventory' } },
      { status: 500 }
    );
  }
}
