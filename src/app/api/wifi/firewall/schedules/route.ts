import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/wifi/firewall/schedules - List firewall schedules
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const enabled = searchParams.get('enabled');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (propertyId) where.propertyId = propertyId;
    if (enabled !== null && enabled !== undefined) where.enabled = enabled === 'true';

    const schedules = await db.firewallSchedule.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...(limit && { take: parseInt(limit, 10) }),
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    const total = await db.firewallSchedule.count({ where });

    return NextResponse.json({
      success: true,
      data: schedules,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
    });
  } catch (error) {
    console.error('Error fetching firewall schedules:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch firewall schedules' } },
      { status: 500 }
    );
  }
}

// POST /api/wifi/firewall/schedules - Create a new firewall schedule
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const {
      propertyId,
      name,
      daysOfWeek = '1,2,3,4,5,6,7',
      startTime = '00:00',
      endTime = '23:59',
      timezone = 'UTC',
      enabled = true,
    } = body;

    if (!propertyId || !name) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: propertyId, name' } },
        { status: 400 }
      );
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid time format. Use HH:MM (24-hour format)' } },
        { status: 400 }
      );
    }

    // Validate daysOfWeek format
    const days = daysOfWeek.split(',').map((d: string) => parseInt(d.trim(), 10));
    for (const day of days) {
      if (isNaN(day) || day < 1 || day > 7) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid daysOfWeek. Use comma-separated values 1-7 (1=Monday, 7=Sunday)' } },
          { status: 400 }
        );
      }
    }

    const schedule = await db.firewallSchedule.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        name,
        daysOfWeek,
        startTime,
        endTime,
        timezone,
        enabled,
      },
    });

    return NextResponse.json({ success: true, data: schedule }, { status: 201 });
  } catch (error) {
    console.error('Error creating firewall schedule:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create firewall schedule' } },
      { status: 500 }
    );
  }
}
