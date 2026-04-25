import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// Default settings structure
const defaultSettings = {
  email: {
    enabled: true,
    provider: 'sendgrid',
    fromAddress: 'noreply@hotel.com',
    fromName: 'StaySuite',
    replyTo: 'info@hotel.com',
    trackOpens: true,
    trackClicks: true,
  },
  sms: {
    enabled: true,
    provider: 'twilio',
    fromNumber: '+1234567890',
    alphanumericSenderId: 'StaySuite',
  },
  push: {
    enabled: true,
    provider: 'firebase',
    projectId: 'staysuite-app',
  },
  inApp: {
    enabled: true,
    persistNotifications: true,
    retentionDays: 30,
  },
  triggers: {
    bookingConfirmation: { email: true, sms: true, push: false },
    checkInReminder: { email: true, sms: true, push: true },
    checkOutReminder: { email: true, sms: false, push: false },
    paymentReceipt: { email: true, sms: false, push: false },
    roomReady: { email: false, sms: true, push: true },
    marketingOffers: { email: true, sms: false, push: false },
  },
  quietHours: {
    enabled: true,
    start: '22:00',
    end: '08:00',
    timezone: 'UTC',
  },
};

// GET - Get notification settings
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'settings.view')) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    // Get tenant settings
    const tenant = await db.tenant.findUnique({
      where: { id: user.tenantId },
      select: { settings: true },
    });

    let settings = defaultSettings;

    if (tenant?.settings) {
      try {
        const tenantSettings = JSON.parse(tenant.settings);
        settings = {
          ...defaultSettings,
          ...tenantSettings.notifications,
        };
      } catch {
        // Use defaults if parsing fails
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...settings,
        tenantId: user.tenantId,
      },
    });
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notification settings' },
      { status: 500 }
    );
  }
}

// PUT - Update notification settings
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'settings.manage')) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const settings = body;

    // Get current tenant settings
    const tenant = await db.tenant.findUnique({
      where: { id: user.tenantId },
      select: { settings: true },
    });

    let currentSettings: Record<string, unknown> = {};
    if (tenant?.settings) {
      try {
        currentSettings = JSON.parse(tenant.settings);
      } catch {
        // Use empty object if parsing fails
      }
    }

    // Merge notification settings
    const updatedSettings = JSON.stringify({
      ...currentSettings,
      notifications: settings,
    });

    await db.tenant.update({
      where: { id: user.tenantId },
      data: {
        settings: updatedSettings,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        tenantId: user.tenantId,
        ...settings,
      },
      message: 'Notification settings updated successfully',
    });
  } catch (error) {
    console.error('Error updating notification settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update notification settings' },
      { status: 500 }
    );
  }
}
