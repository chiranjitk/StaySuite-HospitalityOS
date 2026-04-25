import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/events/[id]/resources - Get all resources for an event
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requirePermission(request, 'events.view');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;

    const event = await db.event.findFirst({
      where: { id, tenantId: user.tenantId },
      select: { id: true }
    });

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    const resources = await db.eventResource.findMany({
      where: { eventId: id },
      orderBy: [
        { category: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    // Calculate totals by category
    const categoryTotals: Record<string, { count: number; totalAmount: number }> = {};
    resources.forEach(resource => {
      if (!categoryTotals[resource.category]) {
        categoryTotals[resource.category] = { count: 0, totalAmount: 0 };
      }
      categoryTotals[resource.category].count += 1;
      categoryTotals[resource.category].totalAmount += resource.totalAmount;
    });

    const stats = {
      total: resources.length,
      totalAmount: resources.reduce((acc, r) => acc + r.totalAmount, 0),
      pending: resources.filter(r => r.status === 'pending').length,
      confirmed: resources.filter(r => r.status === 'confirmed').length,
      in_use: resources.filter(r => r.status === 'in_use').length,
      completed: resources.filter(r => r.status === 'completed').length,
      cancelled: resources.filter(r => r.status === 'cancelled').length,
      categoryTotals
    };

    return NextResponse.json({
      resources,
      stats
    });
  } catch (error) {
    console.error('Error fetching event resources:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event resources' },
      { status: 500 }
    );
  }
}

// POST /api/events/[id]/resources - Add a resource to an event
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requirePermission(request, 'events.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;
    const body = await request.json();

    const event = await db.event.findFirst({
      where: { id, tenantId: user.tenantId },
      select: { id: true }
    });

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    const {
      name,
      category,
      description,
      quantity,
      unitPrice,
      vendorId,
      vendorName,
      staffId,
      staffName,
      status,
      setupTime,
      teardownTime,
      notes
    } = body;

    if (!name || !category) {
      return NextResponse.json(
        { error: 'Name and category are required' },
        { status: 400 }
      );
    }

    // Validate quantity
    const validQuantity = Math.max(1, parseInt(String(quantity)) || 1);
    const validUnitPrice = Math.max(0, parseFloat(String(unitPrice)) || 0);

    const resource = await db.eventResource.create({
      data: {
        eventId: id,
        name,
        category,
        description,
        quantity: validQuantity,
        unitPrice: validUnitPrice,
        totalAmount: validQuantity * validUnitPrice,
        vendorId,
        vendorName,
        staffId,
        staffName,
        status: status || 'pending',
        setupTime: setupTime ? new Date(setupTime) : null,
        teardownTime: teardownTime ? new Date(teardownTime) : null,
        notes
      }
    });

    // Update event total amount - allResources already includes the newly created resource
    const allResources = await db.eventResource.findMany({
      where: { eventId: id }
    });

    // Fix: Don't double-count - allResources already includes the new resource
    const resourcesTotal = allResources.reduce((acc, r) => acc + r.totalAmount, 0);

    await db.event.update({
      where: { id },
      data: {
        otherCharges: resourcesTotal
      }
    });

    return NextResponse.json(resource);
  } catch (error) {
    console.error('Error creating event resource:', error);
    return NextResponse.json(
      { error: 'Failed to create event resource' },
      { status: 500 }
    );
  }
}

// DELETE /api/events/[id]/resources - Delete a resource from an event
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requirePermission(request, 'events.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const resourceId = searchParams.get('resourceId');

    if (!resourceId) {
      return NextResponse.json(
        { error: 'Resource ID is required' },
        { status: 400 }
      );
    }

    // Verify event belongs to user's tenant
    const event = await db.event.findFirst({
      where: { id, tenantId: user.tenantId },
      select: { id: true }
    });

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Delete the resource
    await db.eventResource.delete({
      where: { id: resourceId, eventId: id }
    });

    // Update event total amount
    const allResources = await db.eventResource.findMany({
      where: { eventId: id }
    });

    const resourcesTotal = allResources.reduce((acc, r) => acc + r.totalAmount, 0);

    await db.event.update({
      where: { id },
      data: {
        otherCharges: resourcesTotal
      }
    });

    return NextResponse.json({ message: 'Resource deleted successfully' });
  } catch (error) {
    console.error('Error deleting event resource:', error);
    return NextResponse.json(
      { error: 'Failed to delete event resource' },
      { status: 500 }
    );
  }
}

// PUT /api/events/[id]/resources - Update a resource
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requirePermission(request, 'events.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;
    const body = await request.json();
    const { resourceId, ...updateData } = body;

    if (!resourceId) {
      return NextResponse.json(
        { error: 'Resource ID is required' },
        { status: 400 }
      );
    }

    // Verify event belongs to user's tenant
    const event = await db.event.findFirst({
      where: { id, tenantId: user.tenantId },
      select: { id: true }
    });

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Build update data
    const data: Record<string, unknown> = {};
    if (updateData.name !== undefined) data.name = updateData.name;
    if (updateData.category !== undefined) data.category = updateData.category;
    if (updateData.description !== undefined) data.description = updateData.description;
    if (updateData.quantity !== undefined) {
      data.quantity = Math.max(1, parseInt(String(updateData.quantity)) || 1);
    }
    if (updateData.unitPrice !== undefined) {
      data.unitPrice = Math.max(0, parseFloat(String(updateData.unitPrice)) || 0);
    }
    if (updateData.vendorId !== undefined) data.vendorId = updateData.vendorId;
    if (updateData.vendorName !== undefined) data.vendorName = updateData.vendorName;
    if (updateData.staffId !== undefined) data.staffId = updateData.staffId;
    if (updateData.staffName !== undefined) data.staffName = updateData.staffName;
    if (updateData.status !== undefined) data.status = updateData.status;
    if (updateData.setupTime !== undefined) data.setupTime = updateData.setupTime ? new Date(updateData.setupTime) : null;
    if (updateData.teardownTime !== undefined) data.teardownTime = updateData.teardownTime ? new Date(updateData.teardownTime) : null;
    if (updateData.notes !== undefined) data.notes = updateData.notes;

    // Recalculate total if quantity or unitPrice changed
    if (data.quantity !== undefined || data.unitPrice !== undefined) {
      const existingResource = await db.eventResource.findUnique({
        where: { id: resourceId }
      });
      if (existingResource) {
        const quantity = (data.quantity as number) ?? existingResource.quantity;
        const unitPrice = (data.unitPrice as number) ?? existingResource.unitPrice;
        data.totalAmount = quantity * unitPrice;
      }
    }

    const resource = await db.eventResource.update({
      where: { id: resourceId, eventId: id },
      data
    });

    // Update event total amount
    const allResources = await db.eventResource.findMany({
      where: { eventId: id }
    });

    const resourcesTotal = allResources.reduce((acc, r) => acc + r.totalAmount, 0);

    await db.event.update({
      where: { id },
      data: {
        otherCharges: resourcesTotal
      }
    });

    return NextResponse.json(resource);
  } catch (error) {
    console.error('Error updating event resource:', error);
    return NextResponse.json(
      { error: 'Failed to update event resource' },
      { status: 500 }
    );
  }
}
