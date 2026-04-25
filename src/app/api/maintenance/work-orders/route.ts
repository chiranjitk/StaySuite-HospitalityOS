import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import crypto from 'crypto';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper to generate unique work order number using crypto (avoids race conditions from count-based approach)
async function generateWorkOrderNumber(tenantId: string): Promise<string> {
  const prefix = 'WO';
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  
  // Retry loop to handle the unlikely case of collision
  for (let attempt = 0; attempt < 5; attempt++) {
    const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    const candidate = `${prefix}-${year}${month}-${randomSuffix}`;
    
    // Check if this number already exists
    const existing = await db.workOrder.findFirst({
      where: { workOrderNumber: candidate },
      select: { id: true },
    });
    
    if (!existing) return candidate;
  }
  
  // Fallback with longer suffix if somehow still colliding
  const randomSuffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${year}${month}-${randomSuffix}`;
}

// GET /api/maintenance/work-orders - List all work orders
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
    if (!hasPermission(user, 'maintenance.read') && !hasPermission(user, 'maintenance.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const vendorId = searchParams.get('vendorId');
    const roomId = searchParams.get('roomId');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const type = searchParams.get('type');
    const search = searchParams.get('search');
    const scheduledFrom = searchParams.get('scheduledFrom');
    const scheduledTo = searchParams.get('scheduledTo');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 100);
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
      deletedAt: null,
    };

    if (propertyId) {
      where.propertyId = propertyId;
    }

    if (vendorId) {
      where.vendorId = vendorId;
    }

    if (roomId) {
      where.roomId = roomId;
    }

    if (status) {
      where.status = status;
    }

    if (priority) {
      where.priority = priority;
    }

    if (type) {
      where.type = type;
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { workOrderNumber: { contains: search } },
      ];
    }

    if (scheduledFrom || scheduledTo) {
      where.scheduledDate = {};
      if (scheduledFrom) {
        (where.scheduledDate as Record<string, unknown>).gte = new Date(scheduledFrom);
      }
      if (scheduledTo) {
        (where.scheduledDate as Record<string, unknown>).lte = new Date(scheduledTo);
      }
    }

    const workOrders = await db.workOrder.findMany({
      where,
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
          where: { status: 'paid' },
          select: {
            id: true,
            amount: true,
            paidAt: true,
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { status: 'asc' },
        { scheduledDate: 'asc' },
        { createdAt: 'desc' },
      ],
      take: limit,
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    const total = await db.workOrder.count({ where });

    // Get status distribution
    const statusStats = await db.workOrder.groupBy({
      by: ['status'],
      where: { tenantId: user.tenantId, deletedAt: null },
      _count: true,
    });

    // Get priority distribution
    const priorityStats = await db.workOrder.groupBy({
      by: ['priority'],
      where: { tenantId: user.tenantId, deletedAt: null },
      _count: true,
    });

    // Get type distribution
    const typeStats = await db.workOrder.groupBy({
      by: ['type'],
      where: { tenantId: user.tenantId, deletedAt: null },
      _count: true,
    });

    // Get cost summaries
    const costSummary = await db.workOrder.aggregate({
      where: { tenantId: user.tenantId, deletedAt: null },
      _sum: {
        estimatedCost: true,
        actualCost: true,
      },
    });

    // Calculate overdue work orders
    const now = new Date();
    const overdueCount = await db.workOrder.count({
      where: {
        tenantId: user.tenantId,
        deletedAt: null,
        status: { notIn: ['completed', 'cancelled'] },
        scheduledDate: { lt: now },
      },
    });

    return NextResponse.json({
      success: true,
      data: workOrders,
      pagination: {
        total,
        limit,
        offset: offset ? parseInt(offset, 10) : null,
      },
      stats: {
        totalWorkOrders: total,
        overdueWorkOrders: overdueCount,
        statusDistribution: statusStats.map(s => ({ status: s.status, count: s._count })),
        priorityDistribution: priorityStats.map(p => ({ priority: p.priority, count: p._count })),
        typeDistribution: typeStats.map(t => ({ type: t.type, count: t._count })),
        totalEstimatedCost: costSummary._sum.estimatedCost || 0,
        totalActualCost: costSummary._sum.actualCost || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching work orders:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch work orders' } },
      { status: 500 }
    );
  }
}

// POST /api/maintenance/work-orders - Create work order
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
    if (!hasPermission(user, 'maintenance.write') && !hasPermission(user, 'maintenance.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();

    const {
      propertyId,
      vendorId,
      roomId,
      assetId,
      title,
      description,
      type = 'general',
      priority = 'medium',
      requestedBy,
      scheduledDate,
      estimatedCost,
      estimatedHours,
      notes,
      attachments,
    } = body;

    // Validate required fields
    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Property ID is required' } },
        { status: 400 }
      );
    }

    if (!title) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Work order title is required' } },
        { status: 400 }
      );
    }

    // Verify property belongs to user's tenant
    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId: user.tenantId, deletedAt: null },
    });

    if (!property) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PROPERTY', message: 'Property not found' } },
        { status: 400 }
      );
    }

    // Verify vendor exists if specified
    if (vendorId) {
      const vendor = await db.vendor.findFirst({
        where: { id: vendorId, tenantId: user.tenantId, deletedAt: null, status: 'active' },
      });

      if (!vendor) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_VENDOR', message: 'Vendor not found or inactive' } },
          { status: 400 }
        );
      }
    }

    // Generate work order number
    const workOrderNumber = await generateWorkOrderNumber(user.tenantId);

    // Determine initial status
    const status = vendorId ? 'assigned' : 'pending';

    const workOrder = await db.workOrder.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        vendorId,
        roomId,
        assetId,
        workOrderNumber,
        title,
        description,
        type,
        priority,
        status,
        requestedBy: requestedBy || user.name,
        assignedAt: vendorId ? new Date() : null,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        estimatedCost,
        estimatedHours,
        notes,
        attachments: attachments ? JSON.stringify(attachments) : '[]',
      },
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
      },
    });

    return NextResponse.json({ success: true, data: workOrder }, { status: 201 });
  } catch (error) {
    console.error('Error creating work order:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create work order' } },
      { status: 500 }
    );
  }
}

// PUT /api/maintenance/work-orders - Update work order (assign to vendor, update status)
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
    if (!hasPermission(user, 'maintenance.write') && !hasPermission(user, 'maintenance.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, vendorId, status, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Work order ID is required' } },
        { status: 400 }
      );
    }

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

// DELETE /api/maintenance/work-orders - Soft delete work orders
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
    if (!hasPermission(user, 'maintenance.write') && !hasPermission(user, 'maintenance.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const ids = searchParams.get('ids')?.split(',');

    if (!ids || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Work order IDs are required' } },
        { status: 400 }
      );
    }

    // Soft delete by setting deletedAt
    const results = await db.workOrder.updateMany({
      where: {
        id: { in: ids },
        tenantId: user.tenantId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
        status: 'cancelled',
      },
    });

    return NextResponse.json({
      success: true,
      message: `Soft deleted ${results.count} work orders`,
      data: { count: results.count },
    });
  } catch (error) {
    console.error('Error deleting work orders:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete work orders' } },
      { status: 500 }
    );
  }
}
