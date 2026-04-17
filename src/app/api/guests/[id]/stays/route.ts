import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth/tenant-context';

// GET /api/guests/[id]/stays - Get guest stay history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  try {
    const { id } = await params;

    // Verify guest belongs to tenant
    const guest = await db.guest.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!guest) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Guest not found' } },
        { status: 404 }
      );
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build booking filter conditions
    const bookingFilter: Record<string, unknown> = {};
    if (status) {
      bookingFilter.status = status;
    }
    if (startDate || endDate) {
      bookingFilter.checkIn = {};
      if (startDate) {
        (bookingFilter.checkIn as Record<string, unknown>).gte = new Date(startDate);
      }
      if (endDate) {
        (bookingFilter.checkIn as Record<string, unknown>).lte = new Date(endDate);
      }
    }

    const stays = await db.guestStay.findMany({
      where: {
        guestId: id,
        ...(Object.keys(bookingFilter).length > 0 && {
          booking: bookingFilter,
        }),
      },
      include: {
        booking: {
          include: {
            room: {
              select: { number: true, name: true }
            },
            roomType: {
              select: { name: true }
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    // Get property info separately
    const propertyIds = [...new Set(stays.map(s => s.booking.propertyId).filter(Boolean))];
    const properties = await db.property.findMany({
      where: { id: { in: propertyIds } },
      select: { id: true, name: true, city: true },
    });
    const propertyMap = new Map(properties.map(p => [p.id, p]));
    
    // Transform stays to include property
    const transformedStays = stays.map(stay => ({
      ...stay,
      booking: {
        ...stay.booking,
        property: propertyMap.get(stay.booking.propertyId) || null,
      },
    }));
    
    // Calculate total nights and total spent
    const totalNights = stays.reduce((sum, stay) => sum + stay.roomNights, 0);
    const totalSpent = stays.reduce((sum, stay) => sum + stay.totalAmount, 0);
    
    return NextResponse.json({
      success: true,
      data: transformedStays,
      summary: {
        totalStays: stays.length,
        totalNights,
        totalSpent,
      },
    });
  } catch (error) {
    console.error('Error fetching stays:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch stays' } },
      { status: 500 }
    );
  }
}
