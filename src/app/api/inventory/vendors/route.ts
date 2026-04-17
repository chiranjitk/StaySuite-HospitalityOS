import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Inventory Suppliers (Vendors) API
 *
 * This route manages vendors in the context of INVENTORY / PROCUREMENT.
 * - Scoped to `inventory.view` / `inventory.create` / `inventory.update` / `inventory.delete` permissions
 * - Tracks purchase orders and total spend per vendor
 * - Enforces valid vendor types (supplier, contractor, service, manufacturer, distributor)
 *
 * NOTE: A separate maintenance vendors route exists at /api/vendors
 * that manages vendors for maintenance work orders and vendor portal access,
 * scoped to maintenance permissions. Both operate on the same `Vendor` model but
 * serve different business domains.
 */

// GET /api/inventory/vendors - List all vendors
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
    if (!hasPermission(user, 'inventory.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view vendors' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const limitParam = searchParams.get('limit');
    const offset = searchParams.get('offset');

    // Cap limit at 100
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 100;

    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
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
          select: { purchaseOrders: true },
        },
      },
      orderBy: [
        { name: 'asc' },
      ],
      take: limit,
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    // Get purchase order stats for each vendor
    const vendorIds = vendors.map(v => v.id);
    const purchaseOrderStats = await db.purchaseOrder.groupBy({
      by: ['vendorId'],
      where: {
        vendorId: { in: vendorIds },
        tenantId: user.tenantId,
      },
      _count: true,
      _sum: {
        totalAmount: true,
      },
    });

    const statsMap = new Map(
      purchaseOrderStats.map(stat => [stat.vendorId, stat])
    );

    // Transform vendors with stats
    const transformedVendors = vendors.map(vendor => {
      const stats = statsMap.get(vendor.id);
      return {
        ...vendor,
        totalOrders: stats?._count || 0,
        totalSpent: stats?._sum.totalAmount || 0,
      };
    });

    const total = await db.vendor.count({ where });

    // Get vendor type distribution
    const typeDistribution = await db.vendor.groupBy({
      by: ['type'],
      where: { tenantId: user.tenantId },
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
        activeVendors: await db.vendor.count({ where: { tenantId: user.tenantId, status: 'active' } }),
        typeDistribution: typeDistribution.map(t => ({ type: t.type, count: t._count })),
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

// POST /api/inventory/vendors - Create a new vendor
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
    if (!hasPermission(user, 'inventory.create')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to create vendors' } },
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
    if (email && !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid email format' } },
        { status: 400 }
      );
    }

    // Validate vendor type
    const validTypes = ['supplier', 'contractor', 'service', 'manufacturer', 'distributor'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid type. Must be one of: ${validTypes.join(', ')}` } },
        { status: 400 }
      );
    }

    // Check for duplicate name within tenant
    const existingVendor = await db.vendor.findFirst({
      where: {
        tenantId: user.tenantId,
        name: { equals: name },
      },
    });

    if (existingVendor) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_NAME', message: 'A vendor with this name already exists' } },
        { status: 400 }
      );
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
      },
    });

    return NextResponse.json({ success: true, data: vendor }, { status: 201 });
  } catch (error) {
    console.error('Error creating vendor:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create vendor' } },
      { status: 500 }
    );
  }
}

// PUT /api/inventory/vendors - Update a vendor
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
    if (!hasPermission(user, 'inventory.update')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to update vendors' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Vendor ID is required' } },
        { status: 400 }
      );
    }

    // Validate email format if provided
    if (updates.email && !EMAIL_REGEX.test(updates.email)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid email format' } },
        { status: 400 }
      );
    }

    // Validate vendor type if provided
    if (updates.type) {
      const validTypes = ['supplier', 'contractor', 'service', 'manufacturer', 'distributor'];
      if (!validTypes.includes(updates.type)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid type. Must be one of: ${validTypes.join(', ')}` } },
          { status: 400 }
        );
      }
    }

    // Verify vendor exists and belongs to user's tenant
    const existingVendor = await db.vendor.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existingVendor) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Vendor not found' } },
        { status: 404 }
      );
    }

    const vendor = await db.vendor.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json({ success: true, data: vendor });
  } catch (error) {
    console.error('Error updating vendor:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update vendor' } },
      { status: 500 }
    );
  }
}

// DELETE /api/inventory/vendors - Soft delete vendors (set to inactive)
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
    if (!hasPermission(user, 'inventory.delete')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to delete vendors' } },
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

    const results = await db.vendor.updateMany({
      where: {
        id: { in: ids },
        tenantId: user.tenantId,
      },
      data: {
        status: 'inactive',
      },
    });

    if (results.count === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'No vendors found or access denied' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Deactivated ${results.count} vendors`,
    });
  } catch (error) {
    console.error('Error deleting vendors:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete vendors' } },
      { status: 500 }
    );
  }
}
