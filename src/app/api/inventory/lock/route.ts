import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import crypto from 'crypto';

// Default lock duration in minutes
const DEFAULT_LOCK_DURATION_MINUTES = 15;
const MAX_LOCK_DURATION_MINUTES = 60;

// Generate a unique session ID
function generateSessionId(): string {
  return `lock_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

// Calculate expiry time
function calculateExpiry(durationMinutes: number = DEFAULT_LOCK_DURATION_MINUTES): Date {
  const minutes = Math.min(durationMinutes, MAX_LOCK_DURATION_MINUTES);
  return new Date(Date.now() + minutes * 60 * 1000);
}

// GET /api/inventory/lock - Get locks for a session or check lock status
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
    const sessionId = searchParams.get('sessionId');
    const propertyId = searchParams.get('propertyId');
    const roomId = searchParams.get('roomId');
    const roomTypeId = searchParams.get('roomTypeId');
    const checkIn = searchParams.get('checkIn');
    const checkOut = searchParams.get('checkOut');
    const active = searchParams.get('active');

    const where: Record<string, unknown> = {
      lockType: 'booking_session',
      tenantId: user.tenantId,
    };

    // If sessionId is provided, get all locks for that session
    if (sessionId) {
      where.sessionId = sessionId;
    }

    if (propertyId) {
      where.propertyId = propertyId;
    }

    if (roomId) {
      where.roomId = roomId;
    }

    if (roomTypeId) {
      where.roomTypeId = roomTypeId;
    }

    // Filter for active locks (not expired)
    if (active === 'true') {
      where.expiresAt = { gt: new Date() };
    }

    // If checking availability for specific dates
    if (checkIn && checkOut) {
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);
      
      // Build query to find conflicting locks
      const conflictingQuery: Record<string, unknown> = {
        lockType: 'booking_session',
        tenantId: user.tenantId,
        expiresAt: { gt: new Date() }, // Only non-expired locks
        OR: [
          {
            AND: [
              { startDate: { lt: checkOutDate } },
              { endDate: { gt: checkInDate } },
            ],
          },
        ],
      };

      if (propertyId) conflictingQuery.propertyId = propertyId;
      if (roomId) conflictingQuery.roomId = roomId;
      if (roomTypeId) conflictingQuery.roomTypeId = roomTypeId;
      if (sessionId) conflictingQuery.sessionId = { not: sessionId }; // Exclude own locks

      const conflictingLocks = await db.inventoryLock.findMany({
        where: conflictingQuery,
        include: {
          room: {
            select: {
              id: true,
              number: true,
              floor: true,
            },
          },
          roomType: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          hasConflicts: conflictingLocks.length > 0,
          conflictingLocks,
          isAvailable: conflictingLocks.length === 0,
        },
      });
    }

    const locks = await db.inventoryLock.findMany({
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
        roomType: {
          select: {
            id: true,
            name: true,
            code: true,
            basePrice: true,
          },
        },
        property: {
          select: {
            id: true,
            name: true,
            currency: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate remaining time for each lock
    const now = new Date();
    const locksWithExpiry = locks.map(lock => ({
      ...lock,
      isExpired: lock.expiresAt ? lock.expiresAt < now : false,
      remainingSeconds: lock.expiresAt 
        ? Math.max(0, Math.floor((lock.expiresAt.getTime() - now.getTime()) / 1000))
        : null,
    }));

    return NextResponse.json({
      success: true,
      data: locksWithExpiry,
    });
  } catch (error) {
    console.error('Error fetching inventory locks:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch inventory locks' } },
      { status: 500 }
    );
  }
}

// POST /api/inventory/lock - Create a new booking session lock
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
    if (!hasPermission(user, 'bookings.create')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to create booking locks' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    const {
      propertyId,
      roomId,
      roomTypeId,
      checkIn,
      checkOut,
      sessionId: providedSessionId,
      durationMinutes = DEFAULT_LOCK_DURATION_MINUTES,
    } = body;

    // Validate required fields
    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Property ID is required' } },
        { status: 400 }
      );
    }

    if (!checkIn || !checkOut) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Check-in and check-out dates are required' } },
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
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    if (checkInDate >= checkOutDate) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_DATES', message: 'Check-out must be after check-in' } },
        { status: 400 }
      );
    }

    if (checkInDate < new Date()) {
      return NextResponse.json(
        { success: false, error: { code: 'PAST_CHECKIN', message: 'Check-in date cannot be in the past' } },
        { status: 400 }
      );
    }

    // Generate or use provided session ID
    const sessionId = providedSessionId || generateSessionId();
    const expiresAt = calculateExpiry(durationMinutes);

    // Use transaction for atomic lock creation with conflict checking
    const result = await db.$transaction(async (tx) => {
      // Clean up expired locks first
      await tx.inventoryLock.deleteMany({
        where: {
          lockType: 'booking_session',
          tenantId: user.tenantId,
          expiresAt: { lt: new Date() },
        },
      });

      // Check for conflicting locks (excluding own session locks)
      const conflictingQuery: Record<string, unknown> = {
        lockType: 'booking_session',
        tenantId: user.tenantId,
        expiresAt: { gt: new Date() },
        sessionId: { not: sessionId },
        AND: [
          { startDate: { lt: checkOutDate } },
          { endDate: { gt: checkInDate } },
        ],
      };

      if (roomId) conflictingQuery.roomId = roomId;
      if (roomTypeId) conflictingQuery.roomTypeId = roomTypeId;

      const existingLocks = await tx.inventoryLock.findMany({
        where: conflictingQuery,
      });

      if (existingLocks.length > 0) {
        throw new Error('LOCK_CONFLICT');
      }

      // Check for conflicting bookings
      const bookingQuery: Record<string, unknown> = {
        tenantId: user.tenantId,
        status: { in: ['confirmed', 'checked_in'] },
        deletedAt: null,
        AND: [
          { checkIn: { lt: checkOutDate } },
          { checkOut: { gt: checkInDate } },
        ],
      };

      if (roomId) bookingQuery.roomId = roomId;

      const existingBookings = await tx.booking.findMany({
        where: bookingQuery,
        include: {
          primaryGuest: {
            select: { firstName: true, lastName: true },
          },
        },
      });

      if (existingBookings.length > 0) {
        throw new Error('BOOKING_CONFLICT');
      }

      // Check for maintenance locks
      const maintenanceQuery: Record<string, unknown> = {
        tenantId: user.tenantId,
        lockType: { in: ['maintenance', 'event', 'overbooking'] },
        AND: [
          { startDate: { lt: checkOutDate } },
          { endDate: { gt: checkInDate } },
        ],
      };

      if (roomId) maintenanceQuery.roomId = roomId;
      if (roomTypeId) maintenanceQuery.roomTypeId = roomTypeId;

      const maintenanceLocks = await tx.inventoryLock.findMany({
        where: maintenanceQuery,
      });

      if (maintenanceLocks.length > 0) {
        throw new Error('MAINTENANCE_CONFLICT');
      }

      // Create the lock
      const lock = await tx.inventoryLock.create({
        data: {
          tenantId: user.tenantId,
          propertyId,
          roomId,
          roomTypeId,
          startDate: checkInDate,
          endDate: checkOutDate,
          reason: 'Booking session lock',
          lockType: 'booking_session',
          sessionId,
          expiresAt,
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
          roomType: {
            select: {
              id: true,
              name: true,
              code: true,
              basePrice: true,
            },
          },
        },
      });

      return lock;
    });

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        remainingSeconds: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating inventory lock:', error);
    
    if (error instanceof Error) {
      if (error.message === 'LOCK_CONFLICT') {
        return NextResponse.json(
          { 
            success: false, 
            error: { 
              code: 'LOCK_CONFLICT', 
              message: 'Another user is currently booking this room/room type. Please try again in a few minutes.' 
            } 
          },
          { status: 409 }
        );
      }
      if (error.message === 'BOOKING_CONFLICT') {
        return NextResponse.json(
          { 
            success: false, 
            error: { 
              code: 'BOOKING_CONFLICT', 
              message: 'This room is already booked for the selected dates.' 
            } 
          },
          { status: 409 }
        );
      }
      if (error.message === 'MAINTENANCE_CONFLICT') {
        return NextResponse.json(
          { 
            success: false, 
            error: { 
              code: 'MAINTENANCE_CONFLICT', 
              message: 'This room/room type is under maintenance or blocked for the selected dates.' 
            } 
          },
          { status: 409 }
        );
      }
    }
    
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create inventory lock' } },
      { status: 500 }
    );
  }
}

// PUT /api/inventory/lock - Extend lock duration (heartbeat)
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
    if (!hasPermission(user, 'bookings.update')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to extend locks' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { sessionId, additionalMinutes = DEFAULT_LOCK_DURATION_MINUTES } = body;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Session ID is required' } },
        { status: 400 }
      );
    }

    // Find all locks for this session that belong to user's tenant
    const locks = await db.inventoryLock.findMany({
      where: {
        sessionId,
        tenantId: user.tenantId,
        lockType: 'booking_session',
        expiresAt: { gt: new Date() }, // Only extend non-expired locks
      },
    });

    if (locks.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_LOCKS_FOUND', message: 'No active locks found for this session' } },
        { status: 404 }
      );
    }

    // Calculate new expiry time
    const newExpiry = calculateExpiry(additionalMinutes);

    // Update all locks for this session
    const updatedLocks = await db.inventoryLock.updateMany({
      where: {
        sessionId,
        tenantId: user.tenantId,
        lockType: 'booking_session',
      },
      data: {
        expiresAt: newExpiry,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        updatedCount: updatedLocks.count,
        newExpiry,
        remainingSeconds: Math.floor((newExpiry.getTime() - Date.now()) / 1000),
      },
    });
  } catch (error) {
    console.error('Error extending inventory lock:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to extend inventory lock' } },
      { status: 500 }
    );
  }
}

// DELETE /api/inventory/lock - Release lock(s)
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
    if (!hasPermission(user, 'bookings.update')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to release locks' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('sessionId');
    const lockIds = searchParams.get('ids')?.split(',');

    if (!sessionId && (!lockIds || lockIds.length === 0)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Session ID or lock IDs are required' } },
        { status: 400 }
      );
    }

    let whereClause: Record<string, unknown> = {
      lockType: 'booking_session',
      tenantId: user.tenantId,
    };

    if (sessionId) {
      whereClause.sessionId = sessionId;
    } else if (lockIds) {
      whereClause.id = { in: lockIds };
    }

    const result = await db.inventoryLock.deleteMany({
      where: whereClause,
    });

    return NextResponse.json({
      success: true,
      message: `Released ${result.count} lock(s)`,
      deletedCount: result.count,
    });
  } catch (error) {
    console.error('Error releasing inventory lock:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to release inventory lock' } },
      { status: 500 }
    );
  }
}
