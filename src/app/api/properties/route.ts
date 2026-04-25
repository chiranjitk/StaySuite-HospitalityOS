import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/properties - List all properties
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // RBAC check
    if (!hasPermission(user, 'properties.view') && !hasPermission(user, 'properties.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    
    const where: Record<string, unknown> = {
      deletedAt: null,
      tenantId: user.tenantId,
    };
    
    if (status) {
      where.status = status;
    }
    
    if (type) {
      where.type = type;
    }
    
    const properties = await db.property.findMany({
      where,
      include: {
        _count: {
          select: {
            rooms: true,
            roomTypes: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    return NextResponse.json({
      success: true,
      data: properties.map((p) => ({
        ...p,
        totalRooms: p._count.rooms,
        totalRoomTypes: p._count.roomTypes,
      })),
    });
  } catch (error) {
    console.error('Error fetching properties:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch properties' } },
      { status: 500 }
    );
  }
}

// POST /api/properties - Create a new property
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // RBAC check
    if (!hasPermission(user, 'properties.create') && !hasPermission(user, 'properties.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const tenantId = user.tenantId;
    
    const body = await request.json();
    
    const {
      name,
      slug,
      description,
      type = 'hotel',
      address,
      city,
      state,
      country,
      postalCode,
      latitude,
      longitude,
      email,
      phone,
      website,
      logo,
      primaryColor,
      secondaryColor,
      checkInTime = '14:00',
      checkOutTime = '11:00',
      timezone = 'Asia/Kolkata',
      currency = 'INR',
      // Tax configuration
      taxId,
      taxType = 'gst',
      defaultTaxRate = 0,
      taxComponents = [],
      serviceChargePercent = 0,
      includeTaxInPrice = false,
      totalFloors = 1,
      status = 'active',
    } = body;
    
    // Validate required fields
    if (!name || !slug || !address || !city || !country) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } },
        { status: 400 }
      );
    }
    
    // Check if slug already exists
    const existingProperty = await db.property.findUnique({
      where: {
        tenantId_slug: {
          tenantId,
          slug,
        },
      },
    });
    
    if (existingProperty) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_SLUG', message: 'A property with this slug already exists' } },
        { status: 400 }
      );
    }
    
    const property = await db.property.create({
      data: {
        tenantId,
        name,
        slug,
        description,
        type,
        address,
        city,
        state,
        country,
        postalCode,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        email,
        phone,
        website,
        logo,
        primaryColor,
        secondaryColor,
        checkInTime,
        checkOutTime,
        timezone,
        currency,
        // Tax configuration
        taxId,
        taxType,
        defaultTaxRate,
        taxComponents: JSON.stringify(taxComponents),
        serviceChargePercent,
        includeTaxInPrice,
        totalFloors,
        status,
      },
    });
    
    return NextResponse.json({ success: true, data: property }, { status: 201 });
  } catch (error) {
    console.error('Error creating property:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create property' } },
      { status: 500 }
    );
  }
}
