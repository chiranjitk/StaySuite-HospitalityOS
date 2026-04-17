import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/inspection-templates - List templates for tenant
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // RBAC check
    if (
      !hasPermission(currentUser, 'tasks.view') &&
      !hasPermission(currentUser, 'tasks.*') &&
      !hasPermission(currentUser, 'housekeeping.view')
    ) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const roomType = searchParams.get('roomType');
    const category = searchParams.get('category');
    const isActive = searchParams.get('isActive');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // Build where clause
    const where: Record<string, unknown> = {
      tenantId: currentUser.tenantId,
    };

    if (propertyId) {
      where.propertyId = propertyId;
    }

    if (roomType) {
      where.roomType = roomType;
    }

    if (category) {
      where.category = category;
    }

    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }

    if (search) {
      where.name = { contains: search };
    }

    const skip = (page - 1) * limit;

    const [templates, total] = await Promise.all([
      db.inspectionTemplate.findMany({
        where,
        orderBy: [
          { sortOrder: 'asc' },
          { createdAt: 'desc' },
        ],
        skip,
        take: limit,
      }),
      db.inspectionTemplate.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: templates,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching inspection templates:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch inspection templates' } },
      { status: 500 }
    );
  }
}

// POST /api/inspection-templates - Create a template
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // RBAC check
    if (
      !hasPermission(currentUser, 'tasks.create') &&
      !hasPermission(currentUser, 'tasks.*') &&
      currentUser.roleName !== 'admin'
    ) {
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
      roomType,
      category,
      items,
      isActive = true,
      sortOrder = 0,
    } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: name' } },
        { status: 400 }
      );
    }

    // Validate items is a valid JSON array with required fields
    if (items && !Array.isArray(items)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'items must be an array' } },
        { status: 400 }
      );
    }

    if (items && Array.isArray(items)) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.id || !item.name || item.required === undefined || item.sortOrder === undefined) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: `items[${i}] is missing required fields: id, name, required, sortOrder` } },
            { status: 400 }
          );
        }
      }
    }

    // If propertyId provided, verify it belongs to tenant
    if (propertyId) {
      const property = await db.property.findUnique({
        where: { id: propertyId, deletedAt: null },
      });
      if (!property || property.tenantId !== currentUser.tenantId) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_PROPERTY', message: 'Property not found or not owned by tenant' } },
          { status: 400 }
        );
      }
    }

    const template = await db.inspectionTemplate.create({
      data: {
        tenantId: currentUser.tenantId,
        propertyId: propertyId || null,
        name,
        description: description || null,
        roomType: roomType || null,
        category: category || 'room',
        items: items ? JSON.stringify(items) : '[]',
        isActive,
        sortOrder,
      },
    });

    return NextResponse.json({ success: true, data: template }, { status: 201 });
  } catch (error) {
    console.error('Error creating inspection template:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create inspection template' } },
      { status: 500 }
    );
  }
}
