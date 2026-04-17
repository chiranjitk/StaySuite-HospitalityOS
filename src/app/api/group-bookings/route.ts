import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import crypto from 'crypto';

// Group Bookings API - Updated 2024
// Version: 3.0

const MAX_LIMIT = 100;

// Valid status values
const VALID_STATUSES = ['inquiry', 'tentative', 'confirmed', 'in_progress', 'completed', 'cancelled'];

function generateGroupCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(6);
  let code = 'GRP-';
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

// GET /api/group-bookings - List all group bookings
export async function GET(request: NextRequest) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['bookings.manage', 'admin.bookings', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }


  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const propertyId = searchParams.get('propertyId');
    const search = searchParams.get('search');
    const limitParam = searchParams.get('limit');
    const offset = searchParams.get('offset');

    // Cap the limit
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), MAX_LIMIT) : undefined;

    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
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

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { contactName: { contains: search } },
        { contactEmail: { contains: search } },
      ];
    }

    // Fetch group bookings with their associated bookings count
    const groups = await db.groupBooking.findMany({
      where,
      include: {
        bookings: {
          select: { id: true },
        },
      },
      orderBy: [
        { createdAt: 'desc' },
      ],
      ...(limit && { take: limit }),
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    // Get properties for display
    const propertyIds = [...new Set(groups.map(g => g.propertyId).filter(Boolean))];
    const properties = await db.property.findMany({
      where: { id: { in: propertyIds } },
      select: { id: true, name: true },
    });
    const propertyMap = new Map(properties.map(p => [p.id, p]));

    // Transform data for response
    const transformedGroups = groups.map((group) => ({
      id: group.id,
      tenantId: group.tenantId,
      propertyId: group.propertyId,
      name: group.name,
      description: group.description,
      contactName: group.contactName,
      contactEmail: group.contactEmail,
      contactPhone: group.contactPhone,
      checkIn: group.checkIn,
      checkOut: group.checkOut,
      totalRooms: group.totalRooms,
      bookedRooms: group.bookings?.length || 0,
      totalAmount: group.totalAmount,
      depositAmount: group.depositAmount,
      depositPaid: group.depositPaid,
      status: group.status,
      contractUrl: group.contractUrl,
      contractSignedAt: group.contractSignedAt,
      notes: group.notes,
      createdAt: group.createdAt,
      property: propertyMap.get(group.propertyId) || null,
    }));

    // Calculate statistics
    const stats = {
      total: await db.groupBooking.count({ where }),
      inquiry: await db.groupBooking.count({ where: { ...where, status: 'inquiry' } }),
      confirmed: await db.groupBooking.count({ where: { ...where, status: 'confirmed' } }),
      cancelled: await db.groupBooking.count({ where: { ...where, status: 'cancelled' } }),
      totalValue: (await db.groupBooking.aggregate({
        where,
        _sum: { totalAmount: true },
      }))._sum.totalAmount || 0,
    };

    return NextResponse.json({
      success: true,
      data: transformedGroups,
      stats,
    });
  } catch (error) {
    console.error('Error fetching group bookings:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch group bookings' } },
      { status: 500 }
    );
  }
}

// POST /api/group-bookings - Create a group booking
export async function POST(request: NextRequest) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['bookings.manage', 'admin.bookings', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }


  try {
    const body = await request.json();

    const {
      propertyId,
      name,
      description,
      contactName,
      contactEmail,
      contactPhone,
      checkIn,
      checkOut,
      totalRooms = 1,
      totalAmount = 0,
      depositAmount = 0,
      depositPaid = false,
      status = 'inquiry',
      notes,
    } = body;

    if (!propertyId || !name || !checkIn || !checkOut) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } },
        { status: 400 }
      );
    }

    // Validate status
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid status value' } },
        { status: 400 }
      );
    }

    // Validate property belongs to tenant
    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId: user.tenantId },
    });
    if (!property) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } },
        { status: 404 }
      );
    }

    // Validate email format if provided
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid email format' } },
        { status: 400 }
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

    const group = await db.$transaction(async (tx) => {
      const created = await tx.groupBooking.create({
        data: {
          tenantId: user.tenantId,
          propertyId,
          name,
          description,
          contactName,
          contactEmail,
          contactPhone,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          totalRooms: Math.max(1, totalRooms),
          totalAmount: Math.max(0, totalAmount),
          depositAmount: Math.max(0, depositAmount),
          depositPaid,
          status,
          notes,
        },
      });
      return created;
    });

    return NextResponse.json({ success: true, data: group }, { status: 201 });
  } catch (error) {
    console.error('Error creating group booking:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create group booking' } },
      { status: 500 }
    );
  }
}

// PUT /api/group-bookings - Update a group booking
export async function PUT(request: NextRequest) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['bookings.manage', 'admin.bookings', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }


  try {
    const body = await request.json();
    const { id, status, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Group booking ID is required' } },
        { status: 400 }
      );
    }

    // Validate status if provided
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid status value' } },
        { status: 400 }
      );
    }

    const existingGroup = await db.groupBooking.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existingGroup) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Group booking not found' } },
        { status: 404 }
      );
    }

    // Validate email format if provided
    if (updateData.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updateData.contactEmail)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid email format' } },
        { status: 400 }
      );
    }

    // Handle date fields
    const data: Record<string, unknown> = { ...updateData };
    if (status !== undefined) data.status = status;
    if (updateData.checkIn) data.checkIn = new Date(updateData.checkIn);
    if (updateData.checkOut) data.checkOut = new Date(updateData.checkOut);
    if (updateData.contractSignedAt) data.contractSignedAt = new Date(updateData.contractSignedAt);
    if (updateData.totalRooms !== undefined) data.totalRooms = Math.max(1, updateData.totalRooms);
    if (updateData.totalAmount !== undefined) data.totalAmount = Math.max(0, updateData.totalAmount);
    if (updateData.depositAmount !== undefined) data.depositAmount = Math.max(0, updateData.depositAmount);

    const group = await db.groupBooking.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, data: group });
  } catch (error) {
    console.error('Error updating group booking:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update group booking' } },
      { status: 500 }
    );
  }
}

// DELETE /api/group-bookings - Delete a group booking
export async function DELETE(request: NextRequest) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['bookings.manage', 'admin.bookings', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }


  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Group booking ID is required' } },
        { status: 400 }
      );
    }

    // Verify group belongs to tenant
    const existingGroup = await db.groupBooking.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existingGroup) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Group booking not found' } },
        { status: 404 }
      );
    }

    // Check if there are associated bookings
    const bookingsCount = await db.booking.count({
      where: { groupId: id },
    });

    if (bookingsCount > 0) {
      return NextResponse.json(
        { success: false, error: { code: 'HAS_BOOKINGS', message: 'Cannot delete group with associated bookings' } },
        { status: 400 }
      );
    }

    await db.groupBooking.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Group booking deleted' });
  } catch (error) {
    console.error('Error deleting group booking:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete group booking' } },
      { status: 500 }
    );
  }
}
