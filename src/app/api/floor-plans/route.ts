import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/floor-plans - List all floor plans
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission(request, 'rooms.manage');
    if (user instanceof NextResponse) return user;
    const tenantId = user.tenantId;
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const floor = searchParams.get('floor');
    const id = searchParams.get('id');

    // Get by ID
    if (id) {
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
        },
      });

      if (!floorPlan) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Floor plan not found' } },
          { status: 404 }
        );
      }

      // Get rooms for this floor
      const rooms = await db.room.findMany({
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

      return NextResponse.json({
        success: true,
        data: {
          ...floorPlan,
          rooms,
        },
      });
    }

    const where: Record<string, unknown> = {};

    if (propertyId) {
      where.propertyId = propertyId;
    }

    if (floor) {
      where.floor = parseInt(floor, 10);
    }

    // Filter by tenant through property relation
    where.property = {
      tenantId,
    };

    const floorPlans = await db.floorPlan.findMany({
      where,
      include: {
        property: {
          select: {
            id: true,
            name: true,
            totalFloors: true,
          },
        },
      },
      orderBy: [
        { propertyId: 'asc' },
        { floor: 'asc' },
      ],
    });

    return NextResponse.json({
      success: true,
      data: floorPlans,
    });
  } catch (error) {
    console.error('Error fetching floor plans:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch floor plans' } },
      { status: 500 }
    );
  }
}

// POST /api/floor-plans - Create a new floor plan
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission(request, 'rooms.manage');
    if (user instanceof NextResponse) return user;

    const body = await request.json();

    const {
      propertyId,
      floor,
      name,
      imageUrl,
      svgData,
      roomPositions = [],
      width = 800,
      height = 600,
      gridSize = 20,
    } = body;

    // Validate required fields
    if (!propertyId || floor === undefined || floor === null || !name) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Property, floor, and name are required' } },
        { status: 400 }
      );
    }

    // Check if floor plan already exists for this property/floor combination
    const existingFloorPlan = await db.floorPlan.findUnique({
      where: {
        propertyId_floor: {
          propertyId,
          floor: parseInt(floor, 10),
        },
      },
    });

    if (existingFloorPlan) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_FLOOR', message: 'A floor plan already exists for this floor' } },
        { status: 400 }
      );
    }

    // Verify property exists and belongs to user's tenant
    const property = await db.property.findFirst({
      where: {
        id: propertyId,
        tenantId: user.tenantId,
        deletedAt: null,
      },
    });

    if (!property) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PROPERTY', message: 'Property not found' } },
        { status: 400 }
      );
    }

    const floorPlan = await db.floorPlan.create({
      data: {
        propertyId,
        floor: parseInt(floor, 10),
        name,
        imageUrl: imageUrl || null,
        svgData: svgData || null,
        roomPositions: JSON.stringify(roomPositions),
        width: parseInt(width, 10),
        height: parseInt(height, 10),
        gridSize: parseInt(gridSize, 10),
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            totalFloors: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: floorPlan }, { status: 201 });
  } catch (error) {
    console.error('Error creating floor plan:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create floor plan' } },
      { status: 500 }
    );
  }
}

// PUT /api/floor-plans - Update a floor plan
export async function PUT(request: NextRequest) {
  try {
    const user = await requirePermission(request, 'rooms.manage');
    if (user instanceof NextResponse) return user;

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Floor plan ID is required' } },
        { status: 400 }
      );
    }

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

    // If floor is being updated, check for duplicates
    if (updateData.floor !== undefined && updateData.propertyId) {
      const duplicateFloorPlan = await db.floorPlan.findFirst({
        where: {
          propertyId: updateData.propertyId,
          floor: parseInt(updateData.floor, 10),
          id: { not: id },
        },
      });

      if (duplicateFloorPlan) {
        return NextResponse.json(
          { success: false, error: { code: 'DUPLICATE_FLOOR', message: 'A floor plan already exists for this floor' } },
          { status: 400 }
        );
      }
    }

    // Prepare update data
    const data: Record<string, unknown> = {};

    if (updateData.name !== undefined) data.name = updateData.name;
    if (updateData.imageUrl !== undefined) data.imageUrl = updateData.imageUrl;
    if (updateData.svgData !== undefined) data.svgData = updateData.svgData;
    if (updateData.roomPositions !== undefined) data.roomPositions = JSON.stringify(updateData.roomPositions);
    if (updateData.width !== undefined) data.width = parseInt(updateData.width, 10);
    if (updateData.height !== undefined) data.height = parseInt(updateData.height, 10);
    if (updateData.gridSize !== undefined) data.gridSize = parseInt(updateData.gridSize, 10);
    if (updateData.floor !== undefined) data.floor = parseInt(updateData.floor, 10);

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

// DELETE /api/floor-plans - Delete a floor plan
export async function DELETE(request: NextRequest) {
  try {
    const user = await requirePermission(request, 'rooms.manage');
    if (user instanceof NextResponse) return user;

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Floor plan ID is required' } },
        { status: 400 }
      );
    }

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
