import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/events - List all events (tenant-scoped)
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'events.view');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const spaceId = searchParams.get('spaceId');
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: Record<string, unknown> = {
      tenantId: user.tenantId, // Tenant isolation
    };

    if (propertyId) {
      where.propertyId = propertyId;
    }

    if (spaceId) {
      where.spaceId = spaceId;
    }

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (startDate || endDate) {
      where.startDate = {};
      if (startDate) {
        (where.startDate as Record<string, unknown>).gte = new Date(startDate);
      }
      if (endDate) {
        (where.startDate as Record<string, unknown>).lte = new Date(endDate);
      }
    }

    const events = await db.event.findMany({
      where,
      include: {
        property: {
          select: {
            id: true,
            name: true,
          }
        },
        space: {
          select: {
            id: true,
            name: true,
            minCapacity: true,
            maxCapacity: true,
          }
        },
        _count: {
          select: {
            resources: true
          }
        }
      },
      orderBy: {
        startDate: 'asc'
      }
    });

    // Calculate stats
    const now = new Date();
    const stats = {
      total: events.length,
      inquiry: events.filter(e => e.status === 'inquiry').length,
      confirmed: events.filter(e => e.status === 'confirmed').length,
      in_progress: events.filter(e => e.status === 'in_progress').length,
      completed: events.filter(e => e.status === 'completed').length,
      cancelled: events.filter(e => e.status === 'cancelled').length,
      upcoming: events.filter(e => e.startDate > now && e.status !== 'cancelled').length,
      totalRevenue: events
        .filter(e => e.status !== 'cancelled')
        .reduce((acc, e) => acc + e.totalAmount, 0),
    };

    return NextResponse.json({
      events,
      stats
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

// POST /api/events - Create a new event (tenantId derived from auth)
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'events.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const {
      propertyId,
      spaceId,
      name,
      type,
      description,
      organizerName,
      organizerEmail,
      organizerPhone,
      startDate,
      endDate,
      setupStart,
      teardownEnd,
      expectedAttendance,
      spaceCharge,
      cateringCharge,
      avCharge,
      otherCharges,
      totalAmount,
      currency,
      depositAmount,
      depositPaid,
      status,
      notes
    } = body;

    // Derive tenantId from authenticated session, NOT from request body
    const tenantId = user.tenantId;

    if (!propertyId || !name || !organizerName || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required fields: propertyId, name, organizerName, startDate, endDate' },
        { status: 400 }
      );
    }

    const event = await db.event.create({
      data: {
        tenantId, // Derived from auth session
        propertyId,
        spaceId,
        name,
        type: type || 'meeting',
        description,
        organizerName,
        organizerEmail: organizerEmail || '',
        organizerPhone: organizerPhone || '',
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        setupStart: setupStart ? new Date(setupStart) : null,
        teardownEnd: teardownEnd ? new Date(teardownEnd) : null,
        expectedAttendance: expectedAttendance || 1,
        spaceCharge: spaceCharge || 0,
        cateringCharge: cateringCharge || 0,
        avCharge: avCharge || 0,
        otherCharges: otherCharges || 0,
        totalAmount: totalAmount || 0,
        currency: currency || 'USD',
        depositAmount: depositAmount || 0,
        depositPaid: depositPaid || false,
        status: status || 'inquiry',
        notes
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
          }
        },
        space: {
          select: {
            id: true,
            name: true,
            minCapacity: true,
            maxCapacity: true,
          }
        }
      }
    });

    return NextResponse.json(event);
  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
}
