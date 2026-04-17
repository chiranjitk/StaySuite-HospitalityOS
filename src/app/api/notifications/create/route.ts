/**
 * POST /api/notifications/create
 *
 * Creates a notification for a specific user or broadcasts to all users in the tenant.
 * Body: { title, message, type?, userId?, priority?, category?, link?, icon?, actionType?, actionData?, expiresAt? }
 * If userId is provided, creates for that specific user; otherwise broadcasts to all active users in the tenant.
 * Requires 'notifications.manage' permission.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/tenant-context';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'notifications.manage');
    if (ctx instanceof NextResponse) return ctx;

    const body = await request.json();
    const {
      title,
      message,
      type = 'system',
      userId: targetUserId,
      priority = 'normal',
      category = 'info',
      link,
      icon,
      actionType,
      actionData,
      expiresAt,
    } = body as {
      title?: string;
      message?: string;
      type?: string;
      userId?: string;
      priority?: string;
      category?: string;
      link?: string;
      icon?: string;
      actionType?: string;
      actionData?: string;
      expiresAt?: string;
    };

    // Validate required fields
    if (!title || !message) {
      return NextResponse.json(
        { success: false, error: 'title and message are required' },
        { status: 400 }
      );
    }

    if (targetUserId) {
      // Verify target user exists and belongs to same tenant
      const targetUser = await db.user.findFirst({
        where: {
          id: targetUserId,
          tenantId: ctx.tenantId,
          status: 'active',
        },
        select: { id: true },
      });

      if (!targetUser) {
        return NextResponse.json(
          { success: false, error: 'Target user not found in this tenant' },
          { status: 404 }
        );
      }

      const notification = await db.notification.create({
        data: {
          tenantId: ctx.tenantId,
          userId: targetUserId,
          type,
          category,
          title,
          message,
          priority,
          link: link || null,
          icon: icon || null,
          actionType: actionType || null,
          actionData: actionData || null,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
      });

      return NextResponse.json(
        {
          success: true,
          message: 'Notification created successfully',
          data: { notification },
        },
        { status: 201 }
      );
    } else {
      // Broadcast: create notification for all active users in the tenant
      const users = await db.user.findMany({
        where: {
          tenantId: ctx.tenantId,
          status: 'active',
        },
        select: { id: true },
      });

      if (users.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No active users found in this tenant' },
          { status: 400 }
        );
      }

      const notifications = await db.notification.createMany({
        data: users.map((user) => ({
          tenantId: ctx.tenantId,
          userId: user.id,
          type,
          category,
          title,
          message,
          priority,
          link: link || null,
          icon: icon || null,
          actionType: actionType || null,
          actionData: actionData || null,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        })),
      });

      return NextResponse.json(
        {
          success: true,
          message: `Notification broadcast to ${notifications.count} users`,
          data: { createdCount: notifications.count },
        },
        { status: 201 }
      );
    }
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create notification' },
      { status: 500 }
    );
  }
}
