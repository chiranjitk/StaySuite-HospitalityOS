import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/floor-plans/[id]/rooms/[roomId] - Get a specific room's position on floor plan
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roomId: string }> }
) {
  try {
    const { id, roomId } = await params;
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

    const floorPlanRoom = await db.floorPlanRoom.findUnique({
      where: {
        floorPlanId_roomId: {
          floorPlanId: id,
          roomId,
        },
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

    if (!floorPlanRoom) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Room not found on this floor plan' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: floorPlanRoom,
    });
  } catch (error) {
    console.error('Error fetching floor plan room:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch floor plan room' } },
      { status: 500 }
    );
  }
}

// PUT /api/floor-plans/[id]/rooms/[roomId] - Update a room's position on the floor plan
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roomId: string }> }
) {
  try {
    const { id, roomId } = await params;
    const user = await requirePermission(request, 'rooms.manage');
    if (user instanceof NextResponse) return user;
    const tenantId = user.tenantId;
    const body = await request.json();

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

    // Check if room exists on this floor plan
    const existingRoom = await db.floorPlanRoom.findUnique({
      where: {
        floorPlanId_roomId: {
          floorPlanId: id,
          roomId,
        },
      },
    });

    if (!existingRoom) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Room not found on this floor plan' } },
        { status: 404 }
      );
    }

    // Prepare update data
    const data: Record<string, unknown> = {};

    if (body.x !== undefined) data.x = parseInt(body.x, 10);
    if (body.y !== undefined) data.y = parseInt(body.y, 10);
    if (body.width !== undefined) data.width = parseInt(body.width, 10);
    if (body.height !== undefined) data.height = parseInt(body.height, 10);
    if (body.rotation !== undefined) data.rotation = parseInt(body.rotation, 10);

    const floorPlanRoom = await db.floorPlanRoom.update({
      where: {
        floorPlanId_roomId: {
          floorPlanId: id,
          roomId,
        },
      },
      data,
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

    return NextResponse.json({ success: true, data: floorPlanRoom });
  } catch (error) {
    console.error('Error updating floor plan room:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update floor plan room' } },
      { status: 500 }
    );
  }
}

// DELETE /api/floor-plans/[id]/rooms/[roomId] - Remove a room from the floor plan
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roomId: string }> }
) {
  try {
    const { id, roomId } = await params;
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

    // Delete the floor plan room
    await db.floorPlanRoom.delete({
      where: {
        floorPlanId_roomId: {
          floorPlanId: id,
          roomId,
        },
      },
    });

    return NextResponse.json({ success: true, message: 'Room removed from floor plan' });
  } catch (error) {
    console.error('Error removing room from floor plan:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to remove room from floor plan' } },
      { status: 500 }
    );
  }
}
