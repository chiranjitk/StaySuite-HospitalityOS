import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/reports/scheduled - List scheduled reports
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
    if (!hasPermission(user, 'reports.scheduled.view') && !hasPermission(user, 'reports.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId; // Use authenticated user's tenant

    // Get scheduled reports from database
    const scheduledReports = await db.scheduledReport.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    // Get report history (recent executions)
    const reportHistory = await db.reportHistory.findMany({
      where: { tenantId },
      orderBy: { generatedAt: 'desc' },
      take: 20,
    });

    // Calculate stats
    const stats = {
      totalReports: scheduledReports.length,
      activeReports: scheduledReports.filter(r => r.isActive).length,
      avgSchedulesPerWeek: 0,
      lastExecution: reportHistory[0]?.generatedAt || null,
    };

    return NextResponse.json({
      success: true,
      data: scheduledReports.map(r => ({
        ...r,
        recipients: JSON.parse(r.recipients || '[]'),
      })),
      history: reportHistory,
      stats,
    });
  } catch (error) {
    console.error('Error fetching scheduled reports:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch scheduled reports' } },
      { status: 500 }
    );
  }
}

// POST /api/reports/scheduled - Create a scheduled report
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
    if (!hasPermission(user, 'reports.scheduled.create') && !hasPermission(user, 'reports.create')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      name,
      type,
      frequency,
      time,
      recipients,
      format,
      deliveryMethod,
      isActive = true,
      filters,
    } = body;

    // Use authenticated user's tenant
    const tenantId = user.tenantId;

    if (!name || !type || !frequency) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Name, type, and frequency are required' } },
        { status: 400 }
      );
    }

    // Calculate next run time
    const now = new Date();
    let nextRun = new Date();
    const [hours, minutes] = (time || '09:00').split(':').map(Number);
    nextRun.setHours(hours, minutes, 0, 0);

    if (frequency === 'daily') {
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
    } else if (frequency === 'weekly') {
      const daysUntilNext = (7 - now.getDay() + 1) % 7 || 7;
      nextRun.setDate(nextRun.getDate() + daysUntilNext);
    } else if (frequency === 'monthly') {
      nextRun.setDate(1);
      nextRun.setMonth(nextRun.getMonth() + 1);
    }

    const report = await db.scheduledReport.create({
      data: {
        tenantId,
        name,
        type,
        frequency,
        time: time || '09:00',
        recipients: JSON.stringify(recipients || []),
        format: format || 'pdf',
        deliveryMethod: deliveryMethod || 'email',
        isActive,
        filters: JSON.stringify(filters || {}),
        nextRunAt: nextRun,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...report,
        recipients: JSON.parse(report.recipients || '[]'),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating scheduled report:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create scheduled report' } },
      { status: 500 }
    );
  }
}

// PUT /api/reports/scheduled - Update a scheduled report
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
    if (!hasPermission(user, 'reports.scheduled.update') && !hasPermission(user, 'reports.update')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, isActive, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Report ID is required' } },
        { status: 400 }
      );
    }

    // Verify the report belongs to the user's tenant
    const existingReport = await db.scheduledReport.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existingReport) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Scheduled report not found' } },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = { ...updateData };
    if (updateData.recipients) {
      data.recipients = JSON.stringify(updateData.recipients);
    }
    if (updateData.filters) {
      data.filters = JSON.stringify(updateData.filters);
    }

    const report = await db.scheduledReport.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...report,
        recipients: JSON.parse(report.recipients || '[]'),
      },
    });
  } catch (error) {
    console.error('Error updating scheduled report:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update scheduled report' } },
      { status: 500 }
    );
  }
}

// DELETE /api/reports/scheduled - Delete a scheduled report
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
    if (!hasPermission(user, 'reports.scheduled.delete') && !hasPermission(user, 'reports.delete')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Report ID is required' } },
        { status: 400 }
      );
    }

    // Verify the report belongs to the user's tenant
    const existingReport = await db.scheduledReport.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existingReport) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Scheduled report not found' } },
        { status: 404 }
      );
    }

    await db.scheduledReport.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Scheduled report deleted',
    });
  } catch (error) {
    console.error('Error deleting scheduled report:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete scheduled report' } },
      { status: 500 }
    );
  }
}
