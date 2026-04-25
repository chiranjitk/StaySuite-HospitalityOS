import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/tables - List all restaurant tables with filtering and pagination
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
    const area = searchParams.get('area');
    const floor = searchParams.get('floor');
    const search = searchParams.get('search');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 100);
    const offset = searchParams.get('offset');
    const stats = searchParams.get('stats');

    const where: Record<string, unknown> = {};

    // Tenant scoping - user can only see tables from their tenant's properties
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

    if (status) {
      where.status = status;
    }

    if (area) {
      where.area = area;
    }

    if (floor) {
      where.floor = parseInt(floor, 10);
    }

    if (search) {
      where.OR = [
        { number: { contains: search } },
        { name: { contains: search } },
      ];
    }

    // If stats flag is set, return summary statistics
    if (stats === 'true') {
      const statusCounts = await db.restaurantTable.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      });

      const areaCounts = await db.restaurantTable.groupBy({
        by: ['area'],
        where,
        _count: { id: true },
      });

      const totalCapacity = await db.restaurantTable.aggregate({
        where,
        _sum: { capacity: true },
      });

      const totalTables = await db.restaurantTable.count({ where });

      return NextResponse.json({
        success: true,
        data: {
          statusCounts: statusCounts.reduce((acc, item) => {
            acc[item.status || 'unknown'] = item._count.id;
            return acc;
          }, {} as Record<string, number>),
          areaCounts: areaCounts.reduce((acc, item) => {
            acc[item.area || 'unknown'] = item._count.id;
            return acc;
          }, {} as Record<string, number>),
          totalCapacity: totalCapacity._sum.capacity || 0,
          totalTables,
        },
      });
    }

    const tables = await db.restaurantTable.findMany({
      where,
      include: {
        orders: {
          where: {
            status: { in: ['pending', 'confirmed', 'preparing', 'ready'] },
          },
          include: {
            items: {
              include: {
                menuItem: {
                  select: {
                    id: true,
                    name: true,
                    price: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            orders: {
              where: {
                status: { in: ['pending', 'confirmed', 'preparing', 'ready'] },
              },
            },
          },
        },
      },
      orderBy: [
        { floor: 'asc' },
        { number: 'asc' },
      ],
      take: limit,
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    const total = await db.restaurantTable.count({ where });

    return NextResponse.json({
      success: true,
      data: tables,
      pagination: {
        total,
        limit,
        offset: offset ? parseInt(offset, 10) : null,
      },
    });
  } catch (error) {
    console.error('Error fetching tables:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch tables' } },
      { status: 500 }
    );
  }
}

// POST /api/tables - Create a new restaurant table
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
      number,
      name,
      capacity = 4,
      area,
      floor = 1,
      posX,
      posY,
      width,
      height,
      status = 'available',
    } = body;

    // Validate required fields
    if (!propertyId || !number) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: propertyId, number' } },
        { status: 400 }
      );
    }

    // Validate capacity
    if (capacity < 1 || capacity > 100) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Capacity must be between 1 and 100' } },
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

    // Check if table number already exists for this property
    const existingTable = await db.restaurantTable.findUnique({
      where: {
        propertyId_number: {
          propertyId,
          number,
        },
      },
    });

    if (existingTable) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_NUMBER', message: 'Table number already exists for this property' } },
        { status: 400 }
      );
    }

    const table = await db.restaurantTable.create({
      data: {
        propertyId,
        number,
        name,
        capacity,
        area,
        floor,
        posX,
        posY,
        width,
        height,
        status,
      },
    });

    return NextResponse.json({ success: true, data: table }, { status: 201 });
  } catch (error) {
    console.error('Error creating table:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create table' } },
      { status: 500 }
    );
  }
}

// PUT /api/tables - Update a restaurant table
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
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Table ID is required' } },
        { status: 400 }
      );
    }

    // Verify table exists and belongs to user's tenant
    const existingTable = await db.restaurantTable.findFirst({
      where: { id },
      include: { property: { select: { tenantId: true } } },
    });

    if (!existingTable) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Table not found' } },
        { status: 404 }
      );
    }

    if (existingTable.property.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // If updating number, check for duplicates
    if (updateData.number) {
      if (existingTable.number !== updateData.number) {
        const duplicateTable = await db.restaurantTable.findUnique({
          where: {
            propertyId_number: {
              propertyId: existingTable.propertyId,
              number: updateData.number,
            },
          },
        });

        if (duplicateTable) {
          return NextResponse.json(
            { success: false, error: { code: 'DUPLICATE_NUMBER', message: 'Table number already exists for this property' } },
            { status: 400 }
          );
        }
      }
    }

    // Validate capacity if provided
    if (updateData.capacity !== undefined && (updateData.capacity < 1 || updateData.capacity > 100)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Capacity must be between 1 and 100' } },
        { status: 400 }
      );
    }

    // Build update object with only provided fields
    const data: Record<string, unknown> = {};

    const allowedFields = [
      'number', 'name', 'capacity', 'area', 'floor',
      'posX', 'posY', 'width', 'height', 'status',
    ];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        data[field] = updateData[field];
      }
    }

    const table = await db.restaurantTable.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, data: table });
  } catch (error) {
    console.error('Error updating table:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update table' } },
      { status: 500 }
    );
  }
}

// DELETE /api/tables - Delete a restaurant table
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
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Table ID is required' } },
        { status: 400 }
      );
    }

    // Verify table exists and belongs to user's tenant
    const table = await db.restaurantTable.findFirst({
      where: { id },
      include: { property: { select: { tenantId: true } } },
    });

    if (!table) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Table not found' } },
        { status: 404 }
      );
    }

    if (table.property.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Check if table has active orders
    const activeOrders = await db.order.count({
      where: {
        tableId: id,
        status: { in: ['pending', 'confirmed', 'preparing', 'ready'] },
      },
    });

    if (activeOrders > 0) {
      return NextResponse.json(
        { success: false, error: { code: 'HAS_ACTIVE_ORDERS', message: 'Cannot delete table with active orders' } },
        { status: 400 }
      );
    }

    await db.restaurantTable.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Error deleting table:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete table' } },
      { status: 500 }
    );
  }
}
