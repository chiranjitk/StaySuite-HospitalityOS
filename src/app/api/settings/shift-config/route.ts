import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { logAudit } from '@/lib/audit';

// Default shift configuration
const DEFAULT_SHIFT_CONFIG = {
  defaultShiftStart: '09:00',
  defaultShiftEnd: '17:00',
  graceMinutesEarly: 15, // Allow check-in 15 minutes early
  graceMinutesLate: 15, // Allow 15 minutes late before marking as late
  halfDayThresholdMinutes: 240, // 4 hours = half day
  overtimeThresholdMinutes: 480, // 8 hours = overtime starts
  workDays: [1, 2, 3, 4, 5], // Monday to Friday
};

// GET /api/settings/shift-config - Get shift configuration
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
    if (!hasPermission(user, 'settings.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;

    // Get shift templates for the tenant
    const shiftTemplates = await db.shiftTemplate.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      orderBy: { startTime: 'asc' },
    });

    // Get tenant settings for default shift configuration
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    let tenantShiftSettings = DEFAULT_SHIFT_CONFIG;
    if (tenant?.settings) {
      try {
        const settings = JSON.parse(tenant.settings);
        if (settings.shiftConfig) {
          tenantShiftSettings = { ...DEFAULT_SHIFT_CONFIG, ...settings.shiftConfig };
        }
      } catch {
        // Use defaults if parsing fails
      }
    }

    // If no shift templates exist, return defaults
    if (shiftTemplates.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          shifts: [],
          defaultConfig: tenantShiftSettings,
          defaultShift: {
            id: 'default',
            name: 'Standard Shift',
            startTime: tenantShiftSettings.defaultShiftStart,
            endTime: tenantShiftSettings.defaultShiftEnd,
            breakMinutes: 60,
            shiftType: 'regular',
            activeDays: tenantShiftSettings.workDays,
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        shifts: shiftTemplates.map(st => ({
          id: st.id,
          name: st.name,
          code: st.code,
          startTime: st.startTime,
          endTime: st.endTime,
          breakMinutes: st.breakMinutes,
          shiftType: st.shiftType,
          activeDays: JSON.parse(st.activeDays || '[]'),
          department: st.department,
          minStaff: st.minStaff,
          maxStaff: st.maxStaff,
          color: st.color,
        })),
        defaultConfig: tenantShiftSettings,
      },
    });
  } catch (error) {
    console.error('Error fetching shift configuration:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch shift configuration' } },
      { status: 500 }
    );
  }
}

// POST /api/settings/shift-config - Create a new shift template
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
    if (!hasPermission(user, 'settings.edit')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const {
      name,
      code,
      startTime,
      endTime,
      breakMinutes = 60,
      shiftType = 'regular',
      activeDays = [1, 2, 3, 4, 5],
      department,
      minStaff = 1,
      maxStaff,
      color = '#0d9488',
    } = body;

    if (!name || !startTime || !endTime) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Name, start time, and end time are required' } },
        { status: 400 }
      );
    }

    // Validate time format
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TIME_FORMAT', message: 'Time must be in HH:MM format' } },
        { status: 400 }
      );
    }

    // Validate start is before end
    if (startTime >= endTime) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TIME_RANGE', message: 'Start time must be before end time' } },
        { status: 400 }
      );
    }

    const shiftTemplate = await db.shiftTemplate.create({
      data: {
        tenantId,
        name,
        code,
        startTime,
        endTime,
        breakMinutes,
        shiftType,
        activeDays: JSON.stringify(activeDays),
        department,
        minStaff,
        maxStaff,
        color,
      },
    });

    // Log audit
    try {
      await logAudit(request, 'create', 'shift_template', shiftTemplate.id, undefined, {
        name: shiftTemplate.name,
        startTime: shiftTemplate.startTime,
        endTime: shiftTemplate.endTime,
      }, { tenantId: user.tenantId, userId: user.id });
    } catch (auditError) {
      console.error('Audit log failed (non-blocking):', auditError);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...shiftTemplate,
        activeDays: JSON.parse(shiftTemplate.activeDays || '[]'),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating shift template:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create shift template' } },
      { status: 500 }
    );
  }
}

// PUT /api/settings/shift-config - Update shift configuration
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
    if (!hasPermission(user, 'settings.edit')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const { shiftConfig, shiftTemplateId, ...shiftData } = body;

    // Update tenant-level shift configuration
    if (shiftConfig) {
      const tenant = await db.tenant.findUnique({
        where: { id: tenantId },
        select: { settings: true },
      });

      let currentSettings = {};
      if (tenant?.settings) {
        try {
          currentSettings = JSON.parse(tenant.settings);
        } catch {
          // Use empty object if parsing fails
        }
      }

      const updatedSettings = {
        ...currentSettings,
        shiftConfig: {
          ...DEFAULT_SHIFT_CONFIG,
          ...shiftConfig,
        },
      };

      await db.tenant.update({
        where: { id: tenantId },
        data: { settings: JSON.stringify(updatedSettings) },
      });

      return NextResponse.json({
        success: true,
        message: 'Shift configuration updated',
        data: updatedSettings.shiftConfig,
      });
    }

    // Update a specific shift template
    if (shiftTemplateId) {
      const updateData: Record<string, unknown> = {};

      if (shiftData.name !== undefined) updateData.name = shiftData.name;
      if (shiftData.code !== undefined) updateData.code = shiftData.code;
      if (shiftData.startTime !== undefined) updateData.startTime = shiftData.startTime;
      if (shiftData.endTime !== undefined) updateData.endTime = shiftData.endTime;
      if (shiftData.breakMinutes !== undefined) updateData.breakMinutes = shiftData.breakMinutes;
      if (shiftData.shiftType !== undefined) updateData.shiftType = shiftData.shiftType;
      if (shiftData.activeDays !== undefined) updateData.activeDays = JSON.stringify(shiftData.activeDays);
      if (shiftData.department !== undefined) updateData.department = shiftData.department;
      if (shiftData.minStaff !== undefined) updateData.minStaff = shiftData.minStaff;
      if (shiftData.maxStaff !== undefined) updateData.maxStaff = shiftData.maxStaff;
      if (shiftData.color !== undefined) updateData.color = shiftData.color;
      if (shiftData.isActive !== undefined) updateData.isActive = shiftData.isActive;

      const shiftTemplate = await db.shiftTemplate.update({
        where: { id: shiftTemplateId },
        data: updateData,
      });

      return NextResponse.json({
        success: true,
        data: {
          ...shiftTemplate,
          activeDays: JSON.parse(shiftTemplate.activeDays || '[]'),
        },
      });
    }

    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Either shiftConfig or shiftTemplateId is required' } },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating shift configuration:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update shift configuration' } },
      { status: 500 }
    );
  }
}

// DELETE /api/settings/shift-config - Delete a shift template
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
    if (!hasPermission(user, 'settings.edit')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Shift template ID is required' } },
        { status: 400 }
      );
    }

    // Verify the shift template belongs to the user's tenant
    const template = await db.shiftTemplate.findFirst({
      where: { id, tenantId },
    });

    if (!template) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Shift template not found or access denied' } },
        { status: 404 }
      );
    }

    await db.shiftTemplate.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Shift template deleted',
    });
  } catch (error) {
    console.error('Error deleting shift template:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete shift template' } },
      { status: 500 }
    );
  }
}
