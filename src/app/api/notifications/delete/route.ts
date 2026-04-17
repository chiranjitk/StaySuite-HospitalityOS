/**
 * POST /api/notifications/delete
 *
 * Deletes one or more notifications.
 * Body: { id: string } | { ids: string[] }
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
    const { id, ids } = body as { id?: string; ids?: string[] };

    if (!id && (!ids || ids.length === 0)) {
      return NextResponse.json(
        { success: false, error: 'Notification id or ids array is required' },
        { status: 400 }
      );
    }

    // Build the list of IDs to delete
    const notificationIds = id ? [id] : ids!;

    // Verify all notifications belong to the current user and tenant
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

    const result = await db.notification.deleteMany({
      where: {
        id: { in: existingIds },
      },
    });

    return NextResponse.json({
      success: true,
      message: `${result.count} notification(s) deleted successfully`,
      data: { deletedCount: result.count },
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete notification' },
      { status: 500 }
    );
  }
}
