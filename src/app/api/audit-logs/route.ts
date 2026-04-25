/**
 * Audit Logs API
 * 
 * GET  /api/audit-logs - Query audit logs with filtering
 * POST /api/audit-logs - Create new audit log entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auditLogService } from '@/lib/services/audit-service';
import type { AuditModule } from '@/lib/services/audit-service';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET - Query audit logs
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

    // Check permissions - audit logs require admin or billing permissions
    if (!hasAnyPermission(user, ['audit.view', 'admin.audit', '*'])) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const moduleFilter = searchParams.get('module') as AuditModule | null;
    const action = searchParams.get('action');
    const userId = searchParams.get('userId');
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');
    const ipAddress = searchParams.get('ipAddress');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const stats = searchParams.get('stats') === 'true';
    const days = parseInt(searchParams.get('days') || '30');

    // If stats requested, return statistics
    if (stats) {
      const statsData = await auditLogService.getStats(tenantId, days);
      return NextResponse.json({
        success: true,
        data: statsData,
      });
    }

    // Build query
    const query = {
      tenantId,
      module: moduleFilter || undefined,
      action: action || undefined,
      userId: userId || undefined,
      entityType: entityType || undefined,
      entityId: entityId || undefined,
      ipAddress: ipAddress || undefined,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      search: search || undefined,
      page,
      limit,
    };

    const result = await auditLogService.query(query);

    // Parse JSON values for easier consumption
    const logsWithParsedValues = result.logs.map(log => ({
      ...log,
      oldValue: log.oldValue ? JSON.parse(log.oldValue) : null,
      newValue: log.newValue ? JSON.parse(log.newValue) : null,
      userName: log.user 
        ? `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() || log.user.email
        : 'System',
    }));

    return NextResponse.json({
      success: true,
      data: logsWithParsedValues,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    console.error('[AUDIT_LOGS_API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}

// POST - Create audit log entry
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check permissions - creating audit logs requires admin or logging permissions
    if (!hasAnyPermission(user, ['audit.create', 'admin.audit', '*'])) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const tenantId = user.tenantId;
    
    // Extract IP and user agent
    const ipAddress = 
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      request.headers.get('cf-connecting-ip') ||
      'unknown';
    
    const userAgent = request.headers.get('user-agent') || undefined;

    // Validate required fields
    if (!body.module || !body.action || !body.entityType) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: module, action, entityType' },
        { status: 400 }
      );
    }

    const auditLog = await auditLogService.log({
      tenantId,
      userId: user.id, // Always use the authenticated user's ID — never trust client-supplied userId to prevent audit trail impersonation
      module: body.module,
      action: body.action,
      entityType: body.entityType,
      entityId: body.entityId,
      oldValue: body.oldValue,
      newValue: body.newValue,
      ipAddress,
      userAgent,
      correlationId: body.correlationId,
      metadata: body.metadata,
    });

    return NextResponse.json({
      success: true,
      data: auditLog,
    });
  } catch (error) {
    console.error('[AUDIT_LOGS_API] Error creating audit log:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create audit log' },
      { status: 500 }
    );
  }
}
