import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/brands/[id] - Get a single brand
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    if (!hasPermission(user, 'brands.view') && !hasPermission(user, 'settings.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const { id } = await params;

    const brand = await db.brand.findFirst({
      where: { id, tenantId },
      include: {
        properties: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
            city: true,
            country: true,
            status: true,
            totalRooms: true,
          },
        },
        _count: {
          select: {
            properties: true,
          },
        },
      },
    });

    if (!brand) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Brand not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...brand,
        propertyCount: brand._count.properties,
      },
    });
  } catch (error) {
    console.error('Error fetching brand:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch brand' } },
      { status: 500 }
    );
  }
}

// PUT /api/brands/[id] - Update a brand
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    if (!hasPermission(user, 'brands.edit') && !hasPermission(user, 'settings.edit')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const { id } = await params;
    const body = await request.json();

    const {
      name,
      code,
      description,
      logo,
      primaryColor,
      secondaryColor,
      standards,
      status,
    } = body;

    // Check if brand exists and belongs to tenant
    const existingBrand = await db.brand.findFirst({
      where: { id, tenantId },
    });

    if (!existingBrand) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Brand not found' } },
        { status: 404 }
      );
    }

    // If code is being changed, validate and check for duplicates
    if (code && code.toUpperCase() !== existingBrand.code) {
      const trimmedCode = code.trim().toUpperCase();
      if (!/^[A-Z0-9]{1,10}$/.test(trimmedCode)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Code must be alphanumeric and max 10 characters' } },
          { status: 400 }
        );
      }

      const duplicateCode = await db.brand.findFirst({
        where: { code: trimmedCode, tenantId, id: { not: id } },
      });

      if (duplicateCode) {
        return NextResponse.json(
          { success: false, error: { code: 'DUPLICATE_CODE', message: 'A brand with this code already exists' } },
          { status: 400 }
        );
      }
    }

    // Validate status if provided
    if (status !== undefined) {
      const validStatuses = ['active', 'inactive'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid status. Valid statuses: ${validStatuses.join(', ')}` } },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (code !== undefined) updateData.code = code.trim().toUpperCase();
    if (description !== undefined) updateData.description = description;
    if (logo !== undefined) updateData.logo = logo;
    if (primaryColor !== undefined) updateData.primaryColor = primaryColor;
    if (secondaryColor !== undefined) updateData.secondaryColor = secondaryColor;
    if (standards !== undefined) updateData.standards = standards;
    if (status !== undefined) updateData.status = status;

    const brand = await db.brand.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: brand });
  } catch (error) {
    console.error('Error updating brand:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update brand' } },
      { status: 500 }
    );
  }
}

// DELETE /api/brands/[id] - Delete a brand
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    if (!hasPermission(user, 'brands.delete') && !hasPermission(user, 'settings.edit')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const { id } = await params;

    // Check if brand exists and belongs to tenant
    const existingBrand = await db.brand.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: {
            properties: true,
          },
        },
      },
    });

    if (!existingBrand) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Brand not found' } },
        { status: 404 }
      );
    }

    // Check if brand has properties
    if (existingBrand._count.properties > 0) {
      return NextResponse.json(
        { success: false, error: { code: 'HAS_PROPERTIES', message: 'Cannot delete brand with associated properties. Remove properties from brand first.' } },
        { status: 400 }
      );
    }

    await db.brand.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Brand deleted successfully' });
  } catch (error) {
    console.error('Error deleting brand:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete brand' } },
      { status: 500 }
    );
  }
}
