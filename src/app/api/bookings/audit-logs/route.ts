import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';// GET /api/bookings/audit-logs - List audit logs for bookings
export async function GET(request: NextRequest) {    const user = await requirePermission(request, 'bookings.audit');
    if (user instanceof NextResponse) return user;
    const tenantId = user.tenantId;

    

  try {
    const searchParams = request.nextUrl.searchParams;
    const bookingId = searchParams.get('bookingId');
    const action = searchParams.get('action');
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = {};

    if (bookingId) {
      // Verify booking belongs to tenant before querying its audit logs
      const booking = await db.booking.findFirst({ where: { id: bookingId, tenantId } });
      if (!booking) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } },
          { status: 404 }
        );
      }
      where.bookingId = bookingId;
    }

    if (action) {
      where.action = action;
    }

    const logs = await db.bookingAuditLog.findMany({
      where,
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
              },
            },
          },
        },
      },
      orderBy: {
        performedAt: 'desc',
      },
      take: parseInt(limit, 10),
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    const total = await db.bookingAuditLog.count({ where });

    return NextResponse.json({
      success: true,
      data: logs,
      pagination: {
        total,
        limit: parseInt(limit, 10),
        offset: offset ? parseInt(offset, 10) : 0,
      },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch audit logs' } },
      { status: 500 }
    );
  }
}

// POST /api/bookings/audit-logs - Create an audit log entry
export async function POST(request: NextRequest) {    const user = await requirePermission(request, 'bookings.audit');
    if (user instanceof NextResponse) return user;
    const tenantId = user.tenantId;

    

  try {
    const body = await request.json();

    const {
      bookingId,
      action,
      oldStatus,
      newStatus,
      notes,
      performedBy,
    } = body;

    if (!bookingId || !action) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Booking ID and action are required' } },
        { status: 400 }
      );
    }

    // Verify booking belongs to tenant before creating audit log
    const booking = await db.booking.findFirst({ where: { id: bookingId, tenantId } });
    if (!booking) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } },
        { status: 404 }
      );
    }

    const log = await db.bookingAuditLog.create({
      data: {
        bookingId,
        action,
        oldStatus,
        newStatus,
        notes,
        performedBy,
      },
      include: {
        booking: {
          select: {
            id: true,
            confirmationCode: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: log }, { status: 201 });
  } catch (error) {
    console.error('Error creating audit log:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create audit log' } },
      { status: 500 }
    );
  }
}
