import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/maintenance/work-orders/[id] - Get a single work order
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

    const workOrder = await db.workOrder.findFirst({
      where: { id, tenantId: user.tenantId, deletedAt: null },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            type: true,
            status: true,
          },
        },
        payments: {
          select: {
            id: true,
            paymentNumber: true,
            amount: true,
            status: true,
            paidAt: true,
          },
        },
        property: {
          select: {
            id: true,
            name: true,
          },
        },
        room: {
          select: {
            id: true,
            number: true,
            name: true,
          },
        },
      },
    });

    if (!workOrder) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Work order not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: workOrder });
  } catch (error) {
    console.error('Error fetching work order:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch work order' } },
      { status: 500 }
    );
  }
}

// PUT /api/maintenance/work-orders/[id] - Update work order by URL param
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
    const { vendorId, status, ...updates } = await request.json();

    // Verify work order exists and belongs to user's tenant
    const existingWorkOrder = await db.workOrder.findFirst({
      where: { id, tenantId: user.tenantId, deletedAt: null },
    });

    if (!existingWorkOrder) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Work order not found' } },
        { status: 404 }
      );
    }

    // Validate status transitions
    const validStatusTransitions: Record<string, string[]> = {
      pending: ['assigned', 'in_progress', 'cancelled'],
      assigned: ['in_progress', 'pending', 'cancelled'],
      in_progress: ['completed', 'on_hold', 'cancelled'],
      on_hold: ['in_progress', 'cancelled'],
      completed: [],
      cancelled: ['pending'],
    };

    if (status && !validStatusTransitions[existingWorkOrder.status]?.includes(status)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS_TRANSITION', message: `Cannot transition from ${existingWorkOrder.status} to ${status}` } },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData: Record<string, unknown> = { ...updates };

    // Handle vendor assignment
    if (vendorId !== undefined) {
      if (vendorId) {
        // Verify vendor exists and is active
        const vendor = await db.vendor.findFirst({
          where: { id: vendorId, tenantId: user.tenantId, deletedAt: null, status: 'active' },
        });

        if (!vendor) {
          return NextResponse.json(
            { success: false, error: { code: 'INVALID_VENDOR', message: 'Vendor not found or inactive' } },
            { status: 400 }
          );
        }

        updateData.vendorId = vendorId;

        // Auto-assign status if currently pending
        if (existingWorkOrder.status === 'pending') {
          updateData.status = 'assigned';
          updateData.assignedAt = new Date();
        }
      } else {
        // Unassign vendor
        updateData.vendorId = null;
        updateData.assignedAt = null;

        // Reset status to pending if was assigned
        if (['assigned', 'in_progress'].includes(existingWorkOrder.status)) {
          updateData.status = 'pending';
        }
      }
    }

    // Handle status transitions
    if (status) {
      updateData.status = status;

      if (status === 'in_progress' && !existingWorkOrder.startedAt) {
        updateData.startedAt = new Date();
      }

      if (status === 'completed') {
        updateData.completedAt = new Date();
      }

      if (status === 'cancelled') {
        updateData.deletedAt = new Date();
      }
    }

    const workOrder = await db.workOrder.update({
      where: { id },
      data: updateData,
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            type: true,
          },
        },
        payments: {
          select: {
            id: true,
            paymentNumber: true,
            amount: true,
            status: true,
            paidAt: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: workOrder });
  } catch (error) {
    console.error('Error updating work order:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update work order' } },
      { status: 500 }
    );
  }
}

// DELETE /api/maintenance/work-orders/[id] - Soft delete a single work order by URL param
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

    // Verify work order exists and belongs to user's tenant
    const workOrder = await db.workOrder.findFirst({
      where: { id, tenantId: user.tenantId, deletedAt: null },
    });

    if (!workOrder) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Work order not found' } },
        { status: 404 }
      );
    }

    // Soft delete by setting deletedAt
    await db.workOrder.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'cancelled',
      },
    });

    return NextResponse.json({ success: true, message: 'Work order deleted successfully' });
  } catch (error) {
    console.error('Error deleting work order:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete work order' } },
      { status: 500 }
    );
  }
}
