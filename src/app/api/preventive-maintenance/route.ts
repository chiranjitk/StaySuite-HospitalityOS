import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/preventive-maintenance - List all preventive maintenance items
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
    const status = searchParams.get('status');
    const frequency = searchParams.get('frequency');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 100);
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = { 
      tenantId: user.tenantId,
      deletedAt: null,
    };

    if (propertyId) {
      where.propertyId = propertyId;
    }

    if (status) {
      where.status = status;
    }

    if (frequency) {
      where.frequency = frequency;
    }

    const preventiveItems = await db.preventiveMaintenance.findMany({
      where,
      orderBy: [
        { nextDueAt: 'asc' },
        { title: 'asc' },
      ],
      take: limit,
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    const total = await db.preventiveMaintenance.count({ where });

    // Calculate summary statistics
    const statusCounts = await db.preventiveMaintenance.groupBy({
      by: ['status'],
      where: { tenantId: user.tenantId, deletedAt: null },
      _count: {
        id: true,
      },
    });

    const frequencyCounts = await db.preventiveMaintenance.groupBy({
      by: ['frequency'],
      where: { tenantId: user.tenantId, deletedAt: null },
      _count: {
        id: true,
      },
    });

    // Get items due soon (within 7 days)
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const dueSoonCount = await db.preventiveMaintenance.count({
      where: {
        tenantId: user.tenantId,
        deletedAt: null,
        nextDueAt: {
          gte: now,
          lte: sevenDaysLater,
        },
        status: 'active',
      },
    });

    const overdueCount = await db.preventiveMaintenance.count({
      where: {
        tenantId: user.tenantId,
        deletedAt: null,
        nextDueAt: {
          lt: now,
        },
        status: 'active',
      },
    });

    return NextResponse.json({
      success: true,
      data: preventiveItems,
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
        byFrequency: frequencyCounts.reduce((acc, item) => {
          acc[item.frequency] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
        dueSoon: dueSoonCount,
        overdue: overdueCount,
      },
    });
  } catch (error) {
    console.error('Error fetching preventive maintenance:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch preventive maintenance' } },
      { status: 500 }
    );
  }
}

// POST /api/preventive-maintenance - Create a new preventive maintenance item
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
      title,
      description,
      assetId,
      frequency,
      frequencyValue,
      assignedRoleId,
      checklist,
      lastCompletedAt,
      nextDueAt,
      status = 'active',
    } = body;

    // Validate required fields
    if (!title || !frequency) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Title and frequency are required' } },
        { status: 400 }
      );
    }

    // Validate frequency
    const validFrequencies = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];
    if (!validFrequencies.includes(frequency)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid frequency. Must be one of: daily, weekly, monthly, quarterly, yearly' } },
        { status: 400 }
      );
    }

    // Verify property belongs to tenant if specified
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

    // Verify asset belongs to tenant if specified
    if (assetId) {
      const asset = await db.asset.findFirst({
        where: { id: assetId, tenantId: user.tenantId, deletedAt: null },
      });

      if (!asset) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_ASSET', message: 'Asset not found' } },
          { status: 400 }
        );
      }
    }

    const item = await db.preventiveMaintenance.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        title,
        description,
        assetId,
        frequency,
        frequencyValue: frequencyValue ? parseInt(frequencyValue, 10) : null,
        assignedRoleId,
        checklist: checklist || '[]',
        lastCompletedAt: lastCompletedAt ? new Date(lastCompletedAt) : null,
        nextDueAt: nextDueAt ? new Date(nextDueAt) : null,
        status,
      },
    });

    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (error) {
    console.error('Error creating preventive maintenance:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create preventive maintenance' } },
      { status: 500 }
    );
  }
}

// PUT /api/preventive-maintenance - Update a preventive maintenance item
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
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'ID is required' } },
        { status: 400 }
      );
    }

    // Verify item exists and belongs to user's tenant
    const existingItem = await db.preventiveMaintenance.findFirst({
      where: { id, tenantId: user.tenantId, deletedAt: null },
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
      'assignedRoleId', 'checklist', 'lastCompletedAt', 'nextDueAt', 'status'
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        if (field === 'frequencyValue') {
          updateData[field] = updates[field] ? parseInt(updates[field], 10) : null;
        } else if (field === 'lastCompletedAt' || field === 'nextDueAt') {
          updateData[field] = updates[field] ? new Date(updates[field]) : null;
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

// DELETE /api/preventive-maintenance - Delete a preventive maintenance item
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
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'ID is required' } },
        { status: 400 }
      );
    }

    // Verify item exists and belongs to user's tenant
    const item = await db.preventiveMaintenance.findFirst({
      where: { id, tenantId: user.tenantId, deletedAt: null },
    });

    if (!item) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Item not found' } },
        { status: 404 }
      );
    }

    await db.preventiveMaintenance.update({
      where: { id },
      data: { deletedAt: new Date() },
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
