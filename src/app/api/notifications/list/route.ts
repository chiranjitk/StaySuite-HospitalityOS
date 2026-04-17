/**
 * GET /api/notifications/list
 *
 * Returns paginated notifications for the authenticated user,
 * with optional filtering by type and read status.
 * Requires 'notifications.view' permission.
 * Supports: ?page=1&limit=20&unread=true&type=booking
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/tenant-context';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'notifications.view');
    if (ctx instanceof NextResponse) return ctx;

    const { searchParams } = request.nextUrl;

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20')), 100);
    const offset = (page - 1) * limit;

    // Filters
    const unreadOnly = searchParams.get('unread') === 'true';
    const types = searchParams.getAll('type').filter(Boolean);

    // Build where clause with proper Prisma types
    const where: Prisma.NotificationWhereInput = {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
    };

    if (unreadOnly) {
      where.readAt = null;
    }

    if (types.length > 0) {
      where.type = { in: types };
    }

    // Fetch notifications, total count, and unread count in parallel
    const [notifications, totalCount, unreadCount] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.notification.count({ where }),
      db.notification.count({
        where: {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          readAt: null,
        },
      }),
    ]);

    // Map DB fields to the format the frontend expects
    const mapped = notifications.map((n) => {
      let action: { label: string; section: string } | undefined;
      if (n.actionType && n.actionData) {
        try {
          action = JSON.parse(n.actionData);
        } catch {
          // ignore malformed actionData
        }
      }

      return {
        id: n.id,
        type: n.type,
        title: n.title,
        description: n.message,
        timestamp: n.createdAt.toISOString(),
        read: n.readAt !== null,
        action,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        notifications: mapped,
        total: totalCount,
        unreadCount,
        pagination: {
          page,
          limit,
          offset,
          hasMore: offset + limit < totalCount,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching notifications list:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}
