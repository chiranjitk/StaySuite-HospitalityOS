import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/inventory-locks - List all inventory locks
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
    if (!hasPermission(user, 'inventory.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view inventory locks' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const roomId = searchParams.get('roomId');
    const roomTypeId = searchParams.get('roomTypeId');
    const lockType = searchParams.get('lockType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const active = searchParams.get('active');
    const limitParam = searchParams.get('limit');
    const offset = searchParams.get('offset');

    // Cap limit at 100
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 100;

    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
    };

    if (propertyId) {
      where.propertyId = propertyId;
    }

    if (roomId) {
      where.roomId = roomId;
    }

    if (roomTypeId) {
      where.roomTypeId = roomTypeId;
    }

    if (lockType) {
      where.lockType = lockType;
    }

    // Date range filter
    if (startDate || endDate) {
      if (startDate && endDate) {
        // Find locks that overlap with the given range
        where.OR = [
          {
            AND: [
              { startDate: { lte: new Date(endDate) } },
              { endDate: { gte: new Date(startDate) } },
            ],
          },
        ];
      } else if (startDate) {
        where.endDate = { gte: new Date(startDate) };
      } else if (endDate) {
        where.startDate = { lte: new Date(endDate) };
      }
    }

    // Filter for active locks (current date falls within lock period)
    if (active === 'true') {
      const now = new Date();
      where.AND = [
        { startDate: { lte: now } },
        { endDate: { gte: now } },
      ];
    }

    // Also filter for upcoming locks
    const upcoming = searchParams.get('upcoming') === 'true';
    if (upcoming) {
      const now = new Date();
      where.startDate = { gt: now };
    }

    const inventoryLocks = await db.inventoryLock.findMany({
      where,
      include: {
        room: {
          select: {
            id: true,
            number: true,
            floor: true,
            roomType: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
      orderBy: [
        { startDate: 'asc' },
      ],
      take: limit,
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    // Calculate lock duration and status
    const now = new Date();
    const transformedLocks = inventoryLocks.map(lock => {
      const isActive = lock.startDate <= now && lock.endDate >= now;
      const isUpcoming = lock.startDate > now;
      const isPast = lock.endDate < now;
      const durationDays = Math.ceil(
        (lock.endDate.getTime() - lock.startDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        ...lock,
        isActive,
        isUpcoming,
        isPast,
        durationDays,
        status: isActive ? 'active' : isUpcoming ? 'upcoming' : 'past',
      };
    });

    const total = await db.inventoryLock.count({ where });

    // Get lock type distribution
    const lockTypeDistribution = await db.inventoryLock.groupBy({
      by: ['lockType'],
      where: { tenantId: user.tenantId, ...(propertyId && { propertyId }) },
      _count: true,
    });

    return NextResponse.json({
      success: true,
      data: transformedLocks,
      pagination: {
        total,
        limit,
        offset: offset ? parseInt(offset, 10) : null,
      },
      stats: {
        totalLocks: total,
        activeLocks: transformedLocks.filter(l => l.isActive).length,
        upcomingLocks: transformedLocks.filter(l => l.isUpcoming).length,
        lockTypeDistribution: lockTypeDistribution.map(lt => ({
          lockType: lt.lockType,
          count: lt._count,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching inventory locks:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch inventory locks' } },
      { status: 500 }
    );
  }
}

// POST /api/inventory-locks - Create a new inventory lock with DB transaction for double booking prevention
export async function POST(request: NextRequest) {
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
    if (!hasPermission(user, 'inventory.update')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to create inventory locks' } },
        { status: 403 }
      );
    }

    const body = await request.json();

    const {
      propertyId,
      roomId,
      roomTypeId,
      startDate,
      endDate,
      reason,
      lockType = 'maintenance',
    } = body;

    // Validate required fields
    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Property ID is required' } },
        { status: 400 }
      );
    }

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Start and end dates are required' } },
        { status: 400 }
      );
    }

    if (!reason) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Reason is required' } },
        { status: 400 }
      );
    }

    // Validate that either roomId or roomTypeId is provided
    if (!roomId && !roomTypeId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Either room ID or room type ID is required' } },
        { status: 400 }
      );
    }

    // Verify property belongs to user's tenant
    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId: user.tenantId },
    });
    if (!property) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } },
        { status: 404 }
      );
    }

    // Validate dates
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    if (startDateObj >= endDateObj) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_DATES', message: 'End date must be after start date' } },
        { status: 400 }
      );
    }

    // Use transaction with database-level locking to prevent double booking
    const inventoryLock = await db.$transaction(async (tx) => {
      // Verify room exists if roomId is provided
      if (roomId) {
        const room = await tx.room.findFirst({
          where: { id: roomId, propertyId, deletedAt: null },
        });

        if (!room) {
          throw new Error('INVALID_ROOM:Room not found');
        }

        // Check for overlapping locks on the same room
        const overlappingLocks = await tx.inventoryLock.findMany({
          where: {
            tenantId: user.tenantId,
            roomId,
            AND: [
              { startDate: { lte: endDateObj } },
              { endDate: { gte: startDateObj } },
            ],
          },
        });

        if (overlappingLocks.length > 0) {
          throw new Error('OVERLAPPING_LOCK:An existing lock overlaps with the specified dates');
        }

        // Check for conflicting bookings if locking a specific room
        const conflictingBookings = await tx.booking.findMany({
          where: {
            tenantId: user.tenantId,
            roomId,
            status: { in: ['confirmed', 'checked_in'] },
            deletedAt: null,
            AND: [
              { checkIn: { lt: endDateObj } },
              { checkOut: { gt: startDateObj } },
            ],
          },
          include: {
            primaryGuest: {
              select: { firstName: true, lastName: true },
            },
          },
        });

        if (conflictingBookings.length > 0) {
          throw new Error(`CONFLICTING_BOOKINGS:Cannot create lock: room has active bookings during this period`);
        }
      }

      // Verify room type exists if roomTypeId is provided
      if (roomTypeId) {
        const roomType = await tx.roomType.findFirst({
          where: { id: roomTypeId, propertyId, deletedAt: null },
        });

        if (!roomType) {
          throw new Error('INVALID_ROOM_TYPE:Room type not found');
        }

        // Check for overlapping locks on the same room type
        const overlappingLocks = await tx.inventoryLock.findMany({
          where: {
            tenantId: user.tenantId,
            roomTypeId,
            AND: [
              { startDate: { lte: endDateObj } },
              { endDate: { gte: startDateObj } },
            ],
          },
        });

        if (overlappingLocks.length > 0) {
          throw new Error('OVERLAPPING_LOCK:An existing lock overlaps with the specified dates');
        }
      }

      // Create the inventory lock
      return tx.inventoryLock.create({
        data: {
          tenantId: user.tenantId,
          propertyId,
          roomId,
          roomTypeId,
          startDate: startDateObj,
          endDate: endDateObj,
          reason,
          lockType,
          createdBy: user.id,
        },
        include: {
          room: {
            select: {
              id: true,
              number: true,
              floor: true,
              roomType: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
        },
      });
    }, {
      // Set transaction options for better isolation
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });

    return NextResponse.json({ success: true, data: inventoryLock }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating inventory lock:', error);
    
    // Handle custom errors from transaction
    if (error instanceof Error) {
      const [code, message] = error.message.split(':');
      
      if (code === 'INVALID_ROOM') {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_ROOM', message: message || 'Room not found' } },
          { status: 400 }
        );
      }
      
      if (code === 'OVERLAPPING_LOCK') {
        return NextResponse.json(
          { success: false, error: { code: 'OVERLAPPING_LOCK', message: message || 'An existing lock overlaps with the specified dates' } },
          { status: 400 }
        );
      }
      
      if (code === 'CONFLICTING_BOOKINGS') {
        return NextResponse.json(
          { success: false, error: { code: 'CONFLICTING_BOOKINGS', message: message || 'Cannot create lock: room has active bookings during this period' } },
          { status: 400 }
        );
      }
      
      if (code === 'INVALID_ROOM_TYPE') {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_ROOM_TYPE', message: message || 'Room type not found' } },
          { status: 400 }
        );
      }
    }
    
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create inventory lock' } },
      { status: 500 }
    );
  }
}

// PUT /api/inventory-locks - Update an inventory lock
export async function PUT(request: NextRequest) {
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
    if (!hasPermission(user, 'inventory.update')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to update inventory locks' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    // Destructure out protected fields that must not be overwritten
    const { id, tenantId, createdAt, createdBy, updatedAt, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Inventory lock ID is required' } },
        { status: 400 }
      );
    }

    // Handle date fields
    if (updates.startDate) {
      updates.startDate = new Date(updates.startDate);
    }
    if (updates.endDate) {
      updates.endDate = new Date(updates.endDate);
    }

    // Validate dates if both are provided
    if (updates.startDate && updates.endDate && updates.startDate >= updates.endDate) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_DATES', message: 'End date must be after start date' } },
        { status: 400 }
      );
    }

    // Get existing lock and verify tenant
    const existingLock = await db.inventoryLock.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existingLock) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Inventory lock not found' } },
        { status: 404 }
      );
    }

    // Check for overlapping locks if dates are being changed
    const startDate = updates.startDate || existingLock.startDate;
    const endDate = updates.endDate || existingLock.endDate;
    const roomId = updates.roomId || existingLock.roomId;
    const roomTypeId = updates.roomTypeId || existingLock.roomTypeId;

    if (roomId) {
      const overlappingLocks = await db.inventoryLock.findMany({
        where: {
          id: { not: id },
          tenantId: user.tenantId,
          roomId,
          AND: [
            { startDate: { lte: endDate } },
            { endDate: { gte: startDate } },
          ],
        },
      });

      if (overlappingLocks.length > 0) {
        return NextResponse.json(
          { 
            success: false, 
            error: { 
              code: 'OVERLAPPING_LOCK', 
              message: 'An existing lock overlaps with the specified dates' 
            } 
          },
          { status: 400 }
        );
      }
    }

    if (roomTypeId && !roomId) {
      const overlappingLocks = await db.inventoryLock.findMany({
        where: {
          id: { not: id },
          tenantId: user.tenantId,
          roomTypeId,
          AND: [
            { startDate: { lte: endDate } },
            { endDate: { gte: startDate } },
          ],
        },
      });

      if (overlappingLocks.length > 0) {
        return NextResponse.json(
          { 
            success: false, 
            error: { 
              code: 'OVERLAPPING_LOCK', 
              message: 'An existing lock overlaps with the specified dates' 
            } 
          },
          { status: 400 }
        );
      }
    }

    const inventoryLock = await db.inventoryLock.update({
      where: { id },
      data: updates,
      include: {
        room: {
          select: {
            id: true,
            number: true,
            floor: true,
            roomType: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: inventoryLock });
  } catch (error) {
    console.error('Error updating inventory lock:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update inventory lock' } },
      { status: 500 }
    );
  }
}

// DELETE /api/inventory-locks - Delete inventory locks
export async function DELETE(request: NextRequest) {
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
    if (!hasPermission(user, 'inventory.update')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to delete inventory locks' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const ids = searchParams.get('ids')?.split(',');

    if (!ids || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Inventory lock IDs are required' } },
        { status: 400 }
      );
    }

    const results = await db.inventoryLock.deleteMany({
      where: {
        id: { in: ids },
        tenantId: user.tenantId,
      },
    });

    if (results.count === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'No inventory locks found or access denied' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Deleted ${results.count} inventory locks`,
    });
  } catch (error) {
    console.error('Error deleting inventory locks:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete inventory locks' } },
      { status: 500 }
    );
  }
}
