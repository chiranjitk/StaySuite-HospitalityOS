import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/assets - List all assets with filtering
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
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 100);
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = { 
      tenantId: user.tenantId,
      deletedAt: null 
    };

    if (propertyId) {
      where.propertyId = propertyId;
    }

    if (category) {
      where.category = category;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { serialNumber: { contains: search } },
        { modelNumber: { contains: search } },
      ];
    }

    const assets = await db.asset.findMany({
      where,
      orderBy: [
        { name: 'asc' },
      ],
      take: limit,
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    const total = await db.asset.count({ where });

    // Calculate summary statistics
    const statusCounts = await db.asset.groupBy({
      by: ['status'],
      where: { tenantId: user.tenantId, deletedAt: null },
      _count: {
        id: true,
      },
    });

    const categoryCounts = await db.asset.groupBy({
      by: ['category'],
      where: { tenantId: user.tenantId, deletedAt: null },
      _count: {
        id: true,
      },
    });

    const totalValue = await db.asset.aggregate({
      where: { tenantId: user.tenantId, deletedAt: null },
      _sum: {
        currentValue: true,
        purchasePrice: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: assets,
      pagination: {
        total,
        limit,
        offset: offset ? parseInt(offset, 10) : null,
      },
      summary: {
        byStatus: statusCounts.reduce((acc, item) => {
          acc[item.status] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
        byCategory: categoryCounts.reduce((acc, item) => {
          acc[item.category] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
        totalValue: totalValue._sum.currentValue || 0,
        totalPurchaseValue: totalValue._sum.purchasePrice || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching assets:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch assets' } },
      { status: 500 }
    );
  }
}

// POST /api/assets - Create a new asset
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
      name,
      category,
      description,
      roomId,
      location,
      purchasePrice,
      purchaseDate,
      currentValue,
      warrantyExpiry,
      warrantyProvider,
      serialNumber,
      modelNumber,
      manufacturer,
      maintenanceIntervalDays,
      status = 'active',
    } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Asset name is required' } },
        { status: 400 }
      );
    }

    // Validate numeric fields
    if (purchasePrice !== undefined && purchasePrice < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Purchase price cannot be negative' } },
        { status: 400 }
      );
    }

    if (currentValue !== undefined && currentValue < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Current value cannot be negative' } },
        { status: 400 }
      );
    }

    // Verify property belongs to user's tenant if specified
    if (propertyId) {
      const property = await db.property.findFirst({
        where: { id: propertyId, tenantId: user.tenantId, deletedAt: null },
      });

      if (!property) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_PROPERTY', message: 'Property not found' } },
          { status: 400 }
        );
      }
    }

    const asset = await db.asset.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        name,
        category: category || 'other',
        description,
        roomId,
        location,
        purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        currentValue: currentValue ? parseFloat(currentValue) : null,
        warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null,
        warrantyProvider,
        serialNumber,
        modelNumber,
        manufacturer,
        maintenanceIntervalDays: maintenanceIntervalDays ? parseInt(maintenanceIntervalDays, 10) : null,
        status,
      },
    });

    return NextResponse.json({ success: true, data: asset }, { status: 201 });
  } catch (error) {
    console.error('Error creating asset:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create asset' } },
      { status: 500 }
    );
  }
}

// PUT /api/assets - Update an asset
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
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Asset ID is required' } },
        { status: 400 }
      );
    }

    // Verify asset exists and belongs to user's tenant
    const existingAsset = await db.asset.findFirst({
      where: { id, tenantId: user.tenantId, deletedAt: null },
    });

    if (!existingAsset) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Asset not found' } },
        { status: 404 }
      );
    }

    // Validate numeric fields
    if (updates.purchasePrice !== undefined && updates.purchasePrice < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Purchase price cannot be negative' } },
        { status: 400 }
      );
    }

    if (updates.currentValue !== undefined && updates.currentValue < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Current value cannot be negative' } },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    
    const allowedFields = [
      'name', 'category', 'description', 'roomId', 'location',
      'purchasePrice', 'purchaseDate', 'currentValue',
      'warrantyExpiry', 'warrantyProvider',
      'serialNumber', 'modelNumber', 'manufacturer',
      'lastMaintenanceAt', 'nextMaintenanceAt', 'maintenanceIntervalDays',
      'status'
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        if (field === 'purchasePrice' || field === 'currentValue') {
          updateData[field] = updates[field] ? parseFloat(updates[field]) : null;
        } else if (field === 'purchaseDate' || field === 'warrantyExpiry' || 
                   field === 'lastMaintenanceAt' || field === 'nextMaintenanceAt') {
          updateData[field] = updates[field] ? new Date(updates[field]) : null;
        } else if (field === 'maintenanceIntervalDays') {
          updateData[field] = updates[field] ? parseInt(updates[field], 10) : null;
        } else {
          updateData[field] = updates[field];
        }
      }
    }

    const updatedAsset = await db.asset.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updatedAsset });
  } catch (error) {
    console.error('Error updating asset:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update asset' } },
      { status: 500 }
    );
  }
}

// DELETE /api/assets - Delete an asset (soft delete)
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
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Asset ID is required' } },
        { status: 400 }
      );
    }

    // Verify asset exists and belongs to user's tenant
    const asset = await db.asset.findFirst({
      where: { id, tenantId: user.tenantId, deletedAt: null },
    });

    if (!asset) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Asset not found' } },
        { status: 404 }
      );
    }

    // Soft delete
    await db.asset.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true, message: 'Asset deleted successfully' });
  } catch (error) {
    console.error('Error deleting asset:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete asset' } },
      { status: 500 }
    );
  }
}
