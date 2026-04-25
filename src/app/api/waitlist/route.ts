import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth/tenant-context';

const MAX_LIMIT = 100;

// Valid status values and transitions
const VALID_STATUSES = ['waiting', 'notified', 'converted', 'expired', 'cancelled'];

// GET /api/waitlist - List all waitlist entries
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const propertyId = searchParams.get('propertyId');
    const roomTypeId = searchParams.get('roomTypeId');
    const limitParam = searchParams.get('limit');
    const offset = searchParams.get('offset');

    // Cap the limit to prevent memory issues
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), MAX_LIMIT) : undefined;

    const where: Record<string, unknown> = {
      tenantId,
    };

    // Validate status
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid status value' } },
        { status: 400 }
      );
    }
    if (status) {
      where.status = status;
    }

    if (propertyId) {
      where.propertyId = propertyId;
    }

    if (roomTypeId) {
      where.roomTypeId = roomTypeId;
    }

    const entries = await db.waitlistEntry.findMany({
      where,
      include: {
        booking: {
          select: {
            id: true,
            confirmationCode: true,
            status: true,
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
      ...(limit && { take: limit }),
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    // Get guests, room types and properties for entries
    const guestIds = [...new Set(entries.map(e => e.guestId).filter(Boolean))];
    const roomTypeIds = [...new Set(entries.map(e => e.roomTypeId).filter(Boolean))];
    const propertyIds = [...new Set(entries.map(e => e.propertyId).filter(Boolean))];

    const guests = await db.guest.findMany({
      where: { id: { in: guestIds } },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, isVip: true },
    });
    const guestMap = new Map(guests.map(g => [g.id, g]));

    const roomTypes = await db.roomType.findMany({
      where: { id: { in: roomTypeIds } },
      select: { id: true, name: true, code: true },
    });
    const roomTypeMap = new Map(roomTypes.map(rt => [rt.id, rt]));

    const properties = await db.property.findMany({
      where: { id: { in: propertyIds } },
      select: { id: true, name: true },
    });
    const propertyMap = new Map(properties.map(p => [p.id, p]));

    const transformedEntries = entries.map(entry => ({
      ...entry,
      guest: guestMap.get(entry.guestId) || null,
      roomType: roomTypeMap.get(entry.roomTypeId) || null,
      property: propertyMap.get(entry.propertyId) || null,
    }));

    // Stats
    const stats = {
      total: await db.waitlistEntry.count({ where }),
      waiting: await db.waitlistEntry.count({ where: { ...where, status: 'waiting' } }),
      notified: await db.waitlistEntry.count({ where: { ...where, status: 'notified' } }),
      converted: await db.waitlistEntry.count({ where: { ...where, status: 'converted' } }),
      expired: await db.waitlistEntry.count({ where: { ...where, status: 'expired' } }),
    };

    return NextResponse.json({
      success: true,
      data: transformedEntries,
      stats,
    });
  } catch (error) {
    console.error('Error fetching waitlist:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch waitlist' } },
      { status: 500 }
    );
  }
}

// POST /api/waitlist - Create a waitlist entry
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  try {
    const body = await request.json();

    const {
      propertyId,
      guestId,
      roomTypeId,
      checkIn,
      checkOut,
      adults = 1,
      children = 0,
      priority = 0,
      notes,
    } = body;

    if (!propertyId || !guestId || !roomTypeId || !checkIn || !checkOut) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } },
        { status: 400 }
      );
    }

    // Validate property belongs to tenant
    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId },
    });
    if (!property) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } },
        { status: 404 }
      );
    }

    // Validate guest exists
    const guest = await db.guest.findUnique({
      where: { id: guestId },
    });
    if (!guest) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Guest not found' } },
        { status: 404 }
      );
    }

    // Validate room type exists for property
    const roomType = await db.roomType.findFirst({
      where: { id: roomTypeId, propertyId },
    });
    if (!roomType) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Room type not found' } },
        { status: 404 }
      );
    }

    // Validate dates
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    if (checkInDate >= checkOutDate) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Check-out must be after check-in' } },
        { status: 400 }
      );
    }

    const entry = await db.waitlistEntry.create({
      data: {
        tenantId,
        propertyId,
        guestId,
        roomTypeId,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        adults: Math.max(1, adults),
        children: Math.max(0, children),
        priority: Math.max(0, priority),
        notes,
        status: 'waiting',
      },
    });

    // Fetch guest data separately
    const guestData = await db.guest.findUnique({
      where: { id: guestId },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true },
    });

    return NextResponse.json({ success: true, data: { ...entry, guest: guestData } }, { status: 201 });
  } catch (error) {
    console.error('Error creating waitlist entry:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create waitlist entry' } },
      { status: 500 }
    );
  }
}

// PUT /api/waitlist - Update a waitlist entry
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  try {
    const body = await request.json();
    const { id, status, priority, notes, bookingId } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Entry ID is required' } },
        { status: 400 }
      );
    }

    const existingEntry = await db.waitlistEntry.findFirst({
      where: { id, tenantId },
    });

    if (!existingEntry) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Waitlist entry not found' } },
        { status: 404 }
      );
    }

    // Validate status if provided
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid status value' } },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = Math.max(0, priority);
    if (notes !== undefined) updateData.notes = notes;
    if (bookingId !== undefined) {
      updateData.bookingId = bookingId;
      if (bookingId) {
        updateData.convertedAt = new Date();
        updateData.status = 'converted';
      }
    }

    const entry = await db.waitlistEntry.update({
      where: { id },
      data: updateData,
      include: {
        booking: {
          select: {
            id: true,
            confirmationCode: true,
            status: true,
          },
        },
      },
    });

    // Fetch guest data separately
    const guest = await db.guest.findUnique({
      where: { id: existingEntry.guestId },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true },
    });

    return NextResponse.json({ success: true, data: { ...entry, guest } });
  } catch (error) {
    console.error('Error updating waitlist entry:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update waitlist entry' } },
      { status: 500 }
    );
  }
}

// DELETE /api/waitlist - Delete a waitlist entry
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Entry ID is required' } },
        { status: 400 }
      );
    }

    // Verify entry belongs to tenant
    const existingEntry = await db.waitlistEntry.findFirst({
      where: { id, tenantId },
    });

    if (!existingEntry) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Waitlist entry not found' } },
        { status: 404 }
      );
    }

    await db.waitlistEntry.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Waitlist entry deleted' });
  } catch (error) {
    console.error('Error deleting waitlist entry:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete waitlist entry' } },
      { status: 500 }
    );
  }
}
