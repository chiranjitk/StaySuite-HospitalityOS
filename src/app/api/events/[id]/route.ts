import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';// GET /api/events/[id] - Get a single event
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await requirePermission(request, 'events.view');
    if (user instanceof NextResponse) return user;
    const tenantId = user.tenantId;
  


  try {
    const { id } = await params;

    const event = await db.event.findFirst({
      where: { id, tenantId },
      include: {
        property: {
          select: {
            id: true,
            name: true,
          }
        },
        space: {
          select: {
            id: true,
            name: true,
            minCapacity: true,
            maxCapacity: true,
            sizeSqMeters: true,
            hourlyRate: true,
            dailyRate: true,
          }
        },
        resources: {
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(event);
  } catch (error) {
    console.error('Error fetching event:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event' },
      { status: 500 }
    );
  }
}

// PUT /api/events/[id] - Update an event
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await requirePermission(request, 'events.manage');
    if (user instanceof NextResponse) return user;
    const tenantId = user.tenantId;

  try {
    const { id } = await params;
    const body = await request.json();

    const existingEvent = await db.event.findFirst({
      where: { id, tenantId }
    });

    if (!existingEvent) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    
    if (body.name !== undefined) updateData.name = body.name;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.organizerName !== undefined) updateData.organizerName = body.organizerName;
    if (body.organizerEmail !== undefined) updateData.organizerEmail = body.organizerEmail;
    if (body.organizerPhone !== undefined) updateData.organizerPhone = body.organizerPhone;
    if (body.startDate !== undefined) updateData.startDate = new Date(body.startDate);
    if (body.endDate !== undefined) updateData.endDate = new Date(body.endDate);
    if (body.setupStart !== undefined) updateData.setupStart = body.setupStart ? new Date(body.setupStart) : null;
    if (body.teardownEnd !== undefined) updateData.teardownEnd = body.teardownEnd ? new Date(body.teardownEnd) : null;
    if (body.expectedAttendance !== undefined) updateData.expectedAttendance = body.expectedAttendance;
    if (body.actualAttendance !== undefined) updateData.actualAttendance = body.actualAttendance;
    if (body.spaceId !== undefined) updateData.spaceId = body.spaceId;
    if (body.spaceCharge !== undefined) updateData.spaceCharge = body.spaceCharge;
    if (body.cateringCharge !== undefined) updateData.cateringCharge = body.cateringCharge;
    if (body.avCharge !== undefined) updateData.avCharge = body.avCharge;
    if (body.otherCharges !== undefined) updateData.otherCharges = body.otherCharges;
    if (body.totalAmount !== undefined) updateData.totalAmount = body.totalAmount;
    if (body.currency !== undefined) updateData.currency = body.currency;
    if (body.depositAmount !== undefined) updateData.depositAmount = body.depositAmount;
    if (body.depositPaid !== undefined) updateData.depositPaid = body.depositPaid;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.contractUrl !== undefined) updateData.contractUrl = body.contractUrl;
    if (body.contractSignedAt !== undefined) updateData.contractSignedAt = body.contractSignedAt ? new Date(body.contractSignedAt) : null;
    if (body.notes !== undefined) updateData.notes = body.notes;

    const event = await db.event.update({
      where: { id, tenantId },
      data: updateData,
      include: {
        property: {
          select: {
            id: true,
            name: true,
          }
        },
        space: {
          select: {
            id: true,
            name: true,
            minCapacity: true,
            maxCapacity: true,
          }
        },
        resources: true
      }
    });

    return NextResponse.json(event);
  } catch (error) {
    console.error('Error updating event:', error);
    return NextResponse.json(
      { error: 'Failed to update event' },
      { status: 500 }
    );
  }
}

// DELETE /api/events/[id] - Delete an event
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await requirePermission(request, 'events.manage');
    if (user instanceof NextResponse) return user;
    const tenantId = user.tenantId;


  try {
    const { id } = await params;

    const existingEvent = await db.event.findFirst({
      where: { id, tenantId }
    });

    if (!existingEvent) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Delete associated resources first
    await db.eventResource.deleteMany({
      where: { eventId: id }
    });

    // Delete the event
    await db.event.delete({
      where: { id, tenantId }
    });

    return NextResponse.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Error deleting event:', error);
    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    );
  }
}
