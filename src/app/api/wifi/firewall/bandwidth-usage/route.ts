import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/wifi/firewall/bandwidth-usage - Get bandwidth usage data
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const planId = searchParams.get('planId');
    const username = searchParams.get('username');
    const type = searchParams.get('type') || 'daily'; // 'daily' or 'session'
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    if (type === 'daily') {
      // Daily aggregate bandwidth usage
      const where: Record<string, unknown> = { tenantId: user.tenantId };

      if (propertyId) where.propertyId = propertyId;

      if (startDate) {
        where.date = { ...(where.date as Record<string, unknown> || {}), gte: new Date(startDate) };
      }
      if (endDate) {
        where.date = { ...(where.date as Record<string, unknown> || {}), lte: new Date(endDate) };
      }

      // Default to last 30 days if no date range specified
      if (!startDate && !endDate) {
        where.date = { gte: new Date(new Date().setDate(new Date().getDate() - 30)) };
      }

      const dailyUsage = await db.bandwidthUsageDaily.findMany({
        where,
        orderBy: { date: 'desc' },
        ...(limit && { take: parseInt(limit, 10) }),
        ...(offset && { skip: parseInt(offset, 10) }),
      });

      const total = await db.bandwidthUsageDaily.count({ where });

      // Calculate aggregate stats
      const aggregates = await db.bandwidthUsageDaily.aggregate({
        where,
        _sum: {
          totalDownloadMb: true,
          totalUploadMb: true,
          uniqueUsers: true,
          peakUsers: true,
        },
      });

      return NextResponse.json({
        success: true,
        data: dailyUsage,
        type: 'daily',
        pagination: {
          total,
          limit: limit ? parseInt(limit, 10) : null,
          offset: offset ? parseInt(offset, 10) : null,
        },
        summary: {
          totalDownloadMb: aggregates._sum.totalDownloadMb || 0,
          totalUploadMb: aggregates._sum.totalUploadMb || 0,
          totalTrafficMb: (aggregates._sum.totalDownloadMb || 0) + (aggregates._sum.totalUploadMb || 0),
          daysInRange: total,
        },
      });
    }

    if (type === 'session') {
      // Per-session bandwidth usage
      const where: Record<string, unknown> = { tenantId: user.tenantId };

      if (propertyId) where.propertyId = propertyId;
      if (planId) where.planId = planId;
      if (username) where.username = { contains: username };

      if (startDate) {
        where.startedAt = { ...(where.startedAt as Record<string, unknown> || {}), gte: new Date(startDate) };
      }
      if (endDate) {
        where.startedAt = { ...(where.startedAt as Record<string, unknown> || {}), lte: new Date(endDate) };
      }

      // Default to last 7 days for sessions
      if (!startDate && !endDate) {
        where.startedAt = { gte: new Date(new Date().setDate(new Date().getDate() - 7)) };
      }

      const sessions = await db.bandwidthUsageSession.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        ...(limit && { take: parseInt(limit, 10) }),
        ...(offset && { skip: parseInt(offset, 10) }),
      });

      const total = await db.bandwidthUsageSession.count({ where });

      // Calculate aggregate stats
      const aggregates = await db.bandwidthUsageSession.aggregate({
        where,
        _sum: {
          downloadBytes: true,
          uploadBytes: true,
          durationSeconds: true,
        },
        _count: { id: true },
      });

      return NextResponse.json({
        success: true,
        data: sessions,
        type: 'session',
        pagination: {
          total,
          limit: limit ? parseInt(limit, 10) : null,
          offset: offset ? parseInt(offset, 10) : null,
        },
        summary: {
          totalSessions: aggregates._count.id,
          totalDownloadMb: ((aggregates._sum.downloadBytes || 0) / (1024 * 1024)).toFixed(2),
          totalUploadMb: ((aggregates._sum.uploadBytes || 0) / (1024 * 1024)).toFixed(2),
          totalDurationHours: ((aggregates._sum.durationSeconds || 0) / 3600).toFixed(2),
        },
      });
    }

    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid type. Use "daily" or "session".' } },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error fetching bandwidth usage:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch bandwidth usage' } },
      { status: 500 }
    );
  }
}
