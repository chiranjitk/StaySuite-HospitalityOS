import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';// GET /api/security/events - List all security events with filters
export async function GET(request: NextRequest) {    const user = await requirePermission(request, 'security.view'); if (user instanceof NextResponse) return user;
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }


  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = user.tenantId;
    const cameraId = searchParams.get('cameraId');
    const type = searchParams.get('type');
    const severity = searchParams.get('severity');
    const acknowledged = searchParams.get('acknowledged');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');
    const stats = searchParams.get('stats');

    const where: Record<string, unknown> = { tenantId };

    if (cameraId) {
      where.cameraId = cameraId;
    }

    if (type) {
      where.type = type;
    }

    if (severity) {
      where.severity = severity;
    }

    if (acknowledged !== null && acknowledged !== undefined) {
      where.acknowledged = acknowledged === 'true';
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        (where.timestamp as Record<string, unknown>).gte = new Date(startDate);
      }
      if (endDate) {
        (where.timestamp as Record<string, unknown>).lte = new Date(endDate);
      }
    }

    // Return statistics if requested
    if (stats === 'true') {
      const [totalEvents, unacknowledgedCount, byType, bySeverity, recentEvents] = await Promise.all([
        db.securityEvent.count({ where }),
        db.securityEvent.count({ where: { ...where, acknowledged: false } }),
        db.securityEvent.groupBy({
          by: ['type'],
          where,
          _count: { id: true },
        }),
        db.securityEvent.groupBy({
          by: ['severity'],
          where,
          _count: { id: true },
        }),
        db.securityEvent.findMany({
          where: { ...where, acknowledged: false },
          take: 10,
          orderBy: { timestamp: 'desc' },
          include: {
            camera: {
              select: { name: true, location: true },
            },
          },
        }),
      ]);

      return NextResponse.json({
        success: true,
        data: {
          totalEvents,
          unacknowledgedCount,
          byType: byType.reduce((acc, item) => {
            acc[item.type] = item._count.id;
            return acc;
          }, {} as Record<string, number>),
          bySeverity: bySeverity.reduce((acc, item) => {
            acc[item.severity] = item._count.id;
            return acc;
          }, {} as Record<string, number>),
          recentEvents,
        },
      });
    }

    const events = await db.securityEvent.findMany({
      where,
      include: {
        camera: {
          select: {
            id: true,
            name: true,
            location: true,
            status: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
      ...(limit && { take: parseInt(limit, 10) }),
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    const total = await db.securityEvent.count({ where });

    return NextResponse.json({
      success: true,
      data: events,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
    });
  } catch (error) {
    console.error('Error fetching security events:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch security events' } },
      { status: 500 }
    );
  }
}

// POST /api/security/events - Create a new security event (from camera/NVR)
export async function POST(request: NextRequest) {    const user = await requirePermission(request, 'security.manage'); if (user instanceof NextResponse) return user;
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }


  try {
    const body = await request.json();
    const tenantId = user.tenantId;
    const {
      
      cameraId,
      type,
      severity = 'medium',
      description,
      thumbnail,
      recordingId,
      metadata,
      timestamp,
    } = body;

    // Validate required fields
    if (!cameraId || !type || !description) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Camera ID, type, and description are required' } },
        { status: 400 }
      );
    }

    // Validate event type
    const validTypes = ['motion', 'intrusion', 'tampering', 'face_detected', 'loitering', 'crowd_detected', 'fire_smoke', 'vehicle_detected'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid event type. Valid types: ${validTypes.join(', ')}` } },
        { status: 400 }
      );
    }

    // Create the security event
    const event = await db.securityEvent.create({
      data: {
        tenantId,
        cameraId,
        type,
        severity,
        description,
        thumbnail,
        recordingId,
        metadata: metadata || {},
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        acknowledged: false,
      },
      include: {
        camera: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
      },
    });

    // Update camera last event time
    await db.camera.update({
      where: { id: cameraId },
      data: { updatedAt: new Date() },
    });

    // Create notification for high severity events
    if (severity === 'high' || severity === 'critical') {
      await db.notification.create({
        data: {
          tenantId,
          userId: user.id,
          type: 'security_alert',
          category: severity === 'critical' ? 'error' : 'warning',
          title: `Security Alert: ${type.replace('_', ' ')}`,
          message: `${event.camera.name} - ${description}`,
          priority: severity === 'critical' ? 'urgent' : 'high',
          data: JSON.stringify({
            eventId: event.id,
            cameraId,
            eventType: type,
          }),
        },
      });
    }

    return NextResponse.json({ success: true, data: event }, { status: 201 });
  } catch (error) {
    console.error('Error creating security event:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create security event' } },
      { status: 500 }
    );
  }
}

// PUT /api/security/events - Acknowledge an event
export async function PUT(request: NextRequest) {    const user = await requirePermission(request, 'security.manage'); if (user instanceof NextResponse) return user;
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }


  try {
    const body = await request.json();
    const tenantId = user.tenantId;
    const { id, acknowledged, acknowledgedBy, notes } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Event ID is required' } },
        { status: 400 }
      );
    }

    // Verify event belongs to user's tenant
    const existingEvent = await db.securityEvent.findFirst({
      where: { id, tenantId },
    });

    if (!existingEvent) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Event not found or access denied' } },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    
    if (acknowledged !== undefined) {
      updateData.acknowledged = acknowledged;
      if (acknowledged) {
        updateData.acknowledgedAt = new Date();
        updateData.acknowledgedBy = acknowledgedBy || 'system';
      }
    }
    
    if (notes !== undefined) {
      updateData.notes = notes;
    }

    const event = await db.securityEvent.update({
      where: { id },
      data: updateData,
      include: {
        camera: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: event });
  } catch (error) {
    console.error('Error updating security event:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update security event' } },
      { status: 500 }
    );
  }
}
