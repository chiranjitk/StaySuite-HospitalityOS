import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/menu-categories - List all menu categories for a property
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
    if (!hasPermission(user, 'restaurant.read') && !hasPermission(user, 'restaurant.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status');

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Property ID is required' } },
        { status: 400 }
      );
    }

    // Verify property belongs to user's tenant
    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId: user.tenantId, deletedAt: null },
      select: { id: true },
    });

    if (!property) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PROPERTY', message: 'Property not found' } },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = { propertyId };

    if (status) {
      where.status = status;
    }

    const categories = await db.orderCategory.findMany({
      where,
      include: {
        _count: {
          select: {
            menuItems: {
              where: { deletedAt: null },
            },
          },
        },
      },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('Error fetching menu categories:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch menu categories' } },
      { status: 500 }
    );
  }
}

// POST /api/menu-categories - Create a new menu category
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
    if (!hasPermission(user, 'restaurant.write') && !hasPermission(user, 'restaurant.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();

    const {
      propertyId,
      name,
      description,
      imageUrl,
      sortOrder = 0,
      status = 'active',
    } = body;

    // Validate required fields
    if (!propertyId || !name) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: propertyId, name' } },
        { status: 400 }
      );
    }

    // Verify property belongs to user's tenant
    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId: user.tenantId, deletedAt: null },
      select: { id: true },
    });

    if (!property) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PROPERTY', message: 'Property not found' } },
        { status: 400 }
      );
    }

    // Check for duplicate category name in property
    const existingCategory = await db.orderCategory.findFirst({
      where: {
        propertyId,
        name: { equals: name },
      },
    });

    if (existingCategory) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_NAME', message: 'A category with this name already exists' } },
        { status: 400 }
      );
    }

    const category = await db.orderCategory.create({
      data: {
        propertyId,
        name,
        description,
        imageUrl,
        sortOrder,
        status,
      },
    });

    return NextResponse.json({ success: true, data: category }, { status: 201 });
  } catch (error) {
    console.error('Error creating menu category:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create menu category' } },
      { status: 500 }
    );
  }
}

// PUT /api/menu-categories - Update a menu category
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
    if (!hasPermission(user, 'restaurant.write') && !hasPermission(user, 'restaurant.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Category ID is required' } },
        { status: 400 }
      );
    }

    // Verify category exists and belongs to user's tenant
    const existingCategory = await db.orderCategory.findFirst({
      where: { id },
      include: { property: { select: { tenantId: true } } },
    });

    if (!existingCategory) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Category not found' } },
        { status: 404 }
      );
    }

    if (existingCategory.property.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Check for duplicate name if changing name
    if (updateData.name && updateData.name !== existingCategory.name) {
      const duplicateCategory = await db.orderCategory.findFirst({
        where: {
          propertyId: existingCategory.propertyId,
          name: { equals: updateData.name },
          id: { not: id },
        },
      });

      if (duplicateCategory) {
        return NextResponse.json(
          { success: false, error: { code: 'DUPLICATE_NAME', message: 'A category with this name already exists' } },
          { status: 400 }
        );
      }
    }

    const category = await db.orderCategory.update({
      where: { id },
      data: {
        ...(updateData.name && { name: updateData.name }),
        ...(updateData.description !== undefined && { description: updateData.description }),
        ...(updateData.imageUrl !== undefined && { imageUrl: updateData.imageUrl }),
        ...(updateData.sortOrder !== undefined && { sortOrder: updateData.sortOrder }),
        ...(updateData.status && { status: updateData.status }),
      },
    });

    return NextResponse.json({ success: true, data: category });
  } catch (error) {
    console.error('Error updating menu category:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update menu category' } },
      { status: 500 }
    );
  }
}

// DELETE /api/menu-categories - Delete a menu category
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
    if (!hasPermission(user, 'restaurant.write') && !hasPermission(user, 'restaurant.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Category ID is required' } },
        { status: 400 }
      );
    }

    // Verify category exists and belongs to user's tenant
    const existingCategory = await db.orderCategory.findFirst({
      where: { id },
      include: { property: { select: { tenantId: true } } },
    });

    if (!existingCategory) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Category not found' } },
        { status: 404 }
      );
    }

    if (existingCategory.property.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Check if category has menu items
    const itemsCount = await db.menuItem.count({
      where: { categoryId: id, deletedAt: null },
    });

    if (itemsCount > 0) {
      return NextResponse.json(
        { success: false, error: { code: 'CATEGORY_IN_USE', message: 'Cannot delete category with associated menu items' } },
        { status: 400 }
      );
    }

    await db.orderCategory.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Menu category deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting menu category:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete menu category' } },
      { status: 500 }
    );
  }
}
