import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';// GET /api/wifi/sessions - List all WiFi sessions with filtering and pagination
export async function GET(request: NextRequest) {    const user = await requirePermission(request, 'wifi.view');
    if (user instanceof NextResponse) return user;

      try {
    const searchParams = request.nextUrl.searchParams;
    const planId = searchParams.get('planId');
    const guestId = searchParams.get('guestId');
    const bookingId = searchParams.get('bookingId');
    const status = searchParams.get('status');
    const authMethod = searchParams.get('authMethod');
    const deviceType = searchParams.get('deviceType');
    const macAddress = searchParams.get('macAddress');
    const startTimeFrom = searchParams.get('startTimeFrom');
    const startTimeTo = searchParams.get('startTimeTo');
    const search = searchParams.get('search');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (planId) {
      where.planId = planId;
    }

    if (guestId) {
      where.guestId = guestId;
    }

    if (bookingId) {
      where.bookingId = bookingId;
    }

    if (status) {
      where.status = status;
    }

    if (authMethod) {
      where.authMethod = authMethod;
    }

    if (deviceType) {
      where.deviceType = deviceType;
    }

    if (macAddress) {
      where.macAddress = { contains: macAddress,  };
    }

    if (startTimeFrom || startTimeTo) {
      where.startTime = {};
      if (startTimeFrom) {
        (where.startTime as Record<string, unknown>).gte = new Date(startTimeFrom);
      }
      if (startTimeTo) {
        (where.startTime as Record<string, unknown>).lte = new Date(startTimeTo);
      }
    }

    if (search) {
      where.OR = [
        { macAddress: { contains: search,  } },
        { ipAddress: { contains: search,  } },
        { deviceName: { contains: search,  } },
      ];
    }

    const sessions = await db.wiFiSession.findMany({
      where,
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            downloadSpeed: true,
            uploadSpeed: true,
            dataLimit: true,
            sessionLimit: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { startTime: 'desc' },
      ...(limit && { take: parseInt(limit, 10) }),
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    const total = await db.wiFiSession.count({ where });

    // Calculate summary statistics
    const summary = await db.wiFiSession.aggregate({
      where,
      _sum: {
        dataUsed: true,
        duration: true,
      },
      _count: {
        id: true,
      },
    });

    const statusCounts = await db.wiFiSession.groupBy({
      by: ['status'],
      where,
      _count: {
        id: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: sessions,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
      summary: {
        totalDataUsed: summary._sum.dataUsed || 0,
        totalDuration: summary._sum.duration || 0,
        count: summary._count.id,
        byStatus: statusCounts.reduce((acc, item) => {
          acc[item.status] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
      },
    });
  } catch (error) {
    console.error('Error fetching WiFi sessions:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch WiFi sessions' } },
      { status: 500 }
    );
  }
}

// POST /api/wifi/sessions - Create a new WiFi session (start session)
export async function POST(request: NextRequest) {    const user = await requirePermission(request, 'wifi.manage');
    if (user instanceof NextResponse) return user;

      try {
    const body = await request.json();
    const tenantId = user.tenantId;

    const {
      
      planId,
      guestId,
      bookingId,
      macAddress,
      ipAddress,
      deviceName,
      deviceType,
      authMethod = 'voucher',
      propertyId,
    } = body;

    // Validate required fields
    if (!macAddress) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: macAddress' } },
        { status: 400 }
      );
    }

    // Check if there's an active session for this MAC address
    const activeSession = await db.wiFiSession.findFirst({
      where: {
        macAddress,
        status: 'active',
        tenantId,
      },
    });

    if (activeSession) {
      return NextResponse.json(
        { success: false, error: { code: 'SESSION_EXISTS', message: 'An active session already exists for this device' } },
        { status: 400 }
      );
    }

    // Get property ID for AAA config lookup
    let targetPropertyId = propertyId;
    if (!targetPropertyId && bookingId) {
      const booking = await db.booking.findUnique({
        where: { id: bookingId },
        select: { propertyId: true },
      });
      if (booking) {
        targetPropertyId = booking.propertyId;
      }
    }

    // Check concurrent session limits if we have guest or plan info
    if (guestId || planId) {
      const sessionLimitResult = await checkConcurrentSessionLimit(
        tenantId,
        guestId,
        planId,
        targetPropertyId
      );

      if (sessionLimitResult.exceeded) {
        // Get plan name for upgrade suggestion
        const plan = planId ? await db.wiFiPlan.findUnique({
          where: { id: planId },
          select: { name: true, sessionLimit: true },
        }) : null;

        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'SESSION_LIMIT_EXCEEDED',
              message: `Maximum concurrent sessions (${sessionLimitResult.maxSessions}) reached`,
              activeSessions: sessionLimitResult.activeSessions,
              maxSessions: sessionLimitResult.maxSessions,
              suggestion: 'Please upgrade your plan or wait for other sessions to end',
              currentPlan: plan ? {
                name: plan.name,
                sessionLimit: plan.sessionLimit,
              } : null,
            },
          },
          { status: 400 }
        );
      }
    }

    // If plan is specified, verify it exists
    if (planId) {
      const plan = await db.wiFiPlan.findUnique({
        where: { id: planId },
      });

      if (!plan) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_PLAN', message: 'WiFi plan not found' } },
          { status: 400 }
        );
      }
    }

    const session = await db.wiFiSession.create({
      data: {
        tenantId,
        planId,
        guestId,
        bookingId,
        macAddress,
        ipAddress,
        deviceName,
        deviceType,
        authMethod,
        status: 'active',
        startTime: new Date(),
      },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            downloadSpeed: true,
            uploadSpeed: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: session }, { status: 201 });
  } catch (error) {
    console.error('Error creating WiFi session:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create WiFi session' } },
      { status: 500 }
    );
  }
}

// PUT /api/wifi/sessions - Update a WiFi session (end session or update usage)
export async function PUT(request: NextRequest) {    const user = await requirePermission(request, 'wifi.manage');
    if (user instanceof NextResponse) return user;

      try {
    const body = await request.json();
    const tenantId = user.tenantId;
    const { id, status, dataUsed, duration, endTime } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: id' } },
        { status: 400 }
      );
    }

    const existingSession = await db.wiFiSession.findUnique({
      where: { id },
    });

    if (!existingSession) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'WiFi session not found' } },
        { status: 404 }
      );
    }

    // Tenant isolation: verify session belongs to user's tenant
    if (existingSession.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'WiFi session not found' } },
        { status: 404 }
      );
    }

    // If ending the session
    if (status === 'ended' && existingSession.status === 'active') {
      const session = await db.wiFiSession.update({
        where: { id },
        data: {
          status: 'ended',
          endTime: endTime ? new Date(endTime) : new Date(),
          ...(dataUsed !== undefined && { dataUsed }),
          ...(duration !== undefined && { duration }),
        },
        include: {
          plan: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return NextResponse.json({ success: true, data: session });
    }

    // Update usage data
    const session = await db.wiFiSession.update({
      where: { id },
      data: {
        ...(dataUsed !== undefined && { dataUsed }),
        ...(duration !== undefined && { duration }),
        ...(status && { status }),
      },
    });

    return NextResponse.json({ success: true, data: session });
  } catch (error) {
    console.error('Error updating WiFi session:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update WiFi session' } },
      { status: 500 }
    );
  }
}

// DELETE /api/wifi/sessions - Terminate a session
export async function DELETE(request: NextRequest) {    const user = await requirePermission(request, 'wifi.manage');
    if (user instanceof NextResponse) return user;

      try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: id' } },
        { status: 400 }
      );
    }

    const existingSession = await db.wiFiSession.findUnique({
      where: { id },
    });

    if (!existingSession) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'WiFi session not found' } },
        { status: 404 }
      );
    }

    // Tenant isolation: verify session belongs to user's tenant
    if (existingSession.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'WiFi session not found' } },
        { status: 404 }
      );
    }

    // Terminate the session
    const session = await db.wiFiSession.update({
      where: { id },
      data: {
        status: 'terminated',
        endTime: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: session,
      message: 'Session terminated successfully',
    });
  } catch (error) {
    console.error('Error terminating WiFi session:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to terminate WiFi session' } },
      { status: 500 }
    );
  }
}

/**
 * Check concurrent session limits
 */
async function checkConcurrentSessionLimit(
  tenantId: string,
  guestId?: string,
  planId?: string,
  propertyId?: string
): Promise<{
  exceeded: boolean;
  activeSessions: number;
  maxSessions: number;
}> {
  // Get default max sessions from AAA config
  let maxSessions = 3; // Default

  if (propertyId) {
    const aaaConfig = await db.wiFiAAAConfig.findUnique({
      where: { propertyId },
      select: { maxConcurrentSessions: true },
    });
    if (aaaConfig?.maxConcurrentSessions) {
      maxSessions = aaaConfig.maxConcurrentSessions;
    }
  }

  // Check plan's session limit
  if (planId) {
    const plan = await db.wiFiPlan.findUnique({
      where: { id: planId },
      select: { sessionLimit: true },
    });
    if (plan?.sessionLimit) {
      maxSessions = plan.sessionLimit;
    }
  }

  // Check WiFi user's max sessions
  if (guestId) {
    const wifiUser = await db.wiFiUser.findFirst({
      where: { guestId },
      select: { maxSessions: true },
    });
    if (wifiUser?.maxSessions) {
      maxSessions = wifiUser.maxSessions;
    }
  }

  // Count active sessions for this guest or user
  const whereClause: Record<string, unknown> = {
    tenantId,
    status: 'active',
  };

  if (guestId) {
    whereClause.guestId = guestId;
  }

  const activeSessions = await db.wiFiSession.count({
    where: whereClause,
  });

  return {
    exceeded: activeSessions >= maxSessions,
    activeSessions,
    maxSessions,
  };
}
