import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logSettings } from '@/lib/audit';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET - Get general settings
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'settings.view')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;

    // Get tenant with first property
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId, deletedAt: null },
      include: {
        properties: {
          take: 1,
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      );
    }

    const firstProperty = tenant.properties[0];

    // Parse settings from tenant
    let tenantSettings = {};
    try {
      tenantSettings = tenant.settings ? JSON.parse(tenant.settings) : {};
    } catch {
      tenantSettings = {};
    }

    const settings = {
      property: {
        name: firstProperty?.name || tenant.name,
        legalName: (tenantSettings as Record<string, unknown>).legalName as string || tenant.name,
        description: firstProperty?.description || '',
        website: firstProperty?.website || '',
        email: firstProperty?.email || tenant.email,
        phone: firstProperty?.phone || tenant.phone || '',
        address: firstProperty?.address || tenant.address || '',
        city: firstProperty?.city || tenant.city || '',
        country: firstProperty?.country || tenant.country || '',
        postalCode: firstProperty?.postalCode || '',
      },
      operations: {
        checkInTime: firstProperty?.checkInTime || '15:00',
        checkOutTime: firstProperty?.checkOutTime || '11:00',
        timezone: tenant.timezone || 'America/New_York',
        defaultCurrency: tenant.currency || 'USD',
        dateFormat: (tenantSettings as Record<string, unknown>).dateFormat as string || 'MM/DD/YYYY',
        timeFormat: ((tenantSettings as Record<string, unknown>).timeFormat as string) || '12h',
      },
      notifications: {
        emailNotifications: ((tenantSettings as Record<string, unknown>).emailNotifications as boolean) ?? true,
        smsNotifications: ((tenantSettings as Record<string, unknown>).smsNotifications as boolean) ?? true,
        pushNotifications: ((tenantSettings as Record<string, unknown>).pushNotifications as boolean) ?? true,
        weeklyReport: ((tenantSettings as Record<string, unknown>).weeklyReport as boolean) ?? true,
        dailyDigest: ((tenantSettings as Record<string, unknown>).dailyDigest as boolean) ?? false,
      },
      tenantId,
    };

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Error fetching general settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch general settings' },
      { status: 500 }
    );
  }
}

// PUT - Update general settings
export async function PUT(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'settings.edit')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const { propertyId, property, operations, notifications } = body;

    // Input validation
    if (property && typeof property !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid property data' },
        { status: 400 }
      );
    }
    if (operations && typeof operations !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid operations data' },
        { status: 400 }
      );
    }
    if (notifications && typeof notifications !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid notifications data' },
        { status: 400 }
      );
    }

    // Validate time format if provided
    if (operations?.checkInTime && typeof operations.checkInTime === 'string') {
      const timeRegex = /^\d{2}:\d{2}$/;
      if (!timeRegex.test(operations.checkInTime)) {
        return NextResponse.json(
          { success: false, error: 'checkInTime must be in HH:MM format' },
          { status: 400 }
        );
      }
    }
    if (operations?.checkOutTime && typeof operations.checkOutTime === 'string') {
      const timeRegex = /^\d{2}:\d{2}$/;
      if (!timeRegex.test(operations.checkOutTime)) {
        return NextResponse.json(
          { success: false, error: 'checkOutTime must be in HH:MM format' },
          { status: 400 }
        );
      }
    }

    // Validate timezone if provided
    if (operations?.timezone && typeof operations.timezone === 'string') {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: operations.timezone });
      } catch {
        return NextResponse.json(
          { success: false, error: 'Invalid timezone' },
          { status: 400 }
        );
      }
    }

    // Validate currency if provided
    if (operations?.defaultCurrency && typeof operations.defaultCurrency === 'string') {
      if (!/^[A-Z]{3}$/.test(operations.defaultCurrency)) {
        return NextResponse.json(
          { success: false, error: 'Currency must be a valid 3-letter ISO code' },
          { status: 400 }
        );
      }
    }

    // Get tenant
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId, deletedAt: null },
      include: {
        properties: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Determine which property to update
    let targetProperty = tenant.properties.find(
      (p) => p.id === propertyId
    ) || tenant.properties[0];

    if (!targetProperty) {
      return NextResponse.json(
        { success: false, error: 'No properties found for this tenant' },
        { status: 404 }
      );
    }

    // Update tenant settings
    const newSettings = {
      legalName: property?.legalName,
      dateFormat: operations?.dateFormat,
      timeFormat: operations?.timeFormat,
      emailNotifications: notifications?.emailNotifications,
      smsNotifications: notifications?.smsNotifications,
      pushNotifications: notifications?.pushNotifications,
      weeklyReport: notifications?.weeklyReport,
      dailyDigest: notifications?.dailyDigest,
    };

    await db.tenant.update({
      where: { id: tenantId },
      data: {
        timezone: operations?.timezone,
        currency: operations?.defaultCurrency,
        settings: JSON.stringify(newSettings),
      },
    });

    // Update the target property if exists and property data provided
    if (targetProperty && property) {
      await db.property.update({
        where: { id: targetProperty.id },
        data: {
          name: property.name,
          description: property.description,
          website: property.website,
          email: property.email,
          phone: property.phone,
          address: property.address,
          city: property.city,
          country: property.country,
          postalCode: property.postalCode,
          checkInTime: operations?.checkInTime,
          checkOutTime: operations?.checkOutTime,
        },
      });
    }

    // Log audit
    try {
      await logSettings(request, 'settings_update', 'general_settings', undefined, {
        property: property ? 'updated' : 'skipped',
        operations: operations ? 'updated' : 'skipped',
        notifications: notifications ? 'updated' : 'skipped',
      }, { tenantId: user.tenantId, userId: user.id });
    } catch (auditError) {
      console.error('Audit log failed (non-blocking):', auditError);
    }

    return NextResponse.json({
      success: true,
      data: { tenantId, property, operations, notifications },
      message: 'General settings updated successfully',
    });
  } catch (error) {
    console.error('Error updating general settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update general settings' },
      { status: 500 }
    );
  }
}
