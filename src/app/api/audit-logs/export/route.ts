/**
 * Audit Logs Export API
 * 
 * GET /api/audit-logs/export - Export audit logs to CSV or JSON
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { AuditModule } from '@/lib/services/audit-service';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { auditLogService } from '@/lib/services/audit-service';

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

    // Check permissions - exporting audit logs requires admin or audit permissions
    if (!hasAnyPermission(user, ['audit.export', 'admin.audit', '*'])) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';
    
    // Parse query parameters
    const moduleFilter = searchParams.get('module') as AuditModule | null;
    const action = searchParams.get('action');
    const userId = searchParams.get('userId');
    const entityType = searchParams.get('entityType');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10000'), 50000);

    // Build where clause
    const where = {
      tenantId,
      ...(moduleFilter && { module: moduleFilter }),
      ...(action && { action }),
      ...(userId && { userId }),
      ...(entityType && { entityType }),
      ...(dateFrom && { createdAt: { gte: new Date(dateFrom) } }),
      ...(dateTo && { createdAt: { lte: new Date(dateTo) } }),
    };

    // Get logs
    const logs = await db.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    if (format === 'csv') {
      // Generate CSV
      const headers = [
        'ID',
        'Timestamp',
        'User',
        'User Email',
        'Module',
        'Action',
        'Entity Type',
        'Entity ID',
        'IP Address',
        'User Agent',
        'Old Value',
        'New Value',
        'Correlation ID',
      ];

      const rows = logs.map(log => [
        log.id,
        log.createdAt.toISOString(),
        log.user ? `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() : 'System',
        log.user?.email || '',
        log.module,
        log.action,
        log.entityType,
        log.entityId || '',
        log.ipAddress || '',
        log.userAgent || '',
        log.oldValue || '',
        log.newValue || '',
        log.correlationId || '',
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => 
          row.map(cell => {
            // Escape quotes and wrap in quotes if contains comma
            const str = String(cell).replace(/"/g, '""');
            return str.includes(',') || str.includes('"') || str.includes('\n') 
              ? `"${str}"` 
              : str;
          }).join(',')
        ),
      ].join('\n');

      // Log the export action
      await auditLogService.log({
        tenantId,
        userId: user.id,
        module: 'security',
        action: 'data_export',
        entityType: 'audit_log',
        newValue: { format: 'csv', count: logs.length, filters: where },
      });

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // Default: JSON format
    const jsonContent = JSON.stringify(logs.map(log => ({
      ...log,
      oldValue: log.oldValue ? JSON.parse(log.oldValue) : null,
      newValue: log.newValue ? JSON.parse(log.newValue) : null,
      userName: log.user 
        ? `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() || log.user.email
        : 'System',
    })), null, 2);

    // Log the export action
    await auditLogService.log({
      tenantId,
      userId: user.id,
      module: 'security',
      action: 'data_export',
      entityType: 'audit_log',
      newValue: { format: 'json', count: logs.length, filters: where },
    });

    return new NextResponse(jsonContent, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error) {
    console.error('[AUDIT_LOGS_EXPORT_API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to export audit logs' },
      { status: 500 }
    );
  }
}
