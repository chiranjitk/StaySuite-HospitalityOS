import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/floor-plans/[id] - Get a single floor plan with all details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requirePermission(request, 'rooms.manage');
    if (user instanceof NextResponse) return user;
    const tenantId = user.tenantId;

    const floorPlan = await db.floorPlan.findFirst({
      where: {
        id,
        property: {
          tenantId,
        },
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            totalFloors: true,
          },
        },
        floorPlanRooms: {
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
        },
      },
    });

    if (!floorPlan) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Floor plan not found' } },
        { status: 404 }
      );
    }

    // Also get all rooms for this floor (for rooms not yet placed)
    const allFloorRooms = await db.room.findMany({
      where: {
        propertyId: floorPlan.propertyId,
        floor: floorPlan.floor,
        deletedAt: null,
      },
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
    });

    // Map placed room IDs for quick lookup
    const placedRoomIds = new Set(floorPlan.floorPlanRooms.map(fpr => fpr.roomId));

    // Separate placed and unplaced rooms
    const placedRooms = floorPlan.floorPlanRooms.map(fpr => ({
      ...fpr,
      room: {
        ...fpr.room,
        isPlaced: true,
      },
    }));

    const unplacedRooms = allFloorRooms
      .filter(room => !placedRoomIds.has(room.id))
      .map(room => ({
        ...room,
        isPlaced: false,
      }));

    return NextResponse.json({
      success: true,
      data: {
        ...floorPlan,
        placedRooms,
        unplacedRooms,
        allFloorRooms,
      },
    });
  } catch (error) {
    console.error('Error fetching floor plan:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch floor plan' } },
      { status: 500 }
    );
  }
}

// PUT /api/floor-plans/[id] - Update a floor plan
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requirePermission(request, 'rooms.manage');
    if (user instanceof NextResponse) return user;

    const body = await request.json();

    // Verify floor plan exists and belongs to tenant
    const existingFloorPlan = await db.floorPlan.findFirst({
      where: {
        id,
        property: { tenantId: user.tenantId },
      },
    });

    if (!existingFloorPlan) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Floor plan not found' } },
        { status: 404 }
      );
    }

    // Prepare update data
    const data: Record<string, unknown> = {};

    if (body.name !== undefined) data.name = body.name;
    if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl;
    if (body.svgData !== undefined) data.svgData = body.svgData;
    if (body.roomPositions !== undefined) data.roomPositions = JSON.stringify(body.roomPositions);
    if (body.width !== undefined) data.width = parseInt(body.width, 10);
    if (body.height !== undefined) data.height = parseInt(body.height, 10);
    if (body.gridSize !== undefined) data.gridSize = parseInt(body.gridSize, 10);

    const floorPlan = await db.floorPlan.update({
      where: { id },
      data,
      include: {
        property: {
          select: {
            id: true,
            name: true,
            totalFloors: true,
          },
        },
        floorPlanRooms: {
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
        },
      },
    });

    return NextResponse.json({ success: true, data: floorPlan });
  } catch (error) {
    console.error('Error updating floor plan:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update floor plan' } },
      { status: 500 }
    );
  }
}

// DELETE /api/floor-plans/[id] - Delete a floor plan
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requirePermission(request, 'rooms.manage');
    if (user instanceof NextResponse) return user;

    // Verify floor plan exists and belongs to tenant
    const existingFloorPlan = await db.floorPlan.findFirst({
      where: {
        id,
        property: { tenantId: user.tenantId },
      },
    });

    if (!existingFloorPlan) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Floor plan not found' } },
        { status: 404 }
      );
    }

    // Delete associated floor plan rooms first (cascade should handle this, but being explicit)
    await db.floorPlanRoom.deleteMany({
      where: { floorPlanId: id },
    });

    await db.floorPlan.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Floor plan deleted successfully' });
  } catch (error) {
    console.error('Error deleting floor plan:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete floor plan' } },
      { status: 500 }
    );
  }
}
