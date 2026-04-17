/**
 * Audit Logs Statistics API
 * 
 * GET /api/audit-logs/stats - Get audit log statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { auditLogService } from '@/lib/services/audit-service';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check permissions - audit stats require admin or audit permissions
    if (!hasAnyPermission(user, ['audit.view', 'admin.audit', '*'])) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    // Get basic stats from service
    const stats = await auditLogService.getStats(tenantId, days);

    // Get top IP addresses
    const topIpAddresses = await db.auditLog.groupBy({
      by: ['ipAddress'],
      where: {
        tenantId,
        createdAt: {
          gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
        },
      },
      _count: true,
      orderBy: {
        _count: { ipAddress: 'desc' },
      },
      take: 10,
    });

    // Get top entity types
    const topEntityTypes = await db.auditLog.groupBy({
      by: ['entityType'],
      where: {
        tenantId,
        createdAt: {
          gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
        },
      },
      _count: true,
      orderBy: {
        _count: { entityType: 'desc' },
      },
      take: 10,
    });

    // Get security events count
    const securityEventsCount = await db.auditLog.count({
      where: {
        tenantId,
        module: 'security',
        createdAt: {
          gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
        },
      },
    });

    // Get failed login attempts
    const failedLoginsCount = await db.auditLog.count({
      where: {
        tenantId,
        module: 'auth',
        action: 'login_failed',
        createdAt: {
          gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...stats,
        topIpAddresses: topIpAddresses
          .filter(item => item.ipAddress)
          .map(item => ({
            ipAddress: item.ipAddress,
            count: item._count,
          })),
        topEntityTypes: topEntityTypes.map(item => ({
          entityType: item.entityType,
          count: item._count,
        })),
        securityEventsCount,
        failedLoginsCount,
      },
    });
  } catch (error) {
    console.error('[AUDIT_LOGS_STATS_API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch audit log statistics' },
      { status: 500 }
    );
  }
}
