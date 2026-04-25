/**
 * Notifications API Route
 * 
 * GET: List notifications for user with pagination
 * POST: Create and send notification
 * PUT: Mark as read/dismiss
 * DELETE: Remove notification
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { notificationService, NotificationData, NotificationChannel, NotificationCategory, NotificationPriority } from '@/lib/services/notification-service';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET - List notifications for user with pagination
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'notifications.view')) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const type = searchParams.get('type') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const result = await notificationService.getNotifications(user.tenantId, user.id, {
      unreadOnly,
      type,
      limit,
      offset,
    });

    // Get notification preferences
    const preferences = await notificationService.getUserPreferences(user.tenantId, user.id);

    return NextResponse.json({
      success: true,
      data: {
        notifications: result.notifications,
        total: result.total,
        unreadCount: result.unreadCount,
        preferences,
      },
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

// POST - Create and send notification
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'notifications.send')) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      userId,
      guestId,
      type,
      category = 'info',
      title,
      message,
      data,
      link,
      icon,
      image,
      priority = 'normal',
      channels,
      scheduledFor,
      templateId,
      templateVariables,
      actionType,
      actionData,
      expiresAt,
    } = body;

    // Validate required fields
    if (!title || !message || !type) {
      return NextResponse.json(
        { success: false, error: 'Title, message, and type are required' },
        { status: 400 }
      );
    }

    if (!userId && !guestId) {
      return NextResponse.json(
        { success: false, error: 'Either userId or guestId is required' },
        { status: 400 }
      );
    }

    const notificationData: NotificationData = {
      tenantId: user.tenantId,
      userId,
      guestId,
      type,
      category: category as NotificationCategory,
      title,
      message,
      data: data || {},
      link,
      icon,
      image,
      priority: priority as NotificationPriority,
      channels: channels as NotificationChannel[],
      scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
      templateId,
      templateVariables,
      actionType,
      actionData,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    };

    const result = await notificationService.send(notificationData);

    return NextResponse.json({
      success: result.success,
      data: {
        notificationId: result.notificationId,
        scheduledNotificationId: result.scheduledNotificationId,
        channels: result.channels,
      },
      errors: result.errors,
      message: result.success 
        ? (result.scheduledNotificationId ? 'Notification scheduled successfully' : 'Notification sent successfully')
        : 'Failed to send notification',
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}

// PUT - Mark as read/dismiss or update preference
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'notifications.manage')) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, notificationId, markAllRead, preference } = body;

    // Mark all as read
    if (markAllRead) {
      await notificationService.markAllAsRead(user.tenantId, user.id);
      return NextResponse.json({
        success: true,
        message: 'All notifications marked as read',
      });
    }

    // Update preference
    if (preference) {
      const { category, ...prefs } = preference;
      await notificationService.updateUserPreference(user.tenantId, user.id, category, prefs);
      return NextResponse.json({
        success: true,
        message: 'Notification preference updated',
      });
    }

    // Mark single notification as read/dismiss
    if (!notificationId) {
      return NextResponse.json(
        { success: false, error: 'Notification ID is required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'read':
        await notificationService.markAsRead(notificationId);
        return NextResponse.json({
          success: true,
          message: 'Notification marked as read',
        });

      case 'dismiss':
        await notificationService.dismiss(notificationId);
        return NextResponse.json({
          success: true,
          message: 'Notification dismissed',
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Use "read" or "dismiss"' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update notification' },
      { status: 500 }
    );
  }
}

// DELETE - Remove notification
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'notifications.manage')) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const notificationId = searchParams.get('id');

    if (!notificationId) {
      return NextResponse.json(
        { success: false, error: 'Notification ID is required' },
        { status: 400 }
      );
    }

    await notificationService.delete(notificationId);

    return NextResponse.json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete notification' },
      { status: 500 }
    );
  }
}
