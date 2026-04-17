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

    // Fetch real communications from service requests
    // ServiceRequest model: id, tenantId, propertyId, guestId, roomId?, type, category?,
    // subject, description?, priority, assignedTo?, status, source, createdAt
    // Relations: assignee -> User (via assignedTo field)
    const serviceRequests = await db.serviceRequest.findMany({
      where: {
        propertyId: { in: propertyIds },
        status: { in: ['pending', 'in_progress'] },
      },
      include: {
        assignee: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Fetch room numbers for any requests that have a roomId
    const roomIds = [...new Set(serviceRequests.map(sr => sr.roomId).filter(Boolean) as string[])];
    const rooms = roomIds.length > 0
      ? await db.room.findMany({
          where: { id: { in: roomIds } },
          select: { id: true, number: true },
        })
      : [];
    const roomMap = new Map(rooms.map(r => [r.id, r.number]));

    // Fetch guest names for any requests that have a guestId
    const guestIds = [...new Set(serviceRequests.map(sr => sr.guestId).filter(Boolean) as string[])];
    const guests = guestIds.length > 0
      ? await db.guest.findMany({
          where: { id: { in: guestIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const guestMap = new Map(guests.map(g => [g.id, `${g.firstName} ${g.lastName}`]));

    const typeMap: Record<string, string> = {
      maintenance: 'note',
      housekeeping: 'note',
      room_service: 'phone',
      front_desk: 'inperson',
      other: 'email',
    };

    const communications = serviceRequests.map(sr => ({
      id: sr.id,
      type: typeMap[sr.category || sr.type] || 'note',
      guestName: sr.guestId ? (guestMap.get(sr.guestId) || 'Guest') : 'Staff',
      room: sr.roomId ? `Room ${roomMap.get(sr.roomId) || ''}` : '',
      preview: sr.description || sr.subject,
      timestamp: sr.createdAt ? new Date(sr.createdAt).toISOString() : new Date().toISOString(),
      isUnread: sr.status === 'pending',
    }));

    const unreadCount = communications.filter(c => c.isUnread).length;

    return NextResponse.json({
      success: true,
      data: {
        lastUpdated: new Date().toISOString(),
        unreadCount,
        communications,
        hasData: serviceRequests.length > 0,
      },
    });
  } catch (error) {
    console.error('[Communications API] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch communication data' } },
      { status: 500 }
    );
  }
}
