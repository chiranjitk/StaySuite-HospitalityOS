/**
 * Comprehensive Audit Log Service
 * 
 * Tracks all system activities for compliance, security, and debugging.
 * 
 * Features:
 * - User activity tracking (who did what)
 * - IP address and user agent capture
 * - Before/after value comparison
 * - Correlation IDs for linking related operations
 * - Module-based categorization
 * - Automatic request context extraction
 */

import { db } from '@/lib/db';
import type { AuditLog, User, Tenant } from '@prisma/client';
import { randomUUID } from 'crypto';

// =====================================================
// TYPES & INTERFACES
// =====================================================

export type AuditModule = 
  | 'auth'           // Authentication events
  | 'admin'          // Admin operations
  | 'bookings'       // Booking operations
  | 'guests'         // Guest management
  | 'rooms'          // Room management
  | 'billing'        // Billing & payments
  | 'inventory'      // Inventory operations
  | 'housekeeping'   // Housekeeping tasks
  | 'channel'        // Channel manager
  | 'integrations'   // Third-party integrations
  | 'settings'       // System settings
  | 'users'          // User management
  | 'reports'        // Report generation
  | 'wifi'           // WiFi operations
  | 'pos'            // POS operations
  | 'parking'        // Parking operations
  | 'iot'            // IoT/Smart devices
  | 'notifications'  // Notification events
  | 'webhooks'       // Webhook events
  | 'automation'     // Automation workflows
  | 'ai'             // AI operations
  | 'security'       // Security events
  | 'system';        // System-level events

export type AuditAction =
  // Generic CRUD actions
  | 'create'
  | 'update'
  | 'delete'
  | 'view'
  | 'export'
  | 'import'
  // Auth actions
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'password_reset'
  | 'password_change'
  | '2fa_enabled'
  | '2fa_disabled'
  | '2fa_verified'
  | 'session_revoked'
  | 'oauth_login'
  // Booking actions
  | 'check_in'
  | 'check_out'
  | 'cancel'
  | 'modify'
  | 'confirm'
  | 'no_show'
  | 'overbook'
  // Payment actions
  | 'payment'
  | 'refund'
  | 'void'
  | 'capture'
  // Admin actions
  | 'user_create'
  | 'user_update'
  | 'user_delete'
  | 'role_change'
  | 'permission_change'
  | 'tenant_create'
  | 'tenant_suspend'
  | 'tenant_activate'
  // Settings actions
  | 'settings_update'
  | 'feature_toggle'
  | 'integration_connect'
  | 'integration_disconnect'
  // Security actions
  | 'access_denied'
  | 'suspicious_activity'
  | 'data_export'
  | 'api_key_create'
  | 'api_key_revoke'
  // System actions
  | 'backup'
  | 'restore'
  | 'maintenance'
  | 'error';

export interface AuditLogInput {
  tenantId: string;
  userId?: string;
  module: AuditModule;
  action: AuditAction | string;
  entityType: string;
  entityId?: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogQuery {
  tenantId: string;
  module?: AuditModule;
  action?: string;
  userId?: string;
  entityType?: string;
  entityId?: string;
  ipAddress?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  page?: number;
  limit?: number;
}

export interface AuditLogStats {
  total: number;
  byModule: Record<string, number>;
  byAction: Record<string, number>;
  byUser: Array<{ userId: string; userName: string; count: number }>;
  recentActivity: Array<{ date: string; count: number }>;
}

// =====================================================
// AUDIT LOG SERVICE CLASS
// =====================================================

class AuditLogService {
  private correlationId: string | null = null;

  /**
   * Start a new correlation context for linking related operations
   */
  startCorrelation(): string {
    this.correlationId = randomUUID();
    return this.correlationId;
  }

  /**
   * Get current correlation ID
   */
  getCorrelationId(): string | null {
    return this.correlationId;
  }

  /**
   * End correlation context
   */
  endCorrelation(): void {
    this.correlationId = null;
  }

  /**
   * Create an audit log entry
   */
  async log(input: AuditLogInput): Promise<AuditLog> {
    const {
      tenantId,
      userId,
      module,
      action,
      entityType,
      entityId,
      oldValue,
      newValue,
      description,
      ipAddress,
      userAgent,
      correlationId,
      metadata,
    } = input;

    try {
      // Build the audit log entry
      const auditLog = await db.auditLog.create({
        data: {
          tenantId,
          userId: userId || null, // Ensure null instead of undefined
          module,
          action,
          entityType,
          entityId,
          oldValue: oldValue ? JSON.stringify(oldValue) : null,
          newValue: newValue ? JSON.stringify(newValue) : null,
          ipAddress,
          userAgent,
          correlationId: correlationId || this.correlationId || undefined,
        },
      });

      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[AUDIT] ${module}.${action} by user ${userId || 'system'} on ${entityType}:${entityId || 'N/A'}`);
      }

      return auditLog;
    } catch (error) {
      // Don't break the application if audit logging fails
      // Just log the error and rethrow
      console.error('[AUDIT] Failed to create audit log:', error);
      throw error;
    }
  }

  /**
   * Log with automatic request context extraction
   * Use this in API routes to automatically capture IP and user agent
   */
  async logWithContext(
    input: Omit<AuditLogInput, 'ipAddress' | 'userAgent' | 'correlationId'>,
    request?: Request
  ): Promise<AuditLog> {
    let ipAddress: string | undefined;
    let userAgent: string | undefined;

    if (request) {
      // Extract IP address from various headers
      ipAddress = 
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        request.headers.get('cf-connecting-ip') ||
        'unknown';

      userAgent = request.headers.get('user-agent') || undefined;
    }

    return this.log({
      ...input,
      ipAddress,
      userAgent,
      correlationId: this.correlationId || undefined,
    });
  }

  /**
   * Batch log multiple entries
   */
  async logBatch(inputs: AuditLogInput[]): Promise<number> {
    const data = inputs.map(input => ({
      tenantId: input.tenantId,
      userId: input.userId,
      module: input.module,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      oldValue: input.oldValue ? JSON.stringify(input.oldValue) : null,
      newValue: input.newValue ? JSON.stringify(input.newValue) : null,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      correlationId: input.correlationId || this.correlationId,
    }));

    const result = await db.auditLog.createMany({ data });
    return result.count;
  }

  /**
   * Query audit logs with filtering and pagination
   */
  async query(query: AuditLogQuery): Promise<{
    logs: Array<AuditLog & { user?: { firstName: string | null; lastName: string | null; email: string } | null }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      tenantId,
      module,
      action,
      userId,
      entityType,
      entityId,
      ipAddress,
      dateFrom,
      dateTo,
      search,
      page = 1,
      limit = 50,
    } = query;

    const where = {
      tenantId,
      ...(module && { module }),
      ...(action && { action }),
      ...(userId && { userId }),
      ...(entityType && { entityType }),
      ...(entityId && { entityId }),
      ...(ipAddress && { ipAddress: { contains: ipAddress } }),
      ...(dateFrom && { createdAt: { gte: dateFrom } }),
      ...(dateTo && { createdAt: { lte: dateTo } }),
    };

    // Get total count
    const total = await db.auditLog.count({ where });

    // Get logs with user info
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
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get audit log statistics
   */
  async getStats(tenantId: string, days: number = 30): Promise<AuditLogStats> {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    // Get all logs for the period
    const logs = await db.auditLog.findMany({
      where: {
        tenantId,
        createdAt: { gte: dateFrom },
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Calculate by module
    const byModule: Record<string, number> = {};
    logs.forEach(log => {
      byModule[log.module] = (byModule[log.module] || 0) + 1;
    });

    // Calculate by action
    const byAction: Record<string, number> = {};
    logs.forEach(log => {
      byAction[log.action] = (byAction[log.action] || 0) + 1;
    });

    // Calculate by user
    const userCounts: Record<string, { userName: string; count: number }> = {};
    logs.forEach(log => {
      if (log.userId) {
        const userName = log.user 
          ? `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() || log.userId
          : log.userId;
        
        if (!userCounts[log.userId]) {
          userCounts[log.userId] = { userName, count: 0 };
        }
        userCounts[log.userId].count++;
      }
    });

    const byUser = Object.entries(userCounts)
      .map(([userId, data]) => ({
        userId,
        userName: data.userName,
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate daily activity
    const dailyActivity: Record<string, number> = {};
    logs.forEach(log => {
      const date = log.createdAt.toISOString().split('T')[0];
      dailyActivity[date] = (dailyActivity[date] || 0) + 1;
    });

    const recentActivity = Object.entries(dailyActivity)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);

    return {
      total: logs.length,
      byModule,
      byAction,
      byUser,
      recentActivity,
    };
  }

  /**
   * Get a single audit log entry with details
   */
  async getById(id: string, tenantId: string): Promise<AuditLog | null> {
    return db.auditLog.findFirst({
      where: { id, tenantId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Get audit logs for a specific entity
   */
  async getByEntity(
    entityType: string,
    entityId: string,
    tenantId: string
  ): Promise<AuditLog[]> {
    return db.auditLog.findMany({
      where: { entityType, entityId, tenantId },
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
    });
  }

  /**
   * Delete old audit logs (retention policy)
   */
  async deleteOlderThan(days: number, tenantId?: string): Promise<number> {
    const date = new Date();
    date.setDate(date.getDate() - days);

    const result = await db.auditLog.deleteMany({
      where: {
        createdAt: { lt: date },
        ...(tenantId && { tenantId }),
      },
    });

    return result.count;
  }

  /**
   * Export audit logs to JSON
   */
  async export(query: AuditLogQuery): Promise<string> {
    const { logs } = await this.query({ ...query, limit: 10000 });
    return JSON.stringify(logs, null, 2);
  }
}

// Export singleton instance
export const auditLogService = new AuditLogService();

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Log an authentication event
 */
export async function logAuthEvent(
  tenantId: string,
  userId: string | undefined,
  action: AuditAction,
  request?: Request,
  metadata?: { email?: string; reason?: string }
): Promise<AuditLog> {
  return auditLogService.logWithContext(
    {
      tenantId,
      userId,
      module: 'auth',
      action,
      entityType: 'user',
      entityId: userId,
      newValue: metadata,
    },
    request
  );
}

/**
 * Log a booking event
 */
export async function logBookingEvent(
  tenantId: string,
  userId: string | undefined,
  action: AuditAction,
  bookingId: string,
  oldValue?: Record<string, unknown>,
  newValue?: Record<string, unknown>,
  request?: Request
): Promise<AuditLog> {
  return auditLogService.logWithContext(
    {
      tenantId,
      userId,
      module: 'bookings',
      action,
      entityType: 'booking',
      entityId: bookingId,
      oldValue,
      newValue,
    },
    request
  );
}

/**
 * Log a guest event
 */
export async function logGuestEvent(
  tenantId: string,
  userId: string | undefined,
  action: AuditAction,
  guestId: string,
  oldValue?: Record<string, unknown>,
  newValue?: Record<string, unknown>,
  request?: Request
): Promise<AuditLog> {
  return auditLogService.logWithContext(
    {
      tenantId,
      userId,
      module: 'guests',
      action,
      entityType: 'guest',
      entityId: guestId,
      oldValue,
      newValue,
    },
    request
  );
}

/**
 * Log a payment/billing event
 */
export async function logBillingEvent(
  tenantId: string,
  userId: string | undefined,
  action: AuditAction,
  entityType: 'payment' | 'invoice' | 'refund' | 'folio',
  entityId: string,
  oldValue?: Record<string, unknown>,
  newValue?: Record<string, unknown>,
  request?: Request
): Promise<AuditLog> {
  return auditLogService.logWithContext(
    {
      tenantId,
      userId,
      module: 'billing',
      action,
      entityType,
      entityId,
      oldValue,
      newValue,
    },
    request
  );
}

/**
 * Log a room event
 */
export async function logRoomEvent(
  tenantId: string,
  userId: string | undefined,
  action: AuditAction,
  roomId: string,
  oldValue?: Record<string, unknown>,
  newValue?: Record<string, unknown>,
  request?: Request
): Promise<AuditLog> {
  return auditLogService.logWithContext(
    {
      tenantId,
      userId,
      module: 'rooms',
      action,
      entityType: 'room',
      entityId: roomId,
      oldValue,
      newValue,
    },
    request
  );
}

/**
 * Log a user management event
 */
export async function logUserEvent(
  tenantId: string,
  performedBy: string,
  action: AuditAction,
  targetUserId: string,
  oldValue?: Record<string, unknown>,
  newValue?: Record<string, unknown>,
  request?: Request
): Promise<AuditLog> {
  return auditLogService.logWithContext(
    {
      tenantId,
      userId: performedBy,
      module: 'users',
      action,
      entityType: 'user',
      entityId: targetUserId,
      oldValue,
      newValue,
    },
    request
  );
}

/**
 * Log a settings change
 */
export async function logSettingsEvent(
  tenantId: string,
  userId: string | undefined,
  action: AuditAction,
  settingKey: string,
  oldValue?: Record<string, unknown>,
  newValue?: Record<string, unknown>,
  request?: Request
): Promise<AuditLog> {
  return auditLogService.logWithContext(
    {
      tenantId,
      userId,
      module: 'settings',
      action,
      entityType: 'setting',
      entityId: settingKey,
      oldValue,
      newValue,
    },
    request
  );
}

/**
 * Log an inventory event
 */
export async function logInventoryEvent(
  tenantId: string,
  userId: string | undefined,
  action: AuditAction,
  entityType: 'stock_item' | 'purchase_order' | 'vendor',
  entityId: string,
  oldValue?: Record<string, unknown>,
  newValue?: Record<string, unknown>,
  request?: Request
): Promise<AuditLog> {
  return auditLogService.logWithContext(
    {
      tenantId,
      userId,
      module: 'inventory',
      action,
      entityType,
      entityId,
      oldValue,
      newValue,
    },
    request
  );
}

/**
 * Log a security event
 */
export async function logSecurityEvent(
  tenantId: string,
  userId: string | undefined,
  action: AuditAction,
  description: string,
  metadata?: Record<string, unknown>,
  request?: Request
): Promise<AuditLog> {
  return auditLogService.logWithContext(
    {
      tenantId,
      userId,
      module: 'security',
      action,
      entityType: 'security_event',
      newValue: { description, ...metadata },
    },
    request
  );
}

/**
 * Log a channel manager event
 */
export async function logChannelEvent(
  tenantId: string,
  userId: string | undefined,
  action: AuditAction,
  entityType: 'ota_connection' | 'rate_sync' | 'inventory_sync' | 'reservation',
  entityId: string,
  oldValue?: Record<string, unknown>,
  newValue?: Record<string, unknown>,
  request?: Request
): Promise<AuditLog> {
  return auditLogService.logWithContext(
    {
      tenantId,
      userId,
      module: 'channel',
      action,
      entityType,
      entityId,
      oldValue,
      newValue,
    },
    request
  );
}

/**
 * Log a system event (for automated operations)
 */
export async function logSystemEvent(
  tenantId: string,
  action: AuditAction,
  entityType: string,
  entityId?: string,
  metadata?: Record<string, unknown>
): Promise<AuditLog> {
  return auditLogService.log({
    tenantId,
    module: 'system',
    action,
    entityType,
    entityId,
    newValue: metadata,
  });
}

// =====================================================
// AUDIT LOG MIDDLEWARE
// =====================================================

/**
 * Express-like middleware for automatic request logging
 */
export function auditMiddleware(module: AuditModule, action: AuditAction) {
  return async (
    request: Request,
    tenantId: string,
    userId?: string,
    entityType?: string,
    entityId?: string
  ) => {
    return auditLogService.logWithContext(
      {
        tenantId,
        userId,
        module,
        action,
        entityType: entityType || 'request',
        entityId,
      },
      request
    );
  };
}

// =====================================================
// AUDIT LOG DECORATOR HELPERS
// =====================================================

/**
 * Wrapper function to automatically log function execution
 */
export async function withAudit<T>(
  fn: () => Promise<T>,
  auditInput: AuditLogInput,
  request?: Request
): Promise<T> {
  try {
    const result = await fn();
    
    await auditLogService.logWithContext(
      {
        ...auditInput,
        newValue: result as unknown as Record<string, unknown>,
      },
      request
    );
    
    return result;
  } catch (error) {
    // Log the error
    await auditLogService.logWithContext(
      {
        ...auditInput,
        action: `${auditInput.action}_failed` as AuditAction,
        newValue: { error: String(error) },
      },
      request
    );
    
    throw error;
  }
}

export default auditLogService;
