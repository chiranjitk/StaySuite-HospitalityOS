import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';// GET /api/security/cameras/[id]/recordings - Get recordings for a camera on a specific date
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await requirePermission(request, 'surveillance.view');
    if (user instanceof NextResponse) return user;

      try {
    const { id: cameraId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // Parse the date
    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get camera info and verify it belongs to user's tenant
    const camera = await db.camera.findUnique({
      where: { id: cameraId },
    });

    if (!camera) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Camera not found' } },
        { status: 404 }
      );
    }

    if (camera.propertyId) {
      // Verify camera belongs to user's tenant via property
      const prop = await db.property.findFirst({
        where: { id: camera.propertyId, tenantId: user.tenantId },
      });
      if (!prop) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
          { status: 403 }
        );
      }
    }

    // Get recordings for the date (no dedicated recording model - use events with recordingId)
    const eventsWithRecordings = await db.securityEvent.findMany({
      where: {
        cameraId,
        timestamp: {
          gte: startOfDay,
          lte: endOfDay,
        },
        recordingId: { not: null },
      },
      orderBy: { timestamp: 'asc' },
    });

    // Get security events for the date
    const events = await db.securityEvent.findMany({
      where: {
        cameraId,
        timestamp: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: { timestamp: 'asc' },
    });

    // Calculate statistics
    const eventCounts = events.reduce((acc, e) => {
      acc[e.type] = (acc[e.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      success: true,
      data: {
        camera: {
          id: camera.id,
          name: camera.name,
          location: camera.location,
          status: camera.status,
        },
        date,
        recordings: eventsWithRecordings.map((e) => ({
          id: e.id,
          startTime: e.timestamp,
          endTime: e.timestamp,
          duration: null,
          fileSize: null,
          hasEvents: true,
          thumbnailUrl: e.thumbnail,
          streamUrl: null,
        })),
        events: events.map((e) => ({
          id: e.id,
          timestamp: e.timestamp,
          type: e.type,
          description: e.description,
          thumbnail: e.thumbnail,
          acknowledged: e.acknowledged,
          acknowledgedBy: e.acknowledgedBy,
        })),
        statistics: {
          totalRecordings: eventsWithRecordings.length,
          totalDuration: 0,
          totalSize: 0,
          eventCounts,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching recordings:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch recordings' } },
      { status: 500 }
    );
  }
}
