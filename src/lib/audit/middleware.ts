/**
 * Audit Log Middleware and Helpers
 * 
 * Provides easy-to-use functions for logging activities across all modules.
 * Use these helpers in API routes to ensure consistent audit logging.
 */

import { NextRequest } from 'next/server';
import { auditLogService, AuditModule, AuditAction } from '@/lib/services/audit-service';

// =====================================================
// REQUEST CONTEXT EXTRACTION
// =====================================================

export interface RequestContext {
  ipAddress: string;
  userAgent: string | undefined;
  tenantId: string;
  userId?: string;
}

/**
 * Extract context from a Next.js request
 */
export function extractRequestContext(request: NextRequest): RequestContext {
  return {
    ipAddress:
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      request.headers.get('cf-connecting-ip') ||
      'unknown',
    userAgent: request.headers.get('user-agent') ?? undefined,
    tenantId: request.headers.get('x-tenant-id') || 'demo-tenant',
    userId: request.headers.get('x-user-id') || undefined,
  };
}

// =====================================================
// MODULE-SPECIFIC LOGGING HELPERS
// =====================================================

/**
 * Log authentication events
 */
export async function logAuth(
  request: NextRequest,
  action: 'login' | 'logout' | 'login_failed' | 'password_reset' | 'password_change' | '2fa_enabled' | '2fa_disabled' | '2fa_verified' | 'session_revoked',
  userId: string | undefined,
  metadata?: Record<string, unknown>,
  tenantId?: string // Optional tenantId override
) {
  const ctx = extractRequestContext(request);
  return auditLogService.log({
    tenantId: tenantId || ctx.tenantId,
    userId,
    module: 'auth',
    action,
    entityType: 'session',
    entityId: userId,
    newValue: metadata,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });
}

/**
 * Log guest management events
 */
export async function logGuest(
  request: NextRequest,
  action: 'create' | 'update' | 'delete' | 'view' | 'export',
  guestId: string,
  oldValue?: Record<string, unknown>,
  newValue?: Record<string, unknown>,
  overrides?: { tenantId?: string; userId?: string },
) {
  const ctx = extractRequestContext(request);
  return auditLogService.log({
    tenantId: overrides?.tenantId || ctx.tenantId,
    userId: overrides?.userId || ctx.userId,
    module: 'guests',
    action,
    entityType: 'guest',
    entityId: guestId,
    oldValue,
    newValue,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });
}

/**
 * Log room management events
 */
export async function logRoom(
  request: NextRequest,
  action: 'create' | 'update' | 'delete' | 'status_change',
  roomId: string,
  oldValue?: Record<string, unknown>,
  newValue?: Record<string, unknown>,
  overrides?: { tenantId?: string; userId?: string },
) {
  const ctx = extractRequestContext(request);
  return auditLogService.log({
    tenantId: overrides?.tenantId || ctx.tenantId,
    userId: overrides?.userId || ctx.userId,
    module: 'rooms',
    action,
    entityType: 'room',
    entityId: roomId,
    oldValue,
    newValue,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });
}

/**
 * Log booking events
 * @param overrides - Optional tenantId/userId to override header extraction
 */
export async function logBooking(
  request: NextRequest,
  action: 'create' | 'update' | 'delete' | 'check_in' | 'check_out' | 'cancel' | 'confirm' | 'no_show' | 'modify',
  bookingId: string,
  oldValue?: Record<string, unknown>,
  newValue?: Record<string, unknown>,
  overrides?: { tenantId?: string; userId?: string },
) {
  const ctx = extractRequestContext(request);
  return auditLogService.log({
    tenantId: overrides?.tenantId || ctx.tenantId,
    userId: overrides?.userId || ctx.userId,
    module: 'bookings',
    action,
    entityType: 'booking',
    entityId: bookingId,
    oldValue,
    newValue,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });
}

/**
 * Log payment/billing events
 */
export async function logPayment(
  request: NextRequest,
  action: 'payment' | 'refund' | 'void' | 'capture' | 'create' | 'update',
  paymentId: string,
  metadata?: Record<string, unknown>,
  overrides?: { tenantId?: string; userId?: string },
) {
  const ctx = extractRequestContext(request);
  return auditLogService.log({
    tenantId: overrides?.tenantId || ctx.tenantId,
    userId: overrides?.userId || ctx.userId,
    module: 'billing',
    action,
    entityType: 'payment',
    entityId: paymentId,
    newValue: metadata,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });
}

/**
 * Log folio events
 */
export async function logFolio(
  request: NextRequest,
  action: 'create' | 'update' | 'close' | 'invoice',
  folioId: string,
  metadata?: Record<string, unknown>,
  overrides?: { tenantId?: string; userId?: string },
) {
  const ctx = extractRequestContext(request);
  return auditLogService.log({
    tenantId: overrides?.tenantId || ctx.tenantId,
    userId: overrides?.userId || ctx.userId,
    module: 'billing',
    action,
    entityType: 'folio',
    entityId: folioId,
    newValue: metadata,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });
}

/**
 * Log user management events
 */
export async function logUser(
  request: NextRequest,
  action: 'create' | 'update' | 'delete' | 'role_change' | 'permission_change' | 'password_reset',
  targetUserId: string,
  oldValue?: Record<string, unknown>,
  newValue?: Record<string, unknown>,
  overrides?: { tenantId?: string; userId?: string },
) {
  const ctx = extractRequestContext(request);
  return auditLogService.log({
    tenantId: overrides?.tenantId || ctx.tenantId,
    userId: overrides?.userId || ctx.userId,
    module: 'users',
    action,
    entityType: 'user',
    entityId: targetUserId,
    oldValue,
    newValue,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });
}

/**
 * Log WiFi events
 */
export async function logWifi(
  request: NextRequest,
  action: 'create' | 'update' | 'delete' | 'voucher_create' | 'voucher_use' | 'session_start' | 'session_end',
  entityType: 'voucher' | 'session' | 'plan' | 'user',
  entityId: string,
  metadata?: Record<string, unknown>,
  overrides?: { tenantId?: string; userId?: string },
) {
  const ctx = extractRequestContext(request);
  return auditLogService.log({
    tenantId: overrides?.tenantId || ctx.tenantId,
    userId: overrides?.userId || ctx.userId,
    module: 'wifi',
    action,
    entityType,
    entityId,
    newValue: metadata,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });
}

/**
 * Log inventory events
 */
export async function logInventory(
  request: NextRequest,
  action: 'create' | 'update' | 'delete' | 'stock_add' | 'stock_remove' | 'stock_adjust',
  entityType: 'stock_item' | 'purchase_order' | 'vendor',
  entityId: string,
  oldValue?: Record<string, unknown>,
  newValue?: Record<string, unknown>,
  overrides?: { tenantId?: string; userId?: string },
) {
  const ctx = extractRequestContext(request);
  return auditLogService.log({
    tenantId: overrides?.tenantId || ctx.tenantId,
    userId: overrides?.userId || ctx.userId,
    module: 'inventory',
    action,
    entityType,
    entityId,
    oldValue,
    newValue,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });
}

/**
 * Log settings changes
 */
export async function logSettings(
  request: NextRequest,
  action: 'settings_update' | 'feature_toggle' | 'integration_connect' | 'integration_disconnect',
  settingKey: string,
  oldValue?: Record<string, unknown>,
  newValue?: Record<string, unknown>,
  overrides?: { tenantId?: string; userId?: string },
) {
  const ctx = extractRequestContext(request);
  return auditLogService.log({
    tenantId: overrides?.tenantId || ctx.tenantId,
    userId: overrides?.userId || ctx.userId,
    module: 'settings',
    action,
    entityType: 'setting',
    entityId: settingKey,
    oldValue,
    newValue,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });
}

/**
 * Log task/housekeeping events
 */
export async function logTask(
  request: NextRequest,
  action: 'create' | 'update' | 'delete' | 'assign' | 'complete' | 'start',
  taskId: string,
  metadata?: Record<string, unknown>,
  overrides?: { tenantId?: string; userId?: string },
) {
  const ctx = extractRequestContext(request);
  return auditLogService.log({
    tenantId: overrides?.tenantId || ctx.tenantId,
    userId: overrides?.userId || ctx.userId,
    module: 'housekeeping',
    action,
    entityType: 'task',
    entityId: taskId,
    newValue: metadata,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });
}

/**
 * Log channel manager events
 */
export async function logChannel(
  request: NextRequest,
  action: 'create' | 'update' | 'delete' | 'sync' | 'connection' | 'rate_sync',
  entityType: 'ota_connection' | 'rate_sync' | 'inventory_sync' | 'reservation',
  entityId: string,
  metadata?: Record<string, unknown>,
  overrides?: { tenantId?: string; userId?: string },
) {
  const ctx = extractRequestContext(request);
  return auditLogService.log({
    tenantId: overrides?.tenantId || ctx.tenantId,
    userId: overrides?.userId || ctx.userId,
    module: 'channel',
    action,
    entityType,
    entityId,
    newValue: metadata,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });
}

/**
 * Log security events
 */
export async function logSecurity(
  request: NextRequest,
  action: 'access_denied' | 'suspicious_activity' | 'api_key_create' | 'api_key_revoke' | 'data_export',
  description: string,
  metadata?: Record<string, unknown>,
  overrides?: { tenantId?: string; userId?: string },
) {
  const ctx = extractRequestContext(request);
  return auditLogService.log({
    tenantId: overrides?.tenantId || ctx.tenantId,
    userId: overrides?.userId || ctx.userId,
    module: 'security',
    action,
    entityType: 'security_event',
    newValue: { description, ...metadata },
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });
}

/**
 * Log system events (automated operations)
 */
export async function logSystem(
  tenantId: string,
  action: AuditAction,
  entityType: string,
  entityId?: string,
  metadata?: Record<string, unknown>
) {
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
// GENERIC LOGGING HELPER
// =====================================================

/**
 * Generic audit log helper for any module
 */
export async function audit(
  request: NextRequest,
  module: AuditModule,
  action: AuditAction | string,
  entityType: string,
  entityId?: string,
  oldValue?: Record<string, unknown>,
  newValue?: Record<string, unknown>,
  overrides?: { tenantId?: string; userId?: string },
) {
  const ctx = extractRequestContext(request);
  return auditLogService.log({
    tenantId: overrides?.tenantId || ctx.tenantId,
    userId: overrides?.userId || ctx.userId,
    module,
    action,
    entityType,
    entityId,
    oldValue,
    newValue,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });
}

// Export all helpers as named exports
export const auditHelpers = {
  logAuth,
  logGuest,
  logRoom,
  logBooking,
  logPayment,
  logFolio,
  logUser,
  logWifi,
  logInventory,
  logSettings,
  logTask,
  logChannel,
  logSecurity,
  logSystem,
  audit,
};

export default auditHelpers;
