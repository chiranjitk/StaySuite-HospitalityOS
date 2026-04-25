import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/preventive-maintenance/[id] - Get a single preventive maintenance item
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'maintenance.read') && !hasPermission(user, 'maintenance.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { id } = await params;

    const item = await db.preventiveMaintenance.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        property: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!item) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Preventive maintenance item not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    console.error('Error fetching preventive maintenance item:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch preventive maintenance item' } },
      { status: 500 }
    );
  }
}

// PUT /api/preventive-maintenance/[id] - Update a preventive maintenance item by URL param
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'maintenance.write') && !hasPermission(user, 'maintenance.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { id } = await params;
    const updates = await request.json();

    // Verify item exists and belongs to user's tenant
    const existingItem = await db.preventiveMaintenance.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existingItem) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Item not found' } },
        { status: 404 }
      );
    }

    // Validate frequency if provided
    if (updates.frequency) {
      const validFrequencies = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];
      if (!validFrequencies.includes(updates.frequency)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid frequency' } },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};

    const allowedFields = [
      'title', 'description', 'assetId', 'frequency', 'frequencyValue',
      'assignedRoleId', 'checklist', 'lastCompletedAt', 'nextDueAt',
      'status', 'estimatedDuration', 'estimatedCost', 'priority',
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        if (field === 'frequencyValue') {
          updateData[field] = updates[field] ? parseInt(updates[field], 10) : null;
        } else if (field === 'lastCompletedAt' || field === 'nextDueAt') {
          updateData[field] = updates[field] ? new Date(updates[field]) : null;
        } else if (field === 'estimatedDuration') {
          updateData[field] = updates[field] ? parseInt(updates[field], 10) : null;
        } else if (field === 'estimatedCost') {
          updateData[field] = updates[field] ? parseFloat(updates[field]) : null;
        } else {
          updateData[field] = updates[field];
        }
      }
    }

    const updatedItem = await db.preventiveMaintenance.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updatedItem });
  } catch (error) {
    console.error('Error updating preventive maintenance:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update preventive maintenance' } },
      { status: 500 }
    );
  }
}

// DELETE /api/preventive-maintenance/[id] - Soft delete by setting deletedAt
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'maintenance.write') && !hasPermission(user, 'maintenance.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Verify item exists and belongs to user's tenant
    const item = await db.preventiveMaintenance.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!item) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Item not found' } },
        { status: 404 }
      );
    }

    // Soft delete instead of hard delete
    await db.preventiveMaintenance.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'inactive' },
    });

    return NextResponse.json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting preventive maintenance:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete preventive maintenance' } },
      { status: 500 }
    );
  }
}
