import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { randomBytes } from 'crypto';

/**
 * Generate a cryptographically secure digital key secret
 */
function generateSecureKeySecret(roomNumber: string): string {
  const randomPart = randomBytes(6).toString('hex').toUpperCase();
  const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
  return `DK-${roomNumber}-${randomPart}-${timestamp}`;
}

// GET /api/digital-keys - List all digital keys
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Check permission
    if (!hasPermission(user, 'digital_keys.view') && !hasPermission(user, 'digital_keys.*') && !hasPermission(user, 'frontdesk.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status');
    const roomId = searchParams.get('roomId');
    const bookingId = searchParams.get('bookingId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 100);

    // Get rooms with bookings to create digital keys view
    const bookings = await db.booking.findMany({
      where: {
        tenantId: user.tenantId,
        roomId: { not: null },
        status: { in: ['confirmed', 'checked_in'] },
        ...(propertyId && { propertyId }),
        ...(roomId && { roomId }),
        ...(bookingId && { id: bookingId }),
      },
      include: {
        room: {
          include: {
            roomType: {
              select: { name: true },
            },
          },
        },
        primaryGuest: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: { checkIn: 'desc' },
      take: limit,
    });

    // Transform into digital key format
    const digitalKeys = bookings.map((booking) => {
      const room = booking.room;
      const guest = booking.primaryGuest;
      const now = new Date();
      const checkOut = new Date(booking.checkOut);
      const checkIn = new Date(booking.checkIn);

      let keyStatus: 'active' | 'pending' | 'expired' | 'disabled' = 'pending';
      if (booking.status === 'checked_in') {
        if (checkOut < now) {
          keyStatus = 'expired';
        } else {
          keyStatus = room?.digitalKeyEnabled ? 'active' : 'disabled';
        }
      }

      // Filter by status if provided
      if (status && status !== keyStatus) {
        return null;
      }

      return {
        id: `key-${booking.id}`,
        roomId: room?.id,
        roomNumber: room?.number,
        roomType: room?.roomType?.name,
        floor: room?.floor,
        guestName: guest ? `${guest.firstName} ${guest.lastName}` : 'Unknown',
        bookingCode: booking.confirmationCode,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        keyEnabled: room?.digitalKeyEnabled ?? false,
        lastAccess: null,
        accessCount: 0,
        status: keyStatus,
      };
    }).filter(Boolean);

    // Calculate stats
    const stats = {
      total: digitalKeys.length,
      active: digitalKeys.filter((k) => k?.status === 'active').length,
      pending: digitalKeys.filter((k) => k?.status === 'pending').length,
      expired: digitalKeys.filter((k) => k?.status === 'expired').length,
      totalAccess: digitalKeys.reduce((sum, k) => sum + (k?.accessCount || 0), 0),
    };

    return NextResponse.json({
      success: true,
      data: digitalKeys,
      stats,
    });
  } catch (error) {
    console.error('Error fetching digital keys:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch digital keys' } },
      { status: 500 }
    );
  }
}

// PUT /api/digital-keys - Update digital key settings
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Check permission
    if (!hasPermission(user, 'digital_keys.update') && !hasPermission(user, 'digital_keys.*') && !hasPermission(user, 'frontdesk.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { roomId, keyEnabled, keySecret } = body;

    if (!roomId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Room ID is required' } },
        { status: 400 }
      );
    }

    // Get room and verify ownership through property
    const room = await db.room.findFirst({
      where: { id: roomId },
      include: { property: { select: { tenantId: true } } },
    });

    if (!room) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Room not found' } },
        { status: 404 }
      );
    }

    if (room.property.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied to this room' } },
        { status: 403 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (keyEnabled !== undefined) {
      updateData.digitalKeyEnabled = keyEnabled;
    }

    if (keySecret !== undefined) {
      updateData.digitalKeySecret = keySecret;
    }

    // Generate new key secret if enabling and no secret provided
    if (keyEnabled && !keySecret && !room.digitalKeySecret) {
      updateData.digitalKeySecret = generateSecureKeySecret(room.number);
    }

    const updatedRoom = await db.room.update({
      where: { id: roomId },
      data: updateData,
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        module: 'security',
        action: 'digital_key.updated',
        entityType: 'Room',
        entityId: roomId,
        newValue: JSON.stringify({
          roomNumber: updatedRoom.number,
          updates: { digitalKeyEnabled: keyEnabled, digitalKeySecret: updateData.digitalKeySecret ? '***' : undefined },
        }),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        roomId: updatedRoom.id,
        roomNumber: updatedRoom.number,
        keyEnabled: updatedRoom.digitalKeyEnabled,
      },
    });
  } catch (error) {
    console.error('Error updating digital key:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update digital key' } },
      { status: 500 }
    );
  }
}

// POST /api/digital-keys - Regenerate key
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Check permission
    if (!hasPermission(user, 'digital_keys.regenerate') && !hasPermission(user, 'digital_keys.*') && !hasPermission(user, 'frontdesk.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { roomId, action } = body;

    if (!roomId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Room ID is required' } },
        { status: 400 }
      );
    }

    if (action !== 'regenerate') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ACTION', message: 'Invalid action. Only "regenerate" is supported' } },
        { status: 400 }
      );
    }

    // Get room and verify ownership
    const room = await db.room.findFirst({
      where: { id: roomId },
      include: { property: { select: { tenantId: true } } },
    });

    if (!room) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Room not found' } },
        { status: 404 }
      );
    }

    if (room.property.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied to this room' } },
        { status: 403 }
      );
    }

    // Generate new secure key secret
    const newSecret = generateSecureKeySecret(room.number);

    const updatedRoom = await db.room.update({
      where: { id: roomId },
      data: { digitalKeySecret: newSecret },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        module: 'security',
        action: 'digital_key.regenerated',
        entityType: 'Room',
        entityId: roomId,
        newValue: JSON.stringify({
          roomNumber: room.number,
          previousKeyExists: !!room.digitalKeySecret,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        roomId: updatedRoom.id,
        roomNumber: updatedRoom.number,
      },
    });
  } catch (error) {
    console.error('Error regenerating digital key:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to regenerate digital key' } },
      { status: 500 }
    );
  }
}

// DELETE /api/digital-keys - Revoke/delete a digital key
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Check permission
    if (!hasPermission(user, 'digital_keys.delete') && !hasPermission(user, 'digital_keys.*') && !hasPermission(user, 'frontdesk.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');

    if (!roomId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Room ID is required' } },
        { status: 400 }
      );
    }

    // Get room and verify ownership through property
    const room = await db.room.findFirst({
      where: { id: roomId },
      include: { property: { select: { tenantId: true } } },
    });

    if (!room) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Room not found' } },
        { status: 404 }
      );
    }

    if (room.property.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied to this room' } },
        { status: 403 }
      );
    }

    if (!room.digitalKeyEnabled && !room.digitalKeySecret) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_KEY', message: 'No digital key exists for this room' } },
        { status: 404 }
      );
    }

    // Revoke the digital key by disabling it and clearing the secret
    const updatedRoom = await db.room.update({
      where: { id: roomId },
      data: {
        digitalKeyEnabled: false,
        digitalKeySecret: null,
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        module: 'security',
        action: 'digital_key.revoked',
        entityType: 'Room',
        entityId: roomId,
        newValue: JSON.stringify({
          roomNumber: room.number,
          previousKeyExists: !!room.digitalKeySecret,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        roomId: updatedRoom.id,
        roomNumber: updatedRoom.number,
        keyEnabled: updatedRoom.digitalKeyEnabled,
      },
      message: 'Digital key revoked successfully',
    });
  } catch (error) {
    console.error('Error revoking digital key:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to revoke digital key' } },
      { status: 500 }
    );
  }
}
