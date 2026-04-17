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
        data: { events: [], hasData: false },
      });
    }

    // Fetch real upcoming events from DB
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const events = await db.event.findMany({
      where: {
        propertyId: { in: propertyIds },
        startDate: { gte: today, lte: nextWeek },
        status: { notIn: ['cancelled'] },
      },
      include: {
        space: { select: { name: true } },
        property: { select: { name: true } },
      },
      orderBy: { startDate: 'asc' },
      take: 10,
    });

    const formattedEvents = events.map(evt => ({
      id: evt.id,
      name: evt.name,
      type: evt.type,
      date: evt.startDate.toISOString(),
      startTime: evt.startDate.toTimeString().slice(0, 5),
      endTime: evt.endDate.toTimeString().slice(0, 5),
      expectedGuests: evt.expectedAttendance,
      venue: evt.space?.name || evt.property?.name || 'TBD',
      status: evt.status,
    }));

    return NextResponse.json({
      success: true,
      data: {
        lastUpdated: new Date().toISOString(),
        events: formattedEvents,
        hasData: events.length > 0,
      },
    });
  } catch (error) {
    console.error('[Events API] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch events data' } },
      { status: 500 }
    );
  }
}
