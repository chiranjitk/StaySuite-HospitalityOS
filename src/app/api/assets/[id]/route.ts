import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/assets/[id] - Get a single asset by ID
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

    const asset = await db.asset.findFirst({
      where: { id, tenantId: user.tenantId, deletedAt: null },
      include: {
        property: {
          select: { id: true, name: true },
        },
        room: {
          select: { id: true, number: true, name: true },
        },
      },
    });

    if (!asset) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Asset not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: asset });
  } catch (error) {
    console.error('Error fetching asset:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch asset' } },
      { status: 500 }
    );
  }
}

// PUT /api/assets/[id] - Update an asset by URL path param
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
      'status', 'conditionScore',
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

// DELETE /api/assets/[id] - Soft delete an asset by URL path param
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
