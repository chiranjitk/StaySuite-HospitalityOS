import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/floor-plans/[id]/rooms - Get all rooms for a floor plan
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requirePermission(request, 'rooms.manage');
    if (user instanceof NextResponse) return user;
    const tenantId = user.tenantId;

    // Verify floor plan exists and belongs to tenant
    const floorPlan = await db.floorPlan.findFirst({
      where: {
        id,
        property: {
          tenantId,
        },
      },
    });

    if (!floorPlan) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Floor plan not found' } },
        { status: 404 }
      );
    }

    // Get all floor plan rooms with room details
    const floorPlanRooms = await db.floorPlanRoom.findMany({
      where: {
        floorPlanId: id,
      },
      include: {
        room: {
          include: {
            roomType: {
              select: {
                id: true,
                name: true,
                code: true,
                basePrice: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: floorPlanRooms,
    });
  } catch (error) {
    console.error('Error fetching floor plan rooms:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch floor plan rooms' } },
      { status: 500 }
    );
  }
}

// POST /api/floor-plans/[id]/rooms - Add a room to the floor plan
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requirePermission(request, 'rooms.manage');
    if (user instanceof NextResponse) return user;
    const tenantId = user.tenantId;
    const body = await request.json();

    const {
      roomId,
      x,
      y,
      width = 80,
      height = 60,
      rotation = 0,
    } = body;

    // Validate required fields
    if (!roomId || x === undefined || y === undefined) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Room ID, x, and y are required' } },
        { status: 400 }
      );
    }

    // Verify floor plan exists and belongs to tenant
    const floorPlan = await db.floorPlan.findFirst({
      where: {
        id,
        property: {
          tenantId,
        },
      },
    });

    if (!floorPlan) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Floor plan not found' } },
        { status: 404 }
      );
    }

    // Check if room is already on this floor plan
    const existingRoom = await db.floorPlanRoom.findUnique({
      where: {
        floorPlanId_roomId: {
          floorPlanId: id,
          roomId,
        },
      },
    });

    if (existingRoom) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_ROOM', message: 'Room is already on this floor plan' } },
        { status: 400 }
      );
    }

    // Verify room exists and belongs to the same property
    const room = await db.room.findFirst({
      where: {
        id: roomId,
        propertyId: floorPlan.propertyId,
        deletedAt: null,
      },
    });

    if (!room) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ROOM', message: 'Room not found or does not belong to this property' } },
        { status: 400 }
      );
    }

    // Create the floor plan room
    const floorPlanRoom = await db.floorPlanRoom.create({
      data: {
        floorPlanId: id,
        roomId,
        x: parseInt(x, 10),
        y: parseInt(y, 10),
        width: parseInt(width, 10),
        height: parseInt(height, 10),
        rotation: parseInt(rotation, 10),
      },
      include: {
        room: {
          include: {
            roomType: {
              select: {
                id: true,
                name: true,
                code: true,
                basePrice: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: floorPlanRoom }, { status: 201 });
  } catch (error) {
    console.error('Error adding room to floor plan:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to add room to floor plan' } },
      { status: 500 }
    );
  }
}

// DELETE /api/floor-plans/[id]/rooms - Remove all rooms from a floor plan
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requirePermission(request, 'rooms.manage');
    if (user instanceof NextResponse) return user;
    const tenantId = user.tenantId;

    // Verify floor plan exists and belongs to tenant
    const floorPlan = await db.floorPlan.findFirst({
      where: {
        id,
        property: {
          tenantId,
        },
      },
    });

    if (!floorPlan) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Floor plan not found' } },
        { status: 404 }
      );
    }

    // Delete all rooms from the floor plan
    await db.floorPlanRoom.deleteMany({
      where: {
        floorPlanId: id,
      },
    });

    return NextResponse.json({ success: true, message: 'All rooms removed from floor plan' });
  } catch (error) {
    console.error('Error removing rooms from floor plan:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to remove rooms from floor plan' } },
      { status: 500 }
    );
  }
}
