import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import crypto from 'crypto';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper to generate unique work order number using crypto (avoids race conditions)
async function generateWorkOrderNumber(tenantId: string): Promise<string> {
  const prefix = 'WO';
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  
  for (let attempt = 0; attempt < 5; attempt++) {
    const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    const candidate = `${prefix}-${year}${month}-${randomSuffix}`;
    
    const existing = await db.workOrder.findFirst({
      where: { workOrderNumber: candidate },
      select: { id: true },
    });
    
    if (!existing) return candidate;
  }
  
  const randomSuffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${year}${month}-${randomSuffix}`;
}

// GET /api/vendors/[id]/work-orders - List work orders for vendor
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    const { id: vendorId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const type = searchParams.get('type');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 100);
    const offset = searchParams.get('offset');

    // Verify vendor exists and belongs to user's tenant
    const vendor = await db.vendor.findFirst({
      where: { id: vendorId, tenantId: user.tenantId, deletedAt: null },
    });

    if (!vendor) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Vendor not found' } },
        { status: 404 }
      );
    }

    const where: Record<string, unknown> = {
      vendorId,
      tenantId: user.tenantId,
      deletedAt: null,
    };

    if (status) {
      where.status = status;
    }

    if (priority) {
      where.priority = priority;
    }

    if (type) {
      where.type = type;
    }

    const workOrders = await db.workOrder.findMany({
      where,
      include: {
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
        { scheduledDate: 'asc' },
        { createdAt: 'desc' },
      ],
      take: limit,
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    // Get stats
    const total = await db.workOrder.count({ where });
    
    const statusStats = await db.workOrder.groupBy({
      by: ['status'],
      where: { vendorId, tenantId: user.tenantId, deletedAt: null },
      _count: true,
    });

    const totalEarnings = await db.vendorPayment.aggregate({
      where: { vendorId, status: 'paid' },
      _sum: { amount: true },
    });

    const pendingPayments = await db.vendorPayment.aggregate({
      where: { vendorId, status: 'pending' },
      _sum: { amount: true },
    });

    return NextResponse.json({
      success: true,
      data: workOrders,
      vendor: {
        id: vendor.id,
        name: vendor.name,
        type: vendor.type,
        status: vendor.status,
      },
      pagination: {
        total,
        limit,
        offset: offset ? parseInt(offset, 10) : null,
      },
      stats: {
        totalWorkOrders: total,
        statusDistribution: statusStats.map(s => ({ status: s.status, count: s._count })),
        totalEarnings: totalEarnings._sum.amount || 0,
        pendingPayments: pendingPayments._sum.amount || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching vendor work orders:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch work orders' } },
      { status: 500 }
    );
  }
}

// POST /api/vendors/[id]/work-orders - Create work order for vendor
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    const { id: vendorId } = await params;
    const body = await request.json();

    // Verify vendor exists and is active
    const vendor = await db.vendor.findFirst({
      where: { id: vendorId, tenantId: user.tenantId, deletedAt: null, status: 'active' },
    });

    if (!vendor) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Vendor not found or inactive' } },
        { status: 404 }
      );
    }

    const {
      propertyId,
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

    // Generate work order number
    const workOrderNumber = await generateWorkOrderNumber(user.tenantId);

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
        status: 'assigned',
        requestedBy: requestedBy || user.name,
        assignedAt: new Date(),
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

// PUT /api/vendors/[id]/work-orders - Update work order status
export async function PUT(request: NextRequest, { params }: RouteParams) {
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

    const { id: vendorId } = await params;
    const body = await request.json();

    const { workOrderId, status, ...updates } = body;

    if (!workOrderId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Work order ID is required' } },
        { status: 400 }
      );
    }

    // Verify work order belongs to this vendor and tenant
    const workOrder = await db.workOrder.findFirst({
      where: { id: workOrderId, vendorId, tenantId: user.tenantId, deletedAt: null },
    });

    if (!workOrder) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Work order not found for this vendor' } },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: Record<string, unknown> = { ...updates };

    // Handle status transitions
    if (status) {
      updateData.status = status;
      
      if (status === 'in_progress' && !workOrder.startedAt) {
        updateData.startedAt = new Date();
      }
      
      if (status === 'completed') {
        updateData.completedAt = new Date();
      }
    }

    const updatedWorkOrder = await db.workOrder.update({
      where: { id: workOrderId },
      data: updateData,
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: updatedWorkOrder });
  } catch (error) {
    console.error('Error updating work order:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update work order' } },
      { status: 500 }
    );
  }
}
