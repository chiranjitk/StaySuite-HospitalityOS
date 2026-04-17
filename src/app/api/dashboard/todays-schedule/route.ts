import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, tenantWhere } from '@/lib/auth/tenant-context';

export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'dashboard.view');
  if (user instanceof NextResponse) return user;

  try {
    const tenantId = user.tenantId;
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    // Get properties for this tenant
    const properties = await db.property.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true },
    });
    const propertyIds = properties.map(p => p.id);

    if (propertyIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: { arrivals: [], departures: [], date: today.toISOString() },
      });
    }

    // Fetch arrivals (checkIn is today)
    const arrivals = await db.booking.findMany({
      where: {
        propertyId: { in: propertyIds },
        status: { in: ['confirmed', 'checked_in'] },
        checkIn: { gte: startOfDay, lte: endOfDay },
        deletedAt: null,
      },
      include: {
        primaryGuest: { select: { firstName: true, lastName: true, isVip: true, loyaltyTier: true } },
        room: { select: { number: true } },
        roomType: { select: { name: true } },
        property: { select: { name: true, checkInTime: true } },
      },
      orderBy: { checkIn: 'asc' },
      take: 10,
    });

    // Fetch departures (checkOut is today)
    const departures = await db.booking.findMany({
      where: {
        propertyId: { in: propertyIds },
        status: { in: ['checked_in', 'checked_out'] },
        checkOut: { gte: startOfDay, lte: endOfDay },
        deletedAt: null,
      },
      include: {
        primaryGuest: { select: { firstName: true, lastName: true, isVip: true, loyaltyTier: true } },
        room: { select: { number: true } },
        roomType: { select: { name: true } },
        property: { select: { name: true } },
      },
      orderBy: { checkOut: 'asc' },
      take: 10,
    });

    const formatArrival = (b: typeof arrivals[0]) => ({
      id: b.id,
      time: b.checkIn?.toISOString() || '',
      guestName: `${b.primaryGuest.firstName} ${b.primaryGuest.lastName}`,
      roomNumber: b.room?.number || 'Unassigned',
      roomType: b.roomType?.name || '',
      isVip: b.primaryGuest.isVip,
      loyaltyTier: b.primaryGuest.loyaltyTier,
      status: b.status,
      source: (b as Record<string, unknown>).source || 'direct',
      specialRequests: (b as Record<string, unknown>).specialRequests || '',
      property: b.property?.name || '',
    });

    const formatDeparture = (b: typeof departures[0]) => ({
      id: b.id,
      time: b.checkOut?.toISOString() || '',
      guestName: `${b.primaryGuest.firstName} ${b.primaryGuest.lastName}`,
      roomNumber: b.room?.number || '',
      roomType: b.roomType?.name || '',
      isVip: b.primaryGuest.isVip,
      loyaltyTier: b.primaryGuest.loyaltyTier,
      status: b.status,
      specialRequests: (b as Record<string, unknown>).specialRequests || '',
      property: b.property?.name || '',
    });

    return NextResponse.json({
      success: true,
      data: {
        arrivals: arrivals.map(formatArrival),
        departures: departures.map(formatDeparture),
        date: today.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching todays schedule:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch today\'s schedule' } },
      { status: 500 }
    );
  }
}
