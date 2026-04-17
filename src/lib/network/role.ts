/**
 * Interface Role Shell Script Wrapper
 *
 * Provides typed functions for interface role management via scripts/network/role.sh
 */

import {
  executeScript,
  sanitizeInterfaceName,
  validateRole,
  ScriptResult,
} from './executor';

export interface RoleInfo {
  interface: string;
  role: string;
  priority: number;
}

export interface RoleListResult {
  roles: RoleInfo[];
  count: number;
}

export interface RoleResult {
  interface: string;
  role: string;
  priority: number;
}

/**
 * Set interface role (persists to /etc/network/interfaces).
 * Valid roles: wan, lan, dmz, management, wifi, guest, iot, unused
 */
export function setRole(iface: string, role: string, priority = 0): ScriptResult<RoleResult> {
  sanitizeInterfaceName(iface);
  validateRole(role);

  return executeScript<RoleResult>('role.sh', ['set', iface, role, String(priority)]);
}

/**
 * Remove interface role from /etc/network/interfaces.
 */
export function removeRole(iface: string): ScriptResult<RoleResult> {
  sanitizeInterfaceName(iface);
  return executeScript<RoleResult>('role.sh', ['remove', iface]);
}

/**
 * List all interface roles from /etc/network/interfaces.
 */
export function listRoles(): ScriptResult<RoleListResult> {
  return executeScript<RoleListResult>('role.sh', ['list']);
}
