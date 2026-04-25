import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET /api/parking - List all parking slots with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasAnyPermission(currentUser, ['parking.view', 'parking.manage', '*'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const tenantId = currentUser.tenantId;
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const vehicleType = searchParams.get('vehicleType');
    const floor = searchParams.get('floor');
    const hasCharging = searchParams.get('hasCharging');
    const search = searchParams.get('search');
    const limitParam = searchParams.get('limit');
    const offset = searchParams.get('offset');

    // Cap limit to prevent memory issues
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 100;

    const where: Record<string, unknown> = { tenantId };

    if (propertyId) {
      where.propertyId = propertyId;
    }

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (vehicleType) {
      where.vehicleType = vehicleType;
    }

    if (floor) {
      where.floor = parseInt(floor, 10);
    }

    if (hasCharging !== null && hasCharging !== undefined) {
      where.hasCharging = hasCharging === 'true';
    }

    if (search) {
      where.number = { contains: search };
    }

    const parkingSlots = await db.parkingSlot.findMany({
      where,
      include: {
        vehicles: {
          where: { status: 'parked' },
          include: {
            guest: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: [
        { floor: 'asc' },
        { number: 'asc' },
      ],
      take: limit,
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    const total = await db.parkingSlot.count({ where });

    // Calculate summary statistics
    const statusCounts = await db.parkingSlot.groupBy({
      by: ['status'],
      where,
      _count: {
        id: true,
      },
    });

    const typeCounts = await db.parkingSlot.groupBy({
      by: ['type'],
      where,
      _count: {
        id: true,
      },
    });

    const floorCounts = await db.parkingSlot.groupBy({
      by: ['floor'],
      where,
      _count: {
        id: true,
      },
    });

    // Get vehicles currently parked
    const parkedVehicles = await db.vehicle.count({
      where: {
        tenantId,
        status: 'parked',
      },
    });

    return NextResponse.json({
      success: true,
      data: parkingSlots,
      pagination: {
        total,
        limit,
        offset: offset ? parseInt(offset, 10) : null,
      },
      summary: {
        byStatus: statusCounts.reduce((acc, item) => {
          acc[item.status] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
        byType: typeCounts.reduce((acc, item) => {
          acc[item.type] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
        byFloor: floorCounts.reduce((acc, item) => {
          acc[item.floor.toString()] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
        parkedVehicles,
        occupancyRate: total > 0 ? Math.round((parkedVehicles / total) * 100) : 0,
      },
    });
  } catch (error) {
    console.error('Error fetching parking slots:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch parking slots' } },
      { status: 500 }
    );
  }
}

// POST /api/parking - Create a new parking slot
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check - requires manage permission
    if (!hasAnyPermission(currentUser, ['parking.manage', '*'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const tenantId = currentUser.tenantId;
    const body = await request.json();

    const {
      propertyId,
      number,
      floor = 1,
      type = 'standard',
      vehicleType = 'car',
      width,
      length,
      hasCharging = false,
      chargerType,
      posX,
      posY,
    } = body;

    // Validate required fields
    if (!number) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: number' } },
        { status: 400 }
      );
    }

    // Validate number is not empty string
    if (typeof number !== 'string' || number.trim() === '') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Slot number cannot be empty' } },
        { status: 400 }
      );
    }

    // Validate floor is a positive number
    if (typeof floor !== 'number' || floor < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Floor must be a non-negative number' } },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ['standard', 'compact', 'large', 'accessible', 'vip', 'electric'];
    if (type && !validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid type. Must be one of: ${validTypes.join(', ')}` } },
        { status: 400 }
      );
    }

    // Validate vehicleType
    const validVehicleTypes = ['car', 'motorcycle', 'truck', 'bus', 'bicycle'];
    if (vehicleType && !validVehicleTypes.includes(vehicleType)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid vehicle type. Must be one of: ${validVehicleTypes.join(', ')}` } },
        { status: 400 }
      );
    }

    // Validate property belongs to tenant if provided
    if (propertyId) {
      const property = await db.property.findFirst({
        where: { id: propertyId, tenantId },
      });
      if (!property) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_PROPERTY', message: 'Property not found or does not belong to your tenant' } },
          { status: 400 }
        );
      }
    }

    // Check if slot number already exists for this tenant
    const existingSlot = await db.parkingSlot.findFirst({
      where: { tenantId, number: number.trim() },
    });

    if (existingSlot) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_SLOT', message: 'Parking slot number already exists' } },
        { status: 400 }
      );
    }

    const parkingSlot = await db.parkingSlot.create({
      data: {
        tenantId,
        propertyId,
        number: number.trim(),
        floor,
        type,
        vehicleType,
        width,
        length,
        hasCharging,
        chargerType,
        posX,
        posY,
        status: 'available',
      },
    });

    // Create audit log
    try {
      await db.auditLog.create({
        data: {
          tenantId,
          module: 'parking',
          action: 'create',
          entityType: 'parking_slot',
          entityId: parkingSlot.id,
          newValue: JSON.stringify(parkingSlot),
        },
      });
    } catch {
      // Ignore audit log errors
    }

    return NextResponse.json({ success: true, data: parkingSlot }, { status: 201 });
  } catch (error) {
    console.error('Error creating parking slot:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create parking slot' } },
      { status: 500 }
    );
  }
}

// PUT /api/parking - Update parking slot
export async function PUT(request: NextRequest) {
  try {
    // Authentication check
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check - requires manage permission
    if (!hasAnyPermission(currentUser, ['parking.manage', '*'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const tenantId = currentUser.tenantId;
    const body = await request.json();
    const { id, status, type, vehicleType, hasCharging, chargerType, posX, posY } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Parking slot ID is required' } },
        { status: 400 }
      );
    }

    const existingSlot = await db.parkingSlot.findFirst({
      where: { id, tenantId },
    });

    if (!existingSlot) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Parking slot not found' } },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    // Validate and update status
    if (status) {
      const validStatuses = ['available', 'occupied', 'reserved', 'maintenance', 'blocked'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` } },
          { status: 400 }
        );
      }
      updateData.status = status;
    }

    // Validate and update type
    if (type) {
      const validTypes = ['standard', 'compact', 'large', 'accessible', 'vip', 'electric'];
      if (!validTypes.includes(type)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid type. Must be one of: ${validTypes.join(', ')}` } },
          { status: 400 }
        );
      }
      updateData.type = type;
    }

    // Validate and update vehicleType
    if (vehicleType) {
      const validVehicleTypes = ['car', 'motorcycle', 'truck', 'bus', 'bicycle'];
      if (!validVehicleTypes.includes(vehicleType)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid vehicle type. Must be one of: ${validVehicleTypes.join(', ')}` } },
          { status: 400 }
        );
      }
      updateData.vehicleType = vehicleType;
    }

    if (hasCharging !== undefined) updateData.hasCharging = hasCharging;
    if (chargerType !== undefined) updateData.chargerType = chargerType;
    if (posX !== undefined) updateData.posX = posX;
    if (posY !== undefined) updateData.posY = posY;

    const updatedSlot = await db.parkingSlot.update({
      where: { id },
      data: updateData,
    });

    // Create audit log
    try {
      await db.auditLog.create({
        data: {
          tenantId,
          module: 'parking',
          action: 'update',
          entityType: 'parking_slot',
          entityId: id,
          oldValue: JSON.stringify(existingSlot),
          newValue: JSON.stringify(updatedSlot),
        },
      });
    } catch {
      // Ignore audit log errors
    }

    return NextResponse.json({ success: true, data: updatedSlot });
  } catch (error) {
    console.error('Error updating parking slot:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update parking slot' } },
      { status: 500 }
    );
  }
}

// DELETE /api/parking - Delete a parking slot
export async function DELETE(request: NextRequest) {
  try {
    // Authentication check
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check - requires manage permission
    if (!hasAnyPermission(currentUser, ['parking.manage', '*'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const tenantId = currentUser.tenantId;
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Parking slot ID is required' } },
        { status: 400 }
      );
    }

    // Verify slot belongs to tenant
    const existingSlot = await db.parkingSlot.findFirst({
      where: { id, tenantId },
    });

    if (!existingSlot) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Parking slot not found' } },
        { status: 404 }
      );
    }

    // Check if there are parked vehicles
    const parkedVehicles = await db.vehicle.count({
      where: { slotId: id, status: 'parked' },
    });

    if (parkedVehicles > 0) {
      return NextResponse.json(
        { success: false, error: { code: 'SLOT_OCCUPIED', message: 'Cannot delete slot with parked vehicles' } },
        { status: 400 }
      );
    }

    await db.parkingSlot.delete({
      where: { id },
    });

    // Create audit log
    try {
      await db.auditLog.create({
        data: {
          tenantId,
          module: 'parking',
          action: 'delete',
          entityType: 'parking_slot',
          entityId: id,
          oldValue: JSON.stringify(existingSlot),
        },
      });
    } catch {
      // Ignore audit log errors
    }

    return NextResponse.json({ success: true, message: 'Parking slot deleted successfully' });
  } catch (error) {
    console.error('Error deleting parking slot:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete parking slot' } },
      { status: 500 }
    );
  }
}
