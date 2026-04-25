import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'dashboard.view');
  if (user instanceof NextResponse) return user;

  try {
    const tenantId = user.tenantId;
    const properties = await db.property.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true },
    });
    const propertyIds = properties.map(p => p.id);

    if (propertyIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          totalGuests: 0,
          lastUpdated: new Date().toISOString(),
          segments: [],
          hasData: false,
        },
      });
    }

    // Calculate guest segments from real booking data
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const bookings = await db.booking.findMany({
      where: {
        propertyId: { in: propertyIds },
        status: { notIn: ['cancelled'] },
        deletedAt: null,
      },
      include: {
        primaryGuest: {
          select: {
            loyaltyTier: true,
            isVip: true,
          },
        },
      },
    });

    if (bookings.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          totalGuests: 0,
          lastUpdated: new Date().toISOString(),
          segments: [],
          hasData: false,
        },
      });
    }

    // Segment guests by source/type
    let business = 0;
    let leisure = 0;
    let group = 0;
    let vip = 0;
    let extendedStay = 0;

    bookings.forEach(b => {
      // Classify by source
      const source = (b.source || '').toLowerCase();
      if (source.includes('corporate') || source.includes('business')) {
        business++;
      } else if (source.includes('group') || source.includes('tour')) {
        group++;
      } else {
        leisure++;
      }

      // Check VIP
      if (b.primaryGuest?.isVip) {
        vip++;
      }

      // Check extended stay (>7 nights)
      const nights = b.checkIn && b.checkOut
        ? Math.ceil((new Date(b.checkOut).getTime() - new Date(b.checkIn).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      if (nights > 7) {
        extendedStay++;
      }
    });

    const totalGuests = bookings.length;
    const segments = [
      { id: 'business', name: 'Business', count: business, percentage: totalGuests > 0 ? Math.round((business / totalGuests) * 100) : 0, color: '#0d9488', icon: 'Briefcase' },
      { id: 'leisure', name: 'Leisure', count: leisure, percentage: totalGuests > 0 ? Math.round((leisure / totalGuests) * 100) : 0, color: '#10b981', icon: 'Palmtree' },
      { id: 'group', name: 'Group', count: group, percentage: totalGuests > 0 ? Math.round((group / totalGuests) * 100) : 0, color: '#f59e0b', icon: 'Users' },
      { id: 'vip', name: 'VIP', count: vip, percentage: totalGuests > 0 ? Math.round((vip / totalGuests) * 100) : 0, color: '#ef4444', icon: 'Crown' },
      { id: 'extended', name: 'Extended Stay', count: extendedStay, percentage: totalGuests > 0 ? Math.round((extendedStay / totalGuests) * 100) : 0, color: '#14b8a6', icon: 'CalendarDays' },
    ].filter(s => s.count > 0);

    return NextResponse.json({
      success: true,
      data: {
        totalGuests,
        lastUpdated: new Date().toISOString(),
        segments,
        hasData: true,
      },
    });
  } catch (error) {
    console.error('[Guest Segments API] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch guest segment data' } },
      { status: 500 }
    );
  }
}
