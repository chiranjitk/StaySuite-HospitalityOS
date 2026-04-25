/**
 * Audit Module
 * 
 * Central export for all audit logging functionality
 */

export * from './middleware';
export { auditHelpers as default } from './middleware';

// Re-export logAudit as a generic audit logging function
import { audit, logAuth, logGuest, logRoom, logBooking, logPayment, logFolio, logUser, logWifi, logInventory, logSettings, logTask, logChannel, logSecurity, logSystem } from './middleware';
import { NextRequest } from 'next/server';

/**
 * Generic audit logging function
 * Use this for general audit logging when specific helpers don't apply
 */
export async function logAudit(
  request: NextRequest,
  module: string,
  action: string,
  entityType: string,
  entityId: string | undefined,
  oldValue?: Record<string, unknown>,
  newValue?: Record<string, unknown>,
  overrides?: { tenantId?: string; userId?: string }
) {
  return audit(request, module as any, action, entityType, entityId, oldValue, newValue, overrides);
}

// Export all specific loggers
export { 
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
  audit 
};
