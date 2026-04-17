import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/room-types/[id] - Get a single room type
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    // RBAC check
    if (!hasPermission(user, 'room-types.view') && !hasPermission(user, 'room-types.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

  try {
    const { id } = await params;
    
    const roomType = await db.roomType.findUnique({
      where: { id, deletedAt: null },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            currency: true,
            tenantId: true,
          },
        },
        rooms: {
          where: { deletedAt: null },
        },
        _count: {
          select: {
            rooms: true,
          },
        },
      },
    });
    
    if (!roomType) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Room type not found' } },
        { status: 404 }
      );
    }

    // Tenant isolation: verify room type belongs to user's tenant
    if (roomType.property.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Room type not accessible' } },
        { status: 403 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: {
        ...roomType,
        totalRooms: roomType._count.rooms,
        amenities: JSON.parse(roomType.amenities),
        images: JSON.parse(roomType.images),
      },
    });
  } catch (error) {
    console.error('Error fetching room type:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch room type' } },
      { status: 500 }
    );
  }
}

// PUT /api/room-types/[id] - Update a room type
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    // RBAC check
    if (!hasPermission(user, 'room-types.update') && !hasPermission(user, 'room-types.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

  try {
    const { id } = await params;
    const body = await request.json();
    
    const existingRoomType = await db.roomType.findUnique({
      where: { id, deletedAt: null },
      include: {
        property: {
          select: { tenantId: true },
        },
      },
    });
    
    if (!existingRoomType) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Room type not found' } },
        { status: 404 }
      );
    }

    // Tenant isolation: verify room type belongs to user's tenant
    if (existingRoomType.property.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Room type not accessible' } },
        { status: 403 }
      );
    }
    
    const {
      name,
      code,
      description,
      maxAdults,
      maxChildren,
      maxOccupancy,
      sizeSqMeters,
      sizeSqFeet,
      amenities,
      basePrice,
      currency,
      images,
      sortOrder,
      status,
      overbookingEnabled,
      overbookingPercentage,
      overbookingLimit,
    } = body;
    
    // If code is being changed, check for conflicts
    if (code && code !== existingRoomType.code) {
      const codeConflict = await db.roomType.findUnique({
        where: {
          propertyId_code: {
            propertyId: existingRoomType.propertyId,
            code,
          },
        },
      });
      
      if (codeConflict) {
        return NextResponse.json(
          { success: false, error: { code: 'DUPLICATE_CODE', message: 'A room type with this code already exists' } },
          { status: 400 }
        );
      }
    }
    
    const roomType = await db.roomType.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(code && { code }),
        ...(description !== undefined && { description }),
        ...(maxAdults !== undefined && { maxAdults }),
        ...(maxChildren !== undefined && { maxChildren }),
        ...(maxOccupancy !== undefined && { maxOccupancy }),
        ...(sizeSqMeters !== undefined && { sizeSqMeters: sizeSqMeters ? parseFloat(sizeSqMeters) : null }),
        ...(sizeSqFeet !== undefined && { sizeSqFeet: sizeSqFeet ? parseFloat(sizeSqFeet) : null }),
        ...(amenities !== undefined && { amenities: JSON.stringify(amenities) }),
        ...(basePrice !== undefined && { basePrice: parseFloat(basePrice) }),
        ...(currency && { currency }),
        ...(images !== undefined && { images: JSON.stringify(images) }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(status && { status }),
        ...(overbookingEnabled !== undefined && { overbookingEnabled }),
        ...(overbookingPercentage !== undefined && { overbookingPercentage: parseFloat(overbookingPercentage) }),
        ...(overbookingLimit !== undefined && { overbookingLimit: parseInt(overbookingLimit, 10) }),
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            currency: true,
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
    });
  } catch (error) {
    console.error('Error updating room type:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update room type' } },
      { status: 500 }
    );
  }
}

// DELETE /api/room-types/[id] - Soft delete a room type
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    // RBAC check
    if (!hasPermission(user, 'room-types.delete') && !hasPermission(user, 'room-types.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

  try {
    const { id } = await params;
    
    const existingRoomType = await db.roomType.findUnique({
      where: { id, deletedAt: null },
      include: {
        property: {
          select: { tenantId: true },
        },
        _count: {
          select: {
            rooms: true,
          },
        },
      },
    });
    
    if (!existingRoomType) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Room type not found' } },
        { status: 404 }
      );
    }

    // Tenant isolation: verify room type belongs to user's tenant
    if (existingRoomType.property.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Room type not accessible' } },
        { status: 403 }
      );
    }
    
    // Check if there are rooms associated with this room type
    if (existingRoomType._count.rooms > 0) {
      return NextResponse.json(
        { success: false, error: { code: 'HAS_ROOMS', message: 'Cannot delete room type with associated rooms' } },
        { status: 400 }
      );
    }
    
    // Soft delete
    await db.roomType.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Error deleting room type:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete room type' } },
      { status: 500 }
    );
  }
}
