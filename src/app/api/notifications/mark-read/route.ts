/**
 * POST /api/notifications/mark-read
 *
 * Marks one or more notifications as read.
 * Body: { id: string } | { ids: string[] } | { markAll: true }
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
    const { id, ids, markAll } = body as { id?: string; ids?: string[]; markAll?: boolean };

    if (!id && (!ids || ids.length === 0) && !markAll) {
      return NextResponse.json(
        { success: false, error: 'Notification id, ids array, or markAll is required' },
        { status: 400 }
      );
    }

    let result;

    if (markAll) {
      // Mark all unread notifications for this user as read
      result = await db.notification.updateMany({
        where: {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          readAt: null,
        },
        data: {
          readAt: new Date(),
        },
      });
    } else {
      // Mark specific notification(s) as read
      const notificationIds = id ? [id] : ids!;

      // Verify notifications belong to the current user and tenant
      const existing = await db.notification.findMany({
        where: {
          id: { in: notificationIds },
          tenantId: ctx.tenantId,
          userId: ctx.userId,
        },
        select: { id: true },
      });

      if (existing.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No matching notifications found' },
          { status: 404 }
        );
      }

      const existingIds = existing.map((n) => n.id);

      result = await db.notification.updateMany({
        where: {
          id: { in: existingIds },
          readAt: null,
        },
        data: {
          readAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `${result.count} notification(s) marked as read`,
      data: { markedCount: result.count },
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to mark notification as read' },
      { status: 500 }
    );
  }
}
