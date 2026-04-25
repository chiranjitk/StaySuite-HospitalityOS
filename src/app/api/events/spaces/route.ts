import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/events/spaces - List all event spaces
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'events.view')) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = { property: { tenantId: user.tenantId } };
    
    if (propertyId) {
      where.propertyId = propertyId;
    }
    
    if (status) {
      where.status = status;
    }

    const spaces = await db.eventSpace.findMany({
      where,
      include: {
        property: {
          select: {
            id: true,
            name: true,
          }
        },
        _count: {
          select: {
            events: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Calculate stats
    const stats = {
      total: spaces.length,
      active: spaces.filter(s => s.status === 'active').length,
      inactive: spaces.filter(s => s.status === 'inactive').length,
      maintenance: spaces.filter(s => s.status === 'maintenance').length,
      totalEvents: spaces.reduce((acc, s) => acc + s._count.events, 0)
    };

    return NextResponse.json({
      spaces: spaces.map(space => ({
        ...space,
        amenities: JSON.parse(space.amenities),
        images: JSON.parse(space.images),
      })),
      stats
    });
  } catch (error) {
    console.error('Error fetching event spaces:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event spaces' },
      { status: 500 }
    );
  }
}

// POST /api/events/spaces - Create a new event space
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'events.create')) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      propertyId,
      name,
      description,
      minCapacity,
      maxCapacity,
      sizeSqMeters,
      sizeSqFeet,
      hourlyRate,
      dailyRate,
      amenities,
      images,
      status
    } = body;

    if (!propertyId || !name) {
      return NextResponse.json(
        { error: 'Property ID and name are required' },
        { status: 400 }
      );
    }

    // Verify property belongs to user's tenant
    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId: user.tenantId }
    });

    if (!property) {
      return NextResponse.json(
        { error: 'Property not found or access denied' },
        { status: 400 }
      );
    }

    // Validate capacity
    const validMinCapacity = Math.max(1, parseInt(String(minCapacity)) || 1);
    const validMaxCapacity = Math.max(validMinCapacity, parseInt(String(maxCapacity)) || 100);

    const space = await db.eventSpace.create({
      data: {
        propertyId,
        name,
        description,
        minCapacity: validMinCapacity,
        maxCapacity: validMaxCapacity,
        sizeSqMeters: sizeSqMeters ? Math.max(0, parseFloat(String(sizeSqMeters))) : null,
        sizeSqFeet: sizeSqFeet ? Math.max(0, parseFloat(String(sizeSqFeet))) : null,
        hourlyRate: hourlyRate ? Math.max(0, parseFloat(String(hourlyRate))) : null,
        dailyRate: dailyRate ? Math.max(0, parseFloat(String(dailyRate))) : null,
        amenities: JSON.stringify(amenities || []),
        images: JSON.stringify(images || []),
        status: status || 'active'
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    return NextResponse.json({
      ...space,
      amenities: JSON.parse(space.amenities),
      images: JSON.parse(space.images),
    });
  } catch (error) {
    console.error('Error creating event space:', error);
    return NextResponse.json(
      { error: 'Failed to create event space' },
      { status: 500 }
    );
  }
}
