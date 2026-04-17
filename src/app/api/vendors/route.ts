import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import bcrypt from 'bcryptjs';

/**
 * Maintenance Vendors API
 *
 * This route manages vendors in the context of MAINTENANCE OPERATIONS.
 * - Scoped to `maintenance.read` / `maintenance.write` permissions
 * - Tracks vendor work orders, payments, and portal access
 * - Supports soft-delete via `deletedAt` field
 * - Includes vendor portal login (portalEmail / portalPassword)
 *
 * NOTE: A separate inventory vendors route exists at /api/inventory/vendors
 * that manages vendors as SUPPLIERS for inventory purchasing/purchase orders,
 * scoped to inventory permissions. Both operate on the same `Vendor` model but
 * serve different business domains.
 */

// GET /api/vendors - List vendors with filtering
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
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 100);
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
      deletedAt: null,
    };

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { contactPerson: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const vendors = await db.vendor.findMany({
      where,
      include: {
        _count: {
          select: { 
            workOrders: { where: { deletedAt: null } },
            payments: true,
            purchaseOrders: true 
          },
        },
      },
      orderBy: [
        { name: 'asc' },
      ],
      take: limit,
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    // Get work order stats for each vendor
    const vendorIds = vendors.map(v => v.id);
    
    const workOrderStats = await db.workOrder.groupBy({
      by: ['vendorId'],
      where: {
        vendorId: { in: vendorIds },
        tenantId: user.tenantId,
        deletedAt: null,
      },
      _count: true,
      _sum: {
        actualCost: true,
        estimatedCost: true,
      },
    });

    const paymentStats = await db.vendorPayment.groupBy({
      by: ['vendorId'],
      where: {
        vendorId: { in: vendorIds },
      },
      _count: true,
      _sum: {
        amount: true,
      },
    });

    const workOrderMap = new Map(
      workOrderStats.filter(s => s.vendorId).map(stat => [stat.vendorId, stat])
    );

    const paymentMap = new Map(
      paymentStats.map(stat => [stat.vendorId, stat])
    );

    // Transform vendors with stats
    const transformedVendors = vendors.map(vendor => {
      const woStats = workOrderMap.get(vendor.id);
      const payStats = paymentMap.get(vendor.id);
      return {
        id: vendor.id,
        tenantId: vendor.tenantId,
        name: vendor.name,
        contactPerson: vendor.contactPerson,
        email: vendor.email,
        phone: vendor.phone,
        address: vendor.address,
        type: vendor.type,
        paymentTerms: vendor.paymentTerms,
        status: vendor.status,
        notes: vendor.notes,
        portalEmail: vendor.portalEmail,
        lastPortalLogin: vendor.lastPortalLogin,
        createdAt: vendor.createdAt,
        updatedAt: vendor.updatedAt,
        totalWorkOrders: woStats?._count || 0,
        totalWorkOrderCost: woStats?._sum.actualCost || 0,
        totalPayments: payStats?._count || 0,
        totalPaidAmount: payStats?._sum.amount || 0,
        purchaseOrderCount: vendor._count.purchaseOrders,
      };
    });

    const total = await db.vendor.count({ where });

    // Get vendor type distribution
    const typeDistribution = await db.vendor.groupBy({
      by: ['type'],
      where: { tenantId: user.tenantId, deletedAt: null },
      _count: true,
    });

    // Get status distribution
    const statusDistribution = await db.vendor.groupBy({
      by: ['status'],
      where: { tenantId: user.tenantId, deletedAt: null },
      _count: true,
    });

    return NextResponse.json({
      success: true,
      data: transformedVendors,
      pagination: {
        total,
        limit,
        offset: offset ? parseInt(offset, 10) : null,
      },
      stats: {
        totalVendors: total,
        activeVendors: await db.vendor.count({ where: { tenantId: user.tenantId, status: 'active', deletedAt: null } }),
        typeDistribution: typeDistribution.map(t => ({ type: t.type, count: t._count })),
        statusDistribution: statusDistribution.map(s => ({ status: s.status, count: s._count })),
      },
    });
  } catch (error) {
    console.error('Error fetching vendors:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch vendors' } },
      { status: 500 }
    );
  }
}

// POST /api/vendors - Create a new vendor
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
      name,
      contactPerson,
      email,
      phone,
      address,
      type,
      paymentTerms,
      status = 'active',
      notes,
      portalEmail,
      portalPassword,
    } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Vendor name is required' } },
        { status: 400 }
      );
    }

    if (!type) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Vendor type is required' } },
        { status: 400 }
      );
    }

    // Validate email format if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid email format' } },
        { status: 400 }
      );
    }

    // Validate portal email format if provided
    if (portalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(portalEmail)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid portal email format' } },
        { status: 400 }
      );
    }

    // Check for duplicate name within tenant
    const existingVendor = await db.vendor.findFirst({
      where: {
        tenantId: user.tenantId,
        name: { equals: name },
        deletedAt: null,
      },
    });

    if (existingVendor) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_NAME', message: 'A vendor with this name already exists' } },
        { status: 400 }
      );
    }

    // Check for duplicate portal email if provided
    if (portalEmail) {
      const existingPortalEmail = await db.vendor.findUnique({
        where: { portalEmail },
      });

      if (existingPortalEmail) {
        return NextResponse.json(
          { success: false, error: { code: 'DUPLICATE_PORTAL_EMAIL', message: 'A vendor with this portal email already exists' } },
          { status: 400 }
        );
      }
    }

    // Hash portal password if provided
    let hashedPassword: string | null = null;
    if (portalPassword) {
      if (portalPassword.length < 8) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters' } },
          { status: 400 }
        );
      }
      hashedPassword = await bcrypt.hash(portalPassword, 12);
    }

    const vendor = await db.vendor.create({
      data: {
        tenantId: user.tenantId,
        name,
        contactPerson,
        email,
        phone,
        address,
        type,
        paymentTerms,
        status,
        notes,
        portalEmail,
        portalPassword: hashedPassword,
      },
    });

    // Return vendor without password
    const { portalPassword: _password, ...vendorWithoutPassword } = vendor;

    return NextResponse.json({ success: true, data: vendorWithoutPassword }, { status: 201 });
  } catch (error) {
    console.error('Error creating vendor:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create vendor' } },
      { status: 500 }
    );
  }
}

// PUT /api/vendors - Update a vendor
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
    const { id, portalPassword, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Vendor ID is required' } },
        { status: 400 }
      );
    }

    // Verify vendor exists and is not deleted
    const existingVendor = await db.vendor.findFirst({
      where: { id, tenantId: user.tenantId, deletedAt: null },
    });

    if (!existingVendor) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Vendor not found' } },
        { status: 404 }
      );
    }

    // Validate email format if provided
    if (updates.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid email format' } },
        { status: 400 }
      );
    }

    // Check for duplicate portal email if changing
    if (updates.portalEmail && updates.portalEmail !== existingVendor.portalEmail) {
      const existingPortalEmail = await db.vendor.findUnique({
        where: { portalEmail: updates.portalEmail },
      });

      if (existingPortalEmail) {
        return NextResponse.json(
          { success: false, error: { code: 'DUPLICATE_PORTAL_EMAIL', message: 'A vendor with this portal email already exists' } },
          { status: 400 }
        );
      }
    }

    // Validate password if provided
    if (portalPassword && portalPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters' } },
        { status: 400 }
      );
    }

    // Hash new password if provided
    const updateData: Record<string, unknown> = { ...updates };
    if (portalPassword) {
      updateData.portalPassword = await bcrypt.hash(portalPassword, 12);
    }

    const vendor = await db.vendor.update({
      where: { id },
      data: updateData,
    });

    // Return vendor without password
    const { portalPassword: _password, ...vendorWithoutPassword } = vendor;

    return NextResponse.json({ success: true, data: vendorWithoutPassword });
  } catch (error) {
    console.error('Error updating vendor:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update vendor' } },
      { status: 500 }
    );
  }
}

// DELETE /api/vendors - Soft delete vendors
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
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Vendor IDs are required' } },
        { status: 400 }
      );
    }

    // Soft delete by setting deletedAt
    const results = await db.vendor.updateMany({
      where: {
        id: { in: ids },
        tenantId: user.tenantId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
        status: 'inactive',
      },
    });

    return NextResponse.json({
      success: true,
      message: `Soft deleted ${results.count} vendors`,
      data: { count: results.count },
    });
  } catch (error) {
    console.error('Error deleting vendors:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete vendors' } },
      { status: 500 }
    );
  }
}
