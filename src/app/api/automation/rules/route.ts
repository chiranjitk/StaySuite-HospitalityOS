import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/automation/rules - List automation rules
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'automation.view') && !hasPermission(user, 'rules.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const searchParams = request.nextUrl.searchParams;
    const isActive = searchParams.get('isActive');
    const triggerEvent = searchParams.get('triggerEvent');
    const search = searchParams.get('search') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: Prisma.AutomationRuleWhereInput = {
      tenantId,
      ...(isActive !== null && { isActive: isActive === 'true' }),
      ...(triggerEvent && { triggerEvent }),
      ...(search && {
        OR: [
          { name: { contains: search } },
          { description: { contains: search } },
        ],
      }),
    };

    const [rules, total] = await Promise.all([
      db.automationRule.findMany({
        where,
        include: {
          executionLogs: {
            take: 5,
            orderBy: { executedAt: 'desc' },
          },
          _count: {
            select: { executionLogs: true },
          },
        },
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      db.automationRule.count({ where }),
    ]);

    // Get execution stats
    const allRules = await db.automationRule.findMany({
      where: { tenantId },
      select: {
        isActive: true,
        executionCount: true,
        lastExecutedAt: true,
      },
    });

    const recentLogs = await db.automationExecutionLog.findMany({
      where: {
        rule: { tenantId },
      },
      orderBy: { executedAt: 'desc' },
      take: 100,
      select: { status: true },
    });

    const stats = {
      totalRules: allRules.length,
      activeRules: allRules.filter((r) => r.isActive).length,
      totalExecutions: allRules.reduce((acc, r) => acc + r.executionCount, 0),
      successRate: recentLogs.length > 0 
        ? Math.round((recentLogs.filter((l) => l.status === 'success').length / recentLogs.length) * 100)
        : 0,
      executionsToday: await db.automationExecutionLog.count({
        where: {
          rule: { tenantId },
          executedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    };

    // Get available trigger events
    const triggerEvents = [
      { value: 'booking.created', label: 'Booking Created', description: 'When a new booking is made' },
      { value: 'booking.confirmed', label: 'Booking Confirmed', description: 'When booking status changes to confirmed' },
      { value: 'booking.cancelled', label: 'Booking Cancelled', description: 'When a booking is cancelled' },
      { value: 'guest.check_in', label: 'Guest Check-in', description: 'When a guest checks in' },
      { value: 'guest.check_out', label: 'Guest Check-out', description: 'When a guest checks out' },
      { value: 'guest.created', label: 'Guest Created', description: 'When a new guest profile is created' },
      { value: 'guest.birthday', label: 'Guest Birthday', description: 'On guest birthday' },
      { value: 'payment.received', label: 'Payment Received', description: 'When payment is processed' },
      { value: 'payment.failed', label: 'Payment Failed', description: 'When payment fails' },
      { value: 'feedback.received', label: 'Feedback Received', description: 'When guest submits feedback' },
      { value: 'review.submitted', label: 'Review Submitted', description: 'When guest submits a review' },
      { value: 'loyalty.tier_upgraded', label: 'Loyalty Tier Upgraded', description: 'When guest loyalty tier increases' },
      { value: 'task.completed', label: 'Task Completed', description: 'When a task is marked complete' },
      { value: 'task.overdue', label: 'Task Overdue', description: 'When a task becomes overdue' },
      { value: 'room.status_changed', label: 'Room Status Changed', description: 'When room status changes' },
      { value: 'wifi.session_started', label: 'WiFi Session Started', description: 'When a WiFi session begins' },
      { value: 'scheduled.daily', label: 'Daily Schedule', description: 'Runs daily at specified time' },
      { value: 'scheduled.weekly', label: 'Weekly Schedule', description: 'Runs weekly at specified time' },
    ];

    return NextResponse.json({
      success: true,
      data: {
        rules: rules.map((r) => ({
          ...r,
          executionCount: r._count.executionLogs,
          recentSuccessRate: r.executionLogs.length > 0
            ? Math.round((r.executionLogs.filter((l) => l.status === 'success').length / r.executionLogs.length) * 100)
            : 0,
        })),
        total,
        stats,
        triggerEvents,
      },
    });
  } catch (error) {
    console.error('Error fetching automation rules:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch automation rules' } },
      { status: 500 }
    );
  }
}

// POST /api/automation/rules - Create a new automation rule
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'automation.manage') && !hasPermission(user, 'rules.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      triggerEvent,
      triggerConditions,
      actions,
      isActive = true,
    } = body;

    if (!name || !triggerEvent || !actions) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Name, trigger event, and actions are required' } },
        { status: 400 }
      );
    }

    // Validate actions format
    try {
      const parsedActions = typeof actions === 'string' ? JSON.parse(actions) : actions;
      if (!Array.isArray(parsedActions)) {
        throw new Error('Actions must be an array');
      }
    } catch {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid actions format. Must be a JSON array.' } },
        { status: 400 }
      );
    }

    const rule = await db.automationRule.create({
      data: {
        tenantId: user.tenantId,
        name,
        description,
        triggerEvent,
        triggerConditions: triggerConditions || null,
        actions: typeof actions === 'string' ? actions : JSON.stringify(actions),
        isActive,
      },
    });

    return NextResponse.json({
      success: true,
      data: rule,
    });
  } catch (error) {
    console.error('Error creating automation rule:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to create automation rule' } },
      { status: 500 }
    );
  }
}

// PUT /api/automation/rules - Update automation rule
export async function PUT(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'automation.manage') && !hasPermission(user, 'rules.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      id,
      name,
      description,
      triggerEvent,
      triggerConditions,
      actions,
      isActive,
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Rule ID is required' } },
        { status: 400 }
      );
    }

    const existing = await db.automationRule.findUnique({
      where: { id },
    });

    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Rule not found' } },
        { status: 404 }
      );
    }

    // Validate actions format if provided
    if (actions) {
      try {
        const parsedActions = typeof actions === 'string' ? JSON.parse(actions) : actions;
        if (!Array.isArray(parsedActions)) {
          throw new Error('Actions must be an array');
        }
      } catch {
        return NextResponse.json(
          { success: false, error: { message: 'Invalid actions format. Must be a JSON array.' } },
          { status: 400 }
        );
      }
    }

    const rule = await db.automationRule.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(triggerEvent && { triggerEvent }),
        ...(triggerConditions !== undefined && { triggerConditions }),
        ...(actions && { actions: typeof actions === 'string' ? actions : JSON.stringify(actions) }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({
      success: true,
      data: rule,
    });
  } catch (error) {
    console.error('Error updating automation rule:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to update automation rule' } },
      { status: 500 }
    );
  }
}

// DELETE /api/automation/rules - Delete automation rule
export async function DELETE(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'automation.manage') && !hasPermission(user, 'rules.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Rule ID is required' } },
        { status: 400 }
      );
    }

    const rule = await db.automationRule.findUnique({
      where: { id },
    });

    if (!rule || rule.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Rule not found' } },
        { status: 404 }
      );
    }

    // Delete execution logs first
    await db.automationExecutionLog.deleteMany({
      where: { ruleId: id },
    });

    // Delete rule
    await db.automationRule.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Automation rule deleted successfully' },
    });
  } catch (error) {
    console.error('Error deleting automation rule:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to delete automation rule' } },
      { status: 500 }
    );
  }
}
