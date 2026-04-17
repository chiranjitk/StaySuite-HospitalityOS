/**
 * No-Show Settings API
 *
 * GET /api/no-show/settings?propertyId=xxx
 * Returns no-show automation settings for a property.
 *
 * PUT /api/no-show/settings?propertyId=xxx
 * Updates no-show automation settings for a property.
 *
 * All routes require authentication, RBAC (bookings.manage or bookings.* or admin),
 * and tenant isolation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { getNoShowSettings } from '@/lib/no-show-engine';
import { db } from '@/lib/db';

// =====================================================
// VALIDATION
// =====================================================

function validateSettings(body: unknown): {
  valid: boolean;
  errors: string[];
  settings?: {
    noShowBufferHours?: number;
    autoProcessNoShows?: boolean;
    noShowNotificationEnabled?: boolean;
  };
} {
  const errors: string[] = [];
  const settings: Record<string, unknown> = {};

  if (typeof body !== 'object' || body === null) {
    return { valid: false, errors: ['Request body must be an object'] };
  }

  const b = body as Record<string, unknown>;

  // noShowBufferHours: optional number between 0 and 24
  if ('noShowBufferHours' in b) {
    if (typeof b.noShowBufferHours !== 'number' || !Number.isFinite(b.noShowBufferHours)) {
      errors.push('noShowBufferHours must be a number');
    } else if (b.noShowBufferHours < 0 || b.noShowBufferHours > 24) {
      errors.push('noShowBufferHours must be between 0 and 24');
    } else {
      settings.noShowBufferHours = b.noShowBufferHours;
    }
  }

  // autoProcessNoShows: optional boolean
  if ('autoProcessNoShows' in b) {
    if (typeof b.autoProcessNoShows !== 'boolean') {
      errors.push('autoProcessNoShows must be a boolean');
    } else {
      settings.autoProcessNoShows = b.autoProcessNoShows;
    }
  }

  // noShowNotificationEnabled: optional boolean
  if ('noShowNotificationEnabled' in b) {
    if (typeof b.noShowNotificationEnabled !== 'boolean') {
      errors.push('noShowNotificationEnabled must be a boolean');
    } else {
      settings.noShowNotificationEnabled = b.noShowNotificationEnabled;
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    settings: settings as {
      noShowBufferHours?: number;
      autoProcessNoShows?: boolean;
      noShowNotificationEnabled?: boolean;
    },
  };
}

// =====================================================
// GET: Fetch no-show settings for a property
// =====================================================

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // RBAC: require bookings.view, bookings.*, or admin
    if (
      !hasPermission(user, 'bookings.view') &&
      !hasPermission(user, 'bookings.*') &&
      user.roleName !== 'admin'
    ) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    // propertyId is required
    const propertyId = request.nextUrl.searchParams.get('propertyId');
    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'propertyId query parameter is required' } },
        { status: 400 }
      );
    }

    // Verify property belongs to user's tenant
    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId: user.tenantId },
      select: { id: true, name: true },
    });

    if (!property) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } },
        { status: 404 }
      );
    }

    const settings = await getNoShowSettings(propertyId, user.tenantId);

    return NextResponse.json({
      success: true,
      data: {
        propertyId,
        propertyName: property.name,
        ...settings,
      },
    });
  } catch (error) {
    console.error('[NoShow Settings] GET error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// =====================================================
// PUT: Update no-show settings for a property
// =====================================================

export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // RBAC: require bookings.manage, bookings.*, or admin
    if (
      !hasPermission(user, 'bookings.manage') &&
      !hasPermission(user, 'bookings.*') &&
      user.roleName !== 'admin'
    ) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    // propertyId is required
    const propertyId = request.nextUrl.searchParams.get('propertyId');
    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'propertyId query parameter is required' } },
        { status: 400 }
      );
    }

    // Verify property belongs to user's tenant
    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId: user.tenantId },
      select: { id: true, name: true, noShowSettings: true },
    });

    if (!property) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = validateSettings(body);

    if (!validation.valid || !validation.settings) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid settings', details: validation.errors } },
        { status: 400 }
      );
    }

    // Merge with existing settings
    let existingSettings: Record<string, unknown> = {};
    try {
      existingSettings = JSON.parse(property.noShowSettings);
    } catch {
      existingSettings = {};
    }

    const updatedSettings = {
      ...existingSettings,
      ...validation.settings,
    };

    // Save to property
    await db.property.update({
      where: { id: propertyId },
      data: {
        noShowSettings: JSON.stringify(updatedSettings),
      },
    });

    // Create audit log
    try {
      const { auditLogService } = await import('@/lib/services/audit-service');
      await auditLogService.log({
        tenantId: user.tenantId,
        userId: user.id,
        module: 'settings',
        action: 'settings_update',
        entityType: 'property',
        entityId: propertyId,
        oldValue: existingSettings,
        newValue: updatedSettings,
      });
    } catch (auditError) {
      console.error('[NoShow Settings] Failed to create audit log:', auditError);
    }

    return NextResponse.json({
      success: true,
      message: 'No-show settings updated',
      data: {
        propertyId,
        propertyName: property.name,
        ...updatedSettings,
      },
    });
  } catch (error) {
    console.error('[NoShow Settings] PUT error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
