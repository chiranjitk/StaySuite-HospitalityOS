import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/wifi/firewall/schedules/[id] - Get single firewall schedule
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;

    const schedule = await db.firewallSchedule.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!schedule) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Firewall schedule not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: schedule });
  } catch (error) {
    console.error('Error fetching firewall schedule:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch firewall schedule' } },
      { status: 500 }
    );
  }
}

// PUT /api/wifi/firewall/schedules/[id] - Update firewall schedule
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;
    const body = await request.json();

    const existingSchedule = await db.firewallSchedule.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existingSchedule) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Firewall schedule not found' } },
        { status: 404 }
      );
    }

    const { name, daysOfWeek, startTime, endTime, timezone, enabled } = body;

    // Validate time format if provided
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (startTime && !timeRegex.test(startTime)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid startTime format. Use HH:MM (24-hour format)' } },
        { status: 400 }
      );
    }
    if (endTime && !timeRegex.test(endTime)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid endTime format. Use HH:MM (24-hour format)' } },
        { status: 400 }
      );
    }

    // Validate daysOfWeek if provided
    if (daysOfWeek) {
      const days = daysOfWeek.split(',').map((d: string) => parseInt(d.trim(), 10));
      for (const day of days) {
        if (isNaN(day) || day < 1 || day > 7) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid daysOfWeek. Use comma-separated values 1-7 (1=Monday, 7=Sunday)' } },
            { status: 400 }
          );
        }
      }
    }

    const schedule = await db.firewallSchedule.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(daysOfWeek !== undefined && { daysOfWeek }),
        ...(startTime !== undefined && { startTime }),
        ...(endTime !== undefined && { endTime }),
        ...(timezone !== undefined && { timezone }),
        ...(enabled !== undefined && { enabled }),
      },
    });

    return NextResponse.json({ success: true, data: schedule });
  } catch (error) {
    console.error('Error updating firewall schedule:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update firewall schedule' } },
      { status: 500 }
    );
  }
}

// DELETE /api/wifi/firewall/schedules/[id] - Delete firewall schedule
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;

    const existingSchedule = await db.firewallSchedule.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existingSchedule) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Firewall schedule not found' } },
        { status: 404 }
      );
    }

    // Check if schedule is referenced by any rules
    const referencedRules = await db.firewallRule.count({
      where: { scheduleId: id },
    });

    if (referencedRules > 0) {
      return NextResponse.json(
        { success: false, error: { code: 'HAS_DEPENDENTS', message: `Cannot delete schedule. It is referenced by ${referencedRules} firewall rule(s).` } },
        { status: 400 }
      );
    }

    await db.firewallSchedule.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Firewall schedule deleted successfully' });
  } catch (error) {
    console.error('Error deleting firewall schedule:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete firewall schedule' } },
      { status: 500 }
    );
  }
}
