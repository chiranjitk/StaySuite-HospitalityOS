import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/events/spaces/[id] - Get a single event space
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'events.view')) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    const { id } = await params;

    const space = await db.eventSpace.findFirst({
      where: { 
        id,
        property: { tenantId: user.tenantId }
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
          }
        },
        events: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            status: true,
          },
          orderBy: {
            startDate: 'desc'
          },
          take: 10
        },
        _count: {
          select: {
            events: true
          }
        }
      }
    });

    if (!space) {
      return NextResponse.json(
        { error: 'Event space not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...space,
      amenities: JSON.parse(space.amenities),
      images: JSON.parse(space.images),
    });
  } catch (error) {
    console.error('Error fetching event space:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event space' },
      { status: 500 }
    );
  }
}

// PUT /api/events/spaces/[id] - Update an event space
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'events.update')) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    const existingSpace = await db.eventSpace.findFirst({
      where: { 
        id,
        property: { tenantId: user.tenantId }
      }
    });

    if (!existingSpace) {
      return NextResponse.json(
        { error: 'Event space not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.minCapacity !== undefined) updateData.minCapacity = Math.max(1, parseInt(String(body.minCapacity)) || 1);
    if (body.maxCapacity !== undefined) updateData.maxCapacity = Math.max(body.minCapacity || existingSpace.minCapacity, parseInt(String(body.maxCapacity)) || 100);
    if (body.sizeSqMeters !== undefined) updateData.sizeSqMeters = body.sizeSqMeters ? Math.max(0, parseFloat(String(body.sizeSqMeters))) : null;
    if (body.sizeSqFeet !== undefined) updateData.sizeSqFeet = body.sizeSqFeet ? Math.max(0, parseFloat(String(body.sizeSqFeet))) : null;
    if (body.hourlyRate !== undefined) updateData.hourlyRate = body.hourlyRate ? Math.max(0, parseFloat(String(body.hourlyRate))) : null;
    if (body.dailyRate !== undefined) updateData.dailyRate = body.dailyRate ? Math.max(0, parseFloat(String(body.dailyRate))) : null;
    if (body.amenities !== undefined) updateData.amenities = JSON.stringify(body.amenities);
    if (body.images !== undefined) updateData.images = JSON.stringify(body.images);
    if (body.status !== undefined) updateData.status = body.status;

    const space = await db.eventSpace.update({
      where: { id },
      data: updateData,
      include: {
        property: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    return NextResponse.json({
      ...space,
      amenities: JSON.parse(space.amenities),
      images: JSON.parse(space.images),
    });
  } catch (error) {
    console.error('Error updating event space:', error);
    return NextResponse.json(
      { error: 'Failed to update event space' },
      { status: 500 }
    );
  }
}

// DELETE /api/events/spaces/[id] - Delete an event space
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'events.delete')) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    const { id } = await params;

    const existingSpace = await db.eventSpace.findFirst({
      where: { 
        id,
        property: { tenantId: user.tenantId }
      },
      include: {
        _count: {
          select: {
            events: true
          }
        }
      }
    });

    if (!existingSpace) {
      return NextResponse.json(
        { error: 'Event space not found' },
        { status: 404 }
      );
    }

    // Check if there are events associated with this space
    if (existingSpace._count.events > 0) {
      return NextResponse.json(
        { error: 'Cannot delete event space with associated events' },
        { status: 400 }
      );
    }

    await db.eventSpace.delete({
      where: { id }
    });

    return NextResponse.json({ message: 'Event space deleted successfully' });
  } catch (error) {
    console.error('Error deleting event space:', error);
    return NextResponse.json(
      { error: 'Failed to delete event space' },
      { status: 500 }
    );
  }
}
