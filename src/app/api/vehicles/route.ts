import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// Default parking rates (can be overridden per request or via tenant settings)
const DEFAULT_HOURLY_RATE = 50; // Must match parking/billing route

// GET /api/vehicles - List all vehicles with filtering
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
    if (!hasAnyPermission(currentUser, ['parking.view', 'parking.manage', 'vehicles.view', '*'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const tenantId = currentUser.tenantId;
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status');
    const guestId = searchParams.get('guestId');
    const slotId = searchParams.get('slotId');
    const search = searchParams.get('search');
    const limitParam = searchParams.get('limit');
    const offset = searchParams.get('offset');

    // Cap limit to prevent memory issues
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 100;

    const where: Record<string, unknown> = { tenantId };

    // Filter by property - vehicles may not have direct propertyId,
    // so filter through related booking or slot
    if (propertyId) {
      where.OR = [
        { booking: { propertyId } },
        { slot: { propertyId } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (guestId) {
      where.guestId = guestId;
    }

    if (slotId) {
      where.slotId = slotId;
    }

    if (search) {
      const searchClause = [
        { licensePlate: { contains: search } },
        { make: { contains: search } },
        { model: { contains: search } },
      ];
      if (propertyId) {
        // Merge with existing OR clause for property filtering
        const existingOr = (where.OR as Record<string, unknown>[]) || [];
        where.AND = [
          { OR: existingOr },
          { OR: searchClause },
        ];
        delete where.OR;
      } else {
        where.OR = searchClause;
      }
    }

    const vehicles = await db.vehicle.findMany({
      where,
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
        slot: {
          select: {
            id: true,
            number: true,
            floor: true,
            type: true,
          },
        },
      },
      orderBy: [
        { createdAt: 'desc' },
      ],
      take: limit,
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    const total = await db.vehicle.count({ where });

    // Calculate summary statistics
    const statusCounts = await db.vehicle.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: {
        id: true,
      },
    });

    const totalFees = await db.vehicle.aggregate({
      where: { tenantId },
      _sum: {
        parkingFee: true,
      },
    });

    const unpaidFees = await db.vehicle.aggregate({
      where: { tenantId, isPaid: false, status: 'parked' },
      _sum: {
        parkingFee: true,
      },
    });

    // Vehicles exited today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const exitedToday = await db.vehicle.count({
      where: {
        tenantId,
        status: 'exited',
        exitTime: {
          gte: today,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: vehicles,
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
        totalFees: totalFees._sum.parkingFee || 0,
        unpaidFees: unpaidFees._sum.parkingFee || 0,
        exitedToday,
      },
    });
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch vehicles' } },
      { status: 500 }
    );
  }
}

// POST /api/vehicles - Log a new vehicle entry
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

    // Permission check
    if (!hasAnyPermission(currentUser, ['parking.manage', 'vehicles.manage', '*'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const tenantId = currentUser.tenantId;
    const body = await request.json();

    const {
      guestId,
      bookingId,
      licensePlate,
      make,
      model,
      color,
      year,
      slotId,
    } = body;

    // Validate required fields
    if (!licensePlate) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'License plate is required' } },
        { status: 400 }
      );
    }

    // Validate license plate format
    if (typeof licensePlate !== 'string' || licensePlate.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid license plate format' } },
        { status: 400 }
      );
    }

    // Validate year if provided
    if (year !== undefined && year !== null) {
      const yearNum = parseInt(year, 10);
      if (isNaN(yearNum) || yearNum < 1900 || yearNum > new Date().getFullYear() + 1) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid vehicle year' } },
          { status: 400 }
        );
      }
    }

    // Validate guest belongs to same tenant if provided
    if (guestId) {
      const guest = await db.guest.findFirst({
        where: { id: guestId, tenantId },
      });
      if (!guest) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_GUEST', message: 'Guest not found or does not belong to your tenant' } },
          { status: 400 }
        );
      }
    }

    // Validate booking belongs to same tenant if provided
    if (bookingId) {
      const booking = await db.booking.findFirst({
        where: { id: bookingId, tenantId },
      });
      if (!booking) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_BOOKING', message: 'Booking not found or does not belong to your tenant' } },
          { status: 400 }
        );
      }
    }

    // Check if vehicle with same license plate is already parked
    const existingVehicle = await db.vehicle.findFirst({
      where: {
        tenantId,
        licensePlate: licensePlate.toUpperCase().trim(),
        status: 'parked',
      },
    });

    if (existingVehicle) {
      return NextResponse.json(
        { success: false, error: { code: 'VEHICLE_ALREADY_PARKED', message: 'Vehicle with this license plate is already parked' } },
        { status: 400 }
      );
    }

    // If slot is provided, check if it's available
    if (slotId) {
      const slot = await db.parkingSlot.findFirst({
        where: { id: slotId, tenantId },
      });

      if (!slot) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Parking slot not found' } },
          { status: 404 }
        );
      }

      if (slot.status !== 'available') {
        return NextResponse.json(
          { success: false, error: { code: 'SLOT_NOT_AVAILABLE', message: 'Parking slot is not available' } },
          { status: 400 }
        );
      }

      // Update slot status
      await db.parkingSlot.update({
        where: { id: slotId },
        data: { status: 'occupied' },
      });
    }

    const vehicle = await db.vehicle.create({
      data: {
        tenantId,
        guestId,
        bookingId,
        licensePlate: licensePlate.toUpperCase().trim(),
        make,
        model,
        color,
        year: year ? parseInt(year, 10) : null,
        slotId,
        entryTime: new Date(),
        parkingFee: 0,
        isPaid: false,
        status: 'parked',
      },
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
        slot: {
          select: {
            id: true,
            number: true,
            floor: true,
            type: true,
          },
        },
      },
    });

    // Create audit log
    try {
      await db.auditLog.create({
        data: {
          tenantId,
          module: 'parking',
          action: 'vehicle_entry',
          entityType: 'vehicle',
          entityId: vehicle.id,
          newValue: JSON.stringify({
            licensePlate: vehicle.licensePlate,
            slotId: vehicle.slotId,
            guestId: vehicle.guestId,
            bookingId: vehicle.bookingId,
          }),
        },
      });
    } catch {
      // Ignore audit log errors
    }

    return NextResponse.json({ success: true, data: vehicle }, { status: 201 });
  } catch (error) {
    console.error('Error creating vehicle entry:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to log vehicle entry' } },
      { status: 500 }
    );
  }
}

// PUT /api/vehicles - Update a vehicle (exit or update details)
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

    // Permission check
    if (!hasAnyPermission(currentUser, ['parking.manage', 'vehicles.manage', '*'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const tenantId = currentUser.tenantId;
    const body = await request.json();
    const { id, action, hourlyRate = DEFAULT_HOURLY_RATE, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Vehicle ID is required' } },
        { status: 400 }
      );
    }

    const existingVehicle = await db.vehicle.findFirst({
      where: { id, tenantId },
      include: { slot: true },
    });

    if (!existingVehicle) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Vehicle not found' } },
        { status: 404 }
      );
    }

    // Validate hourly rate if provided
    if (hourlyRate !== undefined && (typeof hourlyRate !== 'number' || hourlyRate < 0)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Hourly rate must be a non-negative number' } },
        { status: 400 }
      );
    }

    // Handle exit action
    if (action === 'exit') {
      const now = new Date();
      const entryTime = existingVehicle.entryTime ? new Date(existingVehicle.entryTime) : now;
      const hours = Math.max(1, Math.ceil((now.getTime() - entryTime.getTime()) / (1000 * 60 * 60)));
      const fee = hours * hourlyRate;

      // Update vehicle
      const updatedVehicle = await db.vehicle.update({
        where: { id },
        data: {
          exitTime: now,
          parkingFee: fee,
          status: 'exited',
        },
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
          slot: {
            select: {
              id: true,
              number: true,
              floor: true,
              type: true,
            },
          },
        },
      });

      // Free up the parking slot
      if (existingVehicle.slotId) {
        await db.parkingSlot.update({
          where: { id: existingVehicle.slotId },
          data: { status: 'available' },
        });
      }

      // Create audit log
      try {
        await db.auditLog.create({
          data: {
            tenantId,
            module: 'parking',
            action: 'vehicle_exit',
            entityType: 'vehicle',
            entityId: id,
            oldValue: JSON.stringify({
              status: existingVehicle.status,
              slotId: existingVehicle.slotId,
            }),
            newValue: JSON.stringify({
              status: 'exited',
              parkingFee: fee,
              exitTime: now.toISOString(),
            }),
          },
        });
      } catch {
        // Ignore audit log errors
      }

      return NextResponse.json({ success: true, data: updatedVehicle });
    }

    // Handle regular updates
    const updateData: Record<string, unknown> = {};

    const allowedFields = ['make', 'model', 'color', 'year', 'slotId', 'guestId', 'parkingFee', 'isPaid'];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        if (field === 'year') {
          const yearNum = updates[field] ? parseInt(updates[field], 10) : null;
          if (yearNum !== null && (isNaN(yearNum) || yearNum < 1900 || yearNum > new Date().getFullYear() + 1)) {
            return NextResponse.json(
              { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid vehicle year' } },
              { status: 400 }
            );
          }
          updateData[field] = yearNum;
        } else if (field === 'parkingFee') {
          const fee = parseFloat(updates[field]);
          if (isNaN(fee) || fee < 0) {
            return NextResponse.json(
              { success: false, error: { code: 'VALIDATION_ERROR', message: 'Parking fee must be a non-negative number' } },
              { status: 400 }
            );
          }
          updateData[field] = fee;
        } else if (field === 'isPaid') {
          updateData[field] = Boolean(updates[field]);
        } else if (field === 'guestId') {
          // Validate guest belongs to same tenant
          if (updates[field]) {
            const guest = await db.guest.findFirst({
              where: { id: updates[field], tenantId },
            });
            if (!guest) {
              return NextResponse.json(
                { success: false, error: { code: 'INVALID_GUEST', message: 'Guest not found or does not belong to your tenant' } },
                { status: 400 }
              );
            }
          }
          updateData[field] = updates[field];
        } else if (field === 'slotId') {
          // Validate slot belongs to same tenant
          if (updates[field]) {
            const slot = await db.parkingSlot.findFirst({
              where: { id: updates[field], tenantId },
            });
            if (!slot) {
              return NextResponse.json(
                { success: false, error: { code: 'INVALID_SLOT', message: 'Parking slot not found' } },
                { status: 400 }
              );
            }
          }
          updateData[field] = updates[field];
        } else {
          updateData[field] = updates[field];
        }
      }
    }

    const updatedVehicle = await db.vehicle.update({
      where: { id },
      data: updateData,
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
        slot: {
          select: {
            id: true,
            number: true,
            floor: true,
            type: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: updatedVehicle });
  } catch (error) {
    console.error('Error updating vehicle:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update vehicle' } },
      { status: 500 }
    );
  }
}

// DELETE /api/vehicles - Delete a vehicle record
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
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Vehicle ID is required' } },
        { status: 400 }
      );
    }

    const vehicle = await db.vehicle.findFirst({
      where: { id, tenantId },
    });

    if (!vehicle) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Vehicle not found' } },
        { status: 404 }
      );
    }

    // If vehicle is parked, free up the slot
    if (vehicle.status === 'parked' && vehicle.slotId) {
      await db.parkingSlot.update({
        where: { id: vehicle.slotId },
        data: { status: 'available' },
      });
    }

    await db.vehicle.delete({
      where: { id },
    });

    // Create audit log
    try {
      await db.auditLog.create({
        data: {
          tenantId,
          module: 'parking',
          action: 'delete',
          entityType: 'vehicle',
          entityId: id,
          oldValue: JSON.stringify(vehicle),
        },
      });
    } catch {
      // Ignore audit log errors
    }

    return NextResponse.json({ success: true, message: 'Vehicle deleted successfully' });
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete vehicle' } },
      { status: 500 }
    );
  }
}
