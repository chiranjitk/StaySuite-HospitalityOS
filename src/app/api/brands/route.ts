import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/brands - List all brands
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
    if (!hasPermission(user, 'brands.view') && !hasPermission(user, 'settings.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {
      tenantId,
    };

    if (status) {
      where.status = status;
    }

    const brands = await db.brand.findMany({
      where,
      include: {
        _count: {
          select: {
            properties: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      data: brands.map((brand) => ({
        ...brand,
        propertyCount: brand._count.properties,
      })),
    });
  } catch (error) {
    console.error('Error fetching brands:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch brands' } },
      { status: 500 }
    );
  }
}

// POST /api/brands - Create a new brand
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
    if (!hasPermission(user, 'brands.create') && !hasPermission(user, 'settings.edit')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();

    const {
      name,
      code,
      description,
      logo,
      primaryColor,
      secondaryColor,
      standards,
      status = 'active',
    } = body;

    // Validate required fields
    if (!name || !code) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Name and code are required' } },
        { status: 400 }
      );
    }

    // Validate code format (alphanumeric, max 10 chars)
    const trimmedCode = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{1,10}$/.test(trimmedCode)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Code must be alphanumeric and max 10 characters' } },
        { status: 400 }
      );
    }

    // Check if code already exists for this tenant
    const existingBrand = await db.brand.findFirst({
      where: { code: trimmedCode, tenantId },
    });

    if (existingBrand) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_CODE', message: 'A brand with this code already exists' } },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ['active', 'inactive'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid status. Valid statuses: ${validStatuses.join(', ')}` } },
        { status: 400 }
      );
    }

    const brand = await db.brand.create({
      data: {
        tenantId,
        name: name.trim(),
        code: trimmedCode,
        description,
        logo,
        primaryColor,
        secondaryColor,
        standards: standards || '{}',
        status,
      },
    });

    return NextResponse.json({ success: true, data: brand }, { status: 201 });
  } catch (error) {
    console.error('Error creating brand:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create brand' } },
      { status: 500 }
    );
  }
}
