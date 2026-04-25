import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// Valid status transitions map
const VALID_TRANSITIONS: Record<string, string[]> = {
  confirmed: ['seated', 'cancelled', 'no_show'],
  seated: ['completed', 'cancelled'],
  no_show: ['seated', 'cancelled'],
  completed: [],
  cancelled: [],
};

// GET /api/reservations - List reservations with filtering, search, and stats
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
    if (!hasPermission(user, 'restaurant.read') && !hasPermission(user, 'restaurant.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status');
    const date = searchParams.get('date');
    const search = searchParams.get('search');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 100);
    const offset = searchParams.get('offset');
    const stats = searchParams.get('stats');

    // propertyId is required
    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'propertyId is required' } },
        { status: 400 }
      );
    }

    // Verify property belongs to user's tenant
    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId: user.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!property) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PROPERTY', message: 'Property not found' } },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = { propertyId };

    if (status) {
      where.status = status;
    }

    if (date) {
      // Parse ISO date string and match the date portion
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid date format. Use ISO date string.' } },
          { status: 400 }
        );
      }
      const startOfDay = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);
      where.date = { gte: startOfDay, lt: endOfDay };
    }

    if (search) {
      where.guestName = { contains: search };
    }

    // If stats flag is set, return summary statistics
    if (stats === 'true') {
      const statusCounts = await db.reservation.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      });

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);

      const todayCount = await db.reservation.count({
        where: {
          propertyId,
          date: { gte: todayStart, lt: todayEnd },
          status: { not: 'cancelled' },
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          statusCounts: statusCounts.reduce((acc, item) => {
            acc[item.status || 'unknown'] = item._count.id;
            return acc;
          }, {} as Record<string, number>),
          todayCount,
        },
      });
    }

    const reservations = await db.reservation.findMany({
      where,
      include: {
        table: {
          select: {
            id: true,
            number: true,
            name: true,
            capacity: true,
            area: true,
            status: true,
          },
        },
      },
      orderBy: [
        { date: 'asc' },
        { time: 'asc' },
      ],
      take: limit,
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    const total = await db.reservation.count({ where });

    return NextResponse.json({
      success: true,
      data: reservations,
      pagination: {
        total,
        limit,
        offset: offset ? parseInt(offset, 10) : null,
      },
    });
  } catch (error) {
    console.error('Error fetching reservations:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch reservations' } },
      { status: 500 }
    );
  }
}

// POST /api/reservations - Create a new reservation
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
    if (!hasPermission(user, 'restaurant.write') && !hasPermission(user, 'restaurant.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();

    const {
      propertyId,
      tableId,
      guestId,
      guestName,
      guestPhone,
      guestEmail,
      partySize,
      date,
      time,
      duration = 90,
      specialRequests,
      occasion,
      status = 'confirmed',
      source = 'phone',
    } = body;

    // Validate required fields
    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: propertyId' } },
        { status: 400 }
      );
    }

    if (!guestName) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: guestName' } },
        { status: 400 }
      );
    }

    if (!guestPhone) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: guestPhone' } },
        { status: 400 }
      );
    }

    if (partySize === undefined || partySize === null) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: partySize' } },
        { status: 400 }
      );
    }

    if (!date) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: date' } },
        { status: 400 }
      );
    }

    if (!time) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: time' } },
        { status: 400 }
      );
    }

    // Validate partySize range
    if (partySize < 1 || partySize > 50) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'partySize must be between 1 and 50' } },
        { status: 400 }
      );
    }

    // Validate duration range
    if (duration < 15 || duration > 480) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'duration must be between 15 and 480 minutes' } },
        { status: 400 }
      );
    }

    // Verify property belongs to user's tenant
    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId: user.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!property) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PROPERTY', message: 'Property not found' } },
        { status: 400 }
      );
    }

    // Parse date
    const reservationDate = new Date(date);
    if (isNaN(reservationDate.getTime())) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid date format' } },
        { status: 400 }
      );
    }

    // If tableId is provided, verify table belongs to property and is available
    if (tableId) {
      const table = await db.restaurantTable.findFirst({
        where: { id: tableId, propertyId },
      });

      if (!table) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_TABLE', message: 'Table not found for this property' } },
          { status: 400 }
        );
      }

      if (table.status !== 'available') {
        return NextResponse.json(
          { success: false, error: { code: 'TABLE_UNAVAILABLE', message: 'Table is not available' } },
          { status: 400 }
        );
      }

      // Check for conflicting reservations on the same table/date/time
      const [startHours, startMinutes] = time.split(':').map(Number);
      const reservationStart = new Date(reservationDate);
      reservationStart.setHours(startHours, startMinutes, 0, 0);

      const reservationEnd = new Date(reservationStart.getTime() + duration * 60 * 1000);

      // Find existing reservations on the same table that overlap with the requested time window
      const conflictingReservations = await db.reservation.findMany({
        where: {
          tableId,
          date: reservationDate,
          status: { in: ['confirmed', 'seated'] },
        },
      });

      for (const existing of conflictingReservations) {
        const [existH, existM] = existing.time.split(':').map(Number);
        const existStart = new Date(reservationDate);
        existStart.setHours(existH, existM, 0, 0);
        const existEnd = new Date(existStart.getTime() + existing.duration * 60 * 1000);

        // Check for time overlap: two ranges overlap if start1 < end2 AND start2 < end1
        if (reservationStart < existEnd && existStart < reservationEnd) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'CONFLICT',
                message: `Table has a conflicting reservation at ${existing.time} (${existing.guestName}, party of ${existing.partySize})`,
              },
            },
            { status: 409 }
          );
        }
      }
    }

    // Create the reservation
    const reservation = await db.reservation.create({
      data: {
        propertyId,
        tableId: tableId || null,
        guestId: guestId || null,
        guestName,
        guestPhone,
        guestEmail: guestEmail || null,
        partySize,
        date: reservationDate,
        time,
        duration,
        specialRequests: specialRequests || null,
        occasion: occasion || null,
        status,
        source,
      },
      include: {
        table: {
          select: {
            id: true,
            number: true,
            name: true,
            capacity: true,
            area: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: reservation }, { status: 201 });
  } catch (error) {
    console.error('Error creating reservation:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create reservation' } },
      { status: 500 }
    );
  }
}

// PUT /api/reservations - Update a reservation
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
    if (!hasPermission(user, 'restaurant.write') && !hasPermission(user, 'restaurant.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Reservation ID is required' } },
        { status: 400 }
      );
    }

    // Verify reservation exists and belongs to tenant (via property)
    const existingReservation = await db.reservation.findFirst({
      where: { id },
      include: {
        property: { select: { tenantId: true } },
        table: { select: { id: true } },
      },
    });

    if (!existingReservation) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Reservation not found' } },
        { status: 404 }
      );
    }

    if (existingReservation.property.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Validate status transition if status is being changed
    if (updateData.status && updateData.status !== existingReservation.status) {
      const allowedTransitions = VALID_TRANSITIONS[existingReservation.status] || [];
      if (!allowedTransitions.includes(updateData.status)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_STATUS_TRANSITION',
              message: `Cannot transition from '${existingReservation.status}' to '${updateData.status}'. Allowed: [${allowedTransitions.join(', ')}]`,
            },
          },
          { status: 400 }
        );
      }
    }

    // Validate partySize if provided
    if (updateData.partySize !== undefined && (updateData.partySize < 1 || updateData.partySize > 50)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'partySize must be between 1 and 50' } },
        { status: 400 }
      );
    }

    // Validate duration if provided
    if (updateData.duration !== undefined && (updateData.duration < 15 || updateData.duration > 480)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'duration must be between 15 and 480 minutes' } },
        { status: 400 }
      );
    }

    // If assigning or changing a table, verify no conflicts
    const newTableId = updateData.tableId !== undefined ? updateData.tableId : existingReservation.tableId;
    const newTime = updateData.time || existingReservation.time;
    const newDuration = updateData.duration || existingReservation.duration;
    const newDate = updateData.date ? new Date(updateData.date) : new Date(existingReservation.date);

    if (newTableId && (updateData.tableId !== undefined || updateData.time !== undefined || updateData.duration !== undefined || updateData.date !== undefined)) {
      // Verify table belongs to property
      const table = await db.restaurantTable.findFirst({
        where: { id: newTableId, propertyId: existingReservation.propertyId },
      });

      if (!table) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_TABLE', message: 'Table not found for this property' } },
          { status: 400 }
        );
      }

      // Check for conflicting reservations
      const [startHours, startMinutes] = newTime.split(':').map(Number);
      const reservationStart = new Date(newDate);
      reservationStart.setHours(startHours, startMinutes, 0, 0);
      const reservationEnd = new Date(reservationStart.getTime() + newDuration * 60 * 1000);

      const conflictingReservations = await db.reservation.findMany({
        where: {
          tableId: newTableId,
          date: newDate,
          status: { in: ['confirmed', 'seated'] },
          id: { not: id }, // exclude the current reservation
        },
      });

      for (const existing of conflictingReservations) {
        const [existH, existM] = existing.time.split(':').map(Number);
        const existStart = new Date(newDate);
        existStart.setHours(existH, existM, 0, 0);
        const existEnd = new Date(existStart.getTime() + existing.duration * 60 * 1000);

        if (reservationStart < existEnd && existStart < reservationEnd) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'CONFLICT',
                message: `Table has a conflicting reservation at ${existing.time} (${existing.guestName}, party of ${existing.partySize})`,
              },
            },
            { status: 409 }
          );
        }
      }
    }

    // Build update object with only provided fields
    const data: Record<string, unknown> = {};

    const allowedFields = [
      'guestName', 'guestPhone', 'guestEmail', 'partySize',
      'date', 'time', 'duration', 'specialRequests', 'occasion',
      'status', 'source', 'tableId', 'guestId',
    ];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        if (field === 'date') {
          data[field] = new Date(updateData[field]);
        } else {
          data[field] = updateData[field];
        }
      }
    }

    const reservation = await db.reservation.update({
      where: { id },
      data,
      include: {
        table: {
          select: {
            id: true,
            number: true,
            name: true,
            capacity: true,
            area: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: reservation });
  } catch (error) {
    console.error('Error updating reservation:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update reservation' } },
      { status: 500 }
    );
  }
}

// DELETE /api/reservations - Soft delete (cancel) a reservation
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
    if (!hasPermission(user, 'restaurant.write') && !hasPermission(user, 'restaurant.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Reservation ID is required' } },
        { status: 400 }
      );
    }

    // Verify reservation exists and belongs to tenant (via property)
    const reservation = await db.reservation.findFirst({
      where: { id },
      include: {
        property: { select: { tenantId: true } },
        table: { select: { id: true } },
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Reservation not found' } },
        { status: 404 }
      );
    }

    if (reservation.property.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Soft cancel: set status to 'cancelled'
    await db.reservation.update({
      where: { id },
      data: { status: 'cancelled' },
    });

    // If table was assigned, set table status back to 'available'
    if (reservation.tableId) {
      await db.restaurantTable.update({
        where: { id: reservation.tableId },
        data: { status: 'available' },
      });
    }

    return NextResponse.json({ success: true, data: { id, status: 'cancelled' } });
  } catch (error) {
    console.error('Error cancelling reservation:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel reservation' } },
      { status: 500 }
    );
  }
}
