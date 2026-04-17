import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import crypto from 'crypto';

// Helper function to generate folio number
function generateFolioNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `FOL-${timestamp}-${random}`;
}

// GET /api/folios - List all folios with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    // RBAC check
    if (!hasPermission(user, 'folios.view') && !hasPermission(user, 'folios.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }
    const tenantId = user.tenantId;

    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const bookingId = searchParams.get('bookingId');
    const guestId = searchParams.get('guestId');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = {
      tenantId,
    };

    if (propertyId) {
      where.propertyId = propertyId;
    }

    if (bookingId) {
      where.bookingId = bookingId;
    }

    if (guestId) {
      where.guestId = guestId;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { folioNumber: { contains: search,  } },
        { invoiceNumber: { contains: search,  } },
      ];
    }

    const folios = await db.folio.findMany({
      where,
      include: {
        booking: {
          select: {
            id: true,
            confirmationCode: true,
            checkIn: true,
            checkOut: true,
            primaryGuest: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        lineItems: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        payments: {
          where: { status: 'completed' },
          select: {
            id: true,
            amount: true,
            method: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            lineItems: true,
            payments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      ...(limit && { take: parseInt(limit, 10) }),
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    const total = await db.folio.count({ where });

    return NextResponse.json({
      success: true,
      data: folios,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
    });
  } catch (error) {
    console.error('Error fetching folios:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch folios' } },
      { status: 500 }
    );
  }
}

// POST /api/folios - Create a new folio
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    // RBAC check
    if (!hasPermission(user, 'folios.create') && !hasPermission(user, 'folios.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }
    const tenantId = user.tenantId;

    const body = await request.json();

    const {
      propertyId,
      bookingId,
      guestId,
      currency = 'USD',
    } = body;

    // Validate required fields
    if (!propertyId || !bookingId || !guestId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: propertyId, bookingId, guestId' } },
        { status: 400 }
      );
    }

    // Verify booking exists
    const booking = await db.booking.findUnique({
      where: { id: bookingId, deletedAt: null },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_BOOKING', message: 'Booking not found' } },
        { status: 400 }
      );
    }

    // Verify guest exists
    const guest = await db.guest.findUnique({
      where: { id: guestId, deletedAt: null },
    });

    if (!guest) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_GUEST', message: 'Guest not found' } },
        { status: 400 }
      );
    }

    // Check if folio already exists for this booking
    const existingFolio = await db.folio.findFirst({
      where: { bookingId },
    });

    if (existingFolio) {
      return NextResponse.json(
        { success: false, error: { code: 'FOLIO_EXISTS', message: 'A folio already exists for this booking' } },
        { status: 400 }
      );
    }

    // Generate folio number
    const folioNumber = generateFolioNumber();

    const folio = await db.folio.create({
      data: {
        tenantId,
        propertyId,
        bookingId,
        guestId,
        folioNumber,
        currency,
        status: 'open',
      },
      include: {
        booking: {
          select: {
            id: true,
            confirmationCode: true,
            primaryGuest: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: folio }, { status: 201 });
  } catch (error) {
    console.error('Error creating folio:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create folio' } },
      { status: 500 }
    );
  }
}
