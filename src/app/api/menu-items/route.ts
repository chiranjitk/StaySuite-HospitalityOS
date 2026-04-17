import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/menu-items - List all menu items with filtering and pagination
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
    const categoryId = searchParams.get('categoryId');
    const status = searchParams.get('status');
    const isAvailable = searchParams.get('isAvailable');
    const isVegetarian = searchParams.get('isVegetarian');
    const isVegan = searchParams.get('isVegan');
    const isGlutenFree = searchParams.get('isGlutenFree');
    const search = searchParams.get('search');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 100);
    const offset = searchParams.get('offset');
    const stats = searchParams.get('stats');

    const where: Record<string, unknown> = { deletedAt: null };

    // Tenant scoping through property
    if (propertyId) {
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
      where.propertyId = propertyId;
    } else {
      // Get all properties for this tenant
      const properties = await db.property.findMany({
        where: { tenantId: user.tenantId, deletedAt: null },
        select: { id: true },
      });
      const propertyIds = properties.map(p => p.id);
      where.propertyId = { in: propertyIds };
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (status) {
      where.status = status;
    }

    if (isAvailable !== null) {
      where.isAvailable = isAvailable === 'true';
    }

    if (isVegetarian === 'true') {
      where.isVegetarian = true;
    }

    if (isVegan === 'true') {
      where.isVegan = true;
    }

    if (isGlutenFree === 'true') {
      where.isGlutenFree = true;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    // If stats flag is set, return summary statistics
    if (stats === 'true') {
      const statusCounts = await db.menuItem.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      });

      const categoryCounts = await db.menuItem.groupBy({
        by: ['categoryId'],
        where,
        _count: { id: true },
      });

      const avgPrice = await db.menuItem.aggregate({
        where,
        _avg: { price: true },
      });

      const totalItems = await db.menuItem.count({ where });
      const availableItems = await db.menuItem.count({ where: { ...where, isAvailable: true } });

      return NextResponse.json({
        success: true,
        data: {
          statusCounts: statusCounts.reduce((acc, item) => {
            acc[item.status] = item._count.id;
            return acc;
          }, {} as Record<string, number>),
          categoryCounts: categoryCounts.reduce((acc, item) => {
            acc[item.categoryId] = item._count.id;
            return acc;
          }, {} as Record<string, number>),
          avgPrice: avgPrice._avg.price || 0,
          totalItems,
          availableItems,
        },
      });
    }

    const menuItems = await db.menuItem.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            sortOrder: true,
          },
        },
      },
      orderBy: [
        { category: { sortOrder: 'asc' } },
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
      take: limit,
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    const total = await db.menuItem.count({ where });

    return NextResponse.json({
      success: true,
      data: menuItems,
      pagination: {
        total,
        limit,
        offset: offset ? parseInt(offset, 10) : null,
      },
    });
  } catch (error) {
    console.error('Error fetching menu items:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch menu items' } },
      { status: 500 }
    );
  }
}

// POST /api/menu-items - Create a new menu item
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
      categoryId,
      name,
      description,
      imageUrl,
      price,
      currency = 'USD',
      options,
      isVegetarian = false,
      isVegan = false,
      isGlutenFree = false,
      allergens = [],
      isAvailable = true,
      availableTimes,
      preparationTime,
      kitchenStation,
      sortOrder = 0,
      status = 'active',
    } = body;

    // Validate required fields
    if (!propertyId || !categoryId || !name || price === undefined) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: propertyId, categoryId, name, price' } },
        { status: 400 }
      );
    }

    // Validate price
    if (price < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Price cannot be negative' } },
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

    // Verify category exists and belongs to same property
    const category = await db.orderCategory.findFirst({
      where: { id: categoryId, propertyId },
    });

    if (!category) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_CATEGORY', message: 'Category not found or does not belong to this property' } },
        { status: 400 }
      );
    }

    const menuItem = await db.menuItem.create({
      data: {
        propertyId,
        categoryId,
        name,
        description,
        imageUrl,
        price: parseFloat(price),
        currency,
        options: options ? JSON.stringify(options) : '[]',
        isVegetarian,
        isVegan,
        isGlutenFree,
        allergens: JSON.stringify(allergens),
        isAvailable,
        availableTimes: availableTimes ? JSON.stringify(availableTimes) : null,
        preparationTime: preparationTime ? parseInt(preparationTime, 10) : null,
        kitchenStation,
        sortOrder,
        status,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: menuItem }, { status: 201 });
  } catch (error) {
    console.error('Error creating menu item:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create menu item' } },
      { status: 500 }
    );
  }
}

// PUT /api/menu-items - Update a menu item
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
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Menu item ID is required' } },
        { status: 400 }
      );
    }

    // Verify menu item exists and belongs to user's tenant
    const existingItem = await db.menuItem.findFirst({
      where: { id, deletedAt: null },
      include: { property: { select: { tenantId: true } } },
    });

    if (!existingItem) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Menu item not found' } },
        { status: 404 }
      );
    }

    if (existingItem.property.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Validate price if provided
    if (updateData.price !== undefined && updateData.price < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Price cannot be negative' } },
        { status: 400 }
      );
    }

    // If changing category, verify it exists and belongs to same property
    if (updateData.categoryId && updateData.categoryId !== existingItem.categoryId) {
      const category = await db.orderCategory.findFirst({
        where: { id: updateData.categoryId, propertyId: existingItem.propertyId },
      });

      if (!category) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_CATEGORY', message: 'Category not found or does not belong to this property' } },
          { status: 400 }
        );
      }
    }

    // Build update object with only provided fields
    const data: Record<string, unknown> = {};

    const allowedFields = [
      'name', 'description', 'imageUrl', 'price', 'currency', 'options',
      'isVegetarian', 'isVegan', 'isGlutenFree', 'allergens',
      'isAvailable', 'availableTimes', 'preparationTime', 'kitchenStation',
      'sortOrder', 'status', 'categoryId',
    ];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        if (field === 'price') {
          data[field] = parseFloat(updateData[field]);
        } else if (field === 'options' || field === 'allergens' || field === 'availableTimes') {
          data[field] = JSON.stringify(updateData[field]);
        } else if (field === 'preparationTime' || field === 'sortOrder') {
          data[field] = parseInt(updateData[field], 10);
        } else {
          data[field] = updateData[field];
        }
      }
    }

    const menuItem = await db.menuItem.update({
      where: { id },
      data,
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: menuItem });
  } catch (error) {
    console.error('Error updating menu item:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update menu item' } },
      { status: 500 }
    );
  }
}

// DELETE /api/menu-items - Soft delete a menu item
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
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Menu item ID is required' } },
        { status: 400 }
      );
    }

    // Verify menu item exists and belongs to user's tenant
    const existingItem = await db.menuItem.findFirst({
      where: { id, deletedAt: null },
      include: { property: { select: { tenantId: true } } },
    });

    if (!existingItem) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Menu item not found' } },
        { status: 404 }
      );
    }

    if (existingItem.property.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Soft delete
    const menuItem = await db.menuItem.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'inactive',
      },
    });

    return NextResponse.json({ success: true, data: menuItem });
  } catch (error) {
    console.error('Error deleting menu item:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete menu item' } },
      { status: 500 }
    );
  }
}
