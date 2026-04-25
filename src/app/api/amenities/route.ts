import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/amenities - List all amenities for tenant
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
    if (!hasPermission(user, 'amenities.view') && !hasPermission(user, 'settings.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Record<string, unknown> = {
      tenantId,
    };

    if (category) {
      where.category = category;
    }

    if (!includeInactive) {
      where.isActive = true;
    }

    const total = await db.amenity.count({ where });

    const amenities = await db.amenity.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
      take: limit,
      skip: offset,
    });

    return NextResponse.json({
      success: true,
      pagination: { total, limit, offset },
      data: amenities,
    });
  } catch (error) {
    console.error('Error fetching amenities:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch amenities' } },
      { status: 500 }
    );
  }
}

// POST /api/amenities - Create a new amenity
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
    if (!hasPermission(user, 'amenities.create') && !hasPermission(user, 'settings.edit')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();

    const {
      name,
      icon,
      category = 'general',
      isActive = true,
    } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Name is required' } },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();

    // Validate category
    const validCategories = ['general', 'room', 'property', 'services', 'accessibility', 'wellness', 'business', 'dining'];
    if (category && !validCategories.includes(category)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid category. Valid categories: ${validCategories.join(', ')}` } },
        { status: 400 }
      );
    }

    // Check if amenity already exists
    const existingAmenity = await db.amenity.findFirst({
      where: {
        tenantId,
        name: trimmedName,
      },
    });

    if (existingAmenity) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_NAME', message: 'An amenity with this name already exists' } },
        { status: 400 }
      );
    }

    // Get max sort order
    const maxSort = await db.amenity.findFirst({
      where: { tenantId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const amenity = await db.amenity.create({
      data: {
        tenantId,
        name: trimmedName,
        icon: icon || null,
        category: category || 'general',
        isDefault: false,
        isActive: Boolean(isActive),
        sortOrder: (maxSort?.sortOrder ?? -1) + 1,
      },
    });

    return NextResponse.json({
      success: true,
      data: amenity,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating amenity:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create amenity' } },
      { status: 500 }
    );
  }
}

// DELETE /api/amenities - Bulk delete amenities
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
    if (!hasPermission(user, 'amenities.delete') && !hasPermission(user, 'settings.edit')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'IDs array is required' } },
        { status: 400 }
      );
    }

    // Don't allow deleting default amenities
    const defaultAmenities = await db.amenity.findMany({
      where: {
        id: { in: ids },
        tenantId,
        isDefault: true,
      },
    });

    if (defaultAmenities.length > 0) {
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

    const result = await db.amenity.deleteMany({
      where: {
        id: { in: ids },
        tenantId,
        isDefault: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Deleted ${result.count} amenity(ies)`,
    });
  } catch (error) {
    console.error('Error deleting amenities:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete amenities' } },
      { status: 500 }
    );
  }
}
