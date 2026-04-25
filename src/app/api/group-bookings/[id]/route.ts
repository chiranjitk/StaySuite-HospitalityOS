import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET /api/group-bookings/[id] - Get a single group booking with details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['bookings.manage', 'admin.bookings', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }


  try {
    const { id } = await params;

    const group = await db.groupBooking.findFirst({
      where: { 
        id,
        tenantId: user.tenantId,
      },
      include: {
        bookings: {
          include: {
            room: { select: { number: true } },
            roomType: { select: { name: true } },
            primaryGuest: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!group) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Group booking not found' } },
        { status: 404 }
      );
    }

    // Get property
    const property = await db.property.findUnique({
      where: { id: group.propertyId },
      select: { id: true, name: true },
    });

    const transformedGroup = {
      ...group,
      property: property || null,
      bookedRooms: group.bookings?.length || 0,
    };

    return NextResponse.json({
      success: true,
      data: transformedGroup,
    });
  } catch (error) {
    console.error('Error fetching group booking:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch group booking' } },
      { status: 500 }
    );
  }
}

// DELETE /api/group-bookings/[id] - Delete a group booking
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['bookings.manage', 'admin.bookings', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }


  try {
    const { id } = await params;

    // Verify group belongs to tenant
    const existingGroup = await db.groupBooking.findFirst({
      where: { 
        id,
        tenantId: user.tenantId,
      },
    });

    if (!existingGroup) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Group booking not found' } },
        { status: 404 }
      );
    }

    // Check for associated bookings
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
