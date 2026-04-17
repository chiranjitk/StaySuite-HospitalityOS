import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/amenities/[id] - Get single amenity
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
    if (!hasPermission(user, 'amenities.view') && !hasPermission(user, 'settings.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const { id } = await params;

    const amenity = await db.amenity.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!amenity) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Amenity not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: amenity,
    });
  } catch (error) {
    console.error('Error fetching amenity:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch amenity' } },
      { status: 500 }
    );
  }
}

// PUT /api/amenities/[id] - Update amenity
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
    if (!hasPermission(user, 'amenities.edit') && !hasPermission(user, 'settings.edit')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const { id } = await params;
    const body = await request.json();

    const { name, icon, category, isActive, sortOrder } = body;

    // Check if amenity exists
    const existingAmenity = await db.amenity.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!existingAmenity) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Amenity not found' } },
        { status: 404 }
      );
    }

    // Validate category if provided
    if (category !== undefined) {
      const validCategories = ['general', 'room', 'property', 'services', 'accessibility', 'wellness', 'business', 'dining'];
      if (!validCategories.includes(category)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid category. Valid categories: ${validCategories.join(', ')}` } },
          { status: 400 }
        );
      }
    }

    // Check for duplicate name if name is being changed
    if (name && name !== existingAmenity.name) {
      const duplicate = await db.amenity.findFirst({
        where: {
          tenantId,
          name,
          id: { not: id },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { success: false, error: { code: 'DUPLICATE_NAME', message: 'An amenity with this name already exists' } },
          { status: 400 }
        );
      }
    }

    const amenity = await db.amenity.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(icon !== undefined && { icon }),
        ...(category !== undefined && { category }),
        ...(isActive !== undefined && { isActive }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });

    return NextResponse.json({
      success: true,
      data: amenity,
    });
  } catch (error) {
    console.error('Error updating amenity:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update amenity' } },
      { status: 500 }
    );
  }
}

// DELETE /api/amenities/[id] - Delete amenity
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
    if (!hasPermission(user, 'amenities.delete') && !hasPermission(user, 'settings.edit')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const { id } = await params;

    // Check if amenity exists and is not default
    const existingAmenity = await db.amenity.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!existingAmenity) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Amenity not found' } },
        { status: 404 }
      );
    }

    if (existingAmenity.isDefault) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CANNOT_DELETE_DEFAULT',
            message: 'Cannot delete default amenities. You can deactivate them instead.'
          }
        },
        { status: 400 }
      );
    }

    await db.amenity.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Amenity deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting amenity:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete amenity' } },
      { status: 500 }
    );
  }
}
