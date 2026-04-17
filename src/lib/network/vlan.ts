/**
 * VLAN Shell Script Wrapper
 *
 * Provides typed functions for VLAN operations via scripts/network/vlan.sh
 *
 * Usage:
 *   import { createVlan, deleteVlan, listVlans } from '@/lib/network/vlan';
 */

import {
  executeScript,
  sanitizeInterfaceName,
  validateVlanId,
  validateMtu,
  ScriptResult,
} from './executor';

export interface VlanCreateParams {
  parentInterface: string;
  vlanId: number;
  name?: string;
  mtu?: number;
}

export interface VlanInfo {
  name: string;
  parent: string;
  vlanId: number;
  mtu?: number;
  state?: string;
}

export interface VlanListResult {
  vlans: VlanInfo[];
  count: number;
}

export interface VlanCreateResult {
  name: string;
  parent: string;
  vlanId: number;
  mtu: number;
  state: string;
}

export interface VlanDeleteResult {
  name: string;
  removed: boolean;
}

/**
 * Create a VLAN interface.
 * OS command: ip link add link <parent> name <name> type vlan id <vlanId>
 */
export function createVlan(params: VlanCreateParams): ScriptResult<VlanCreateResult> {
  const { parentInterface, vlanId, name, mtu } = params;

  sanitizeInterfaceName(parentInterface);
  validateVlanId(vlanId);

  const args = ['create', parentInterface, String(vlanId)];
  if (name) {
    sanitizeInterfaceName(name);
    args.push(name);
  }
  if (mtu !== undefined) {
    validateMtu(mtu);
    args.push(String(mtu));
  }

  return executeScript<VlanCreateResult>('vlan.sh', args);
}

/**
 * Delete a VLAN interface.
 * OS command: ip link del <name>
 */
export function deleteVlan(ifaceName: string): ScriptResult<VlanDeleteResult> {
  sanitizeInterfaceName(ifaceName);
  return executeScript<VlanDeleteResult>('vlan.sh', ['delete', ifaceName]);
}

/**
 * List all VLAN interfaces.
 * OS command: ip -o link show type vlan
 */
export function listVlans(): ScriptResult<VlanListResult> {
  return executeScript<VlanListResult>('vlan.sh', ['list']);
}

/**
 * Check if a VLAN interface exists.
 */
export function vlanExists(ifaceName: string): boolean {
  const result = listVlans();
  if (!result.success || !result.data) return false;
  return result.data.vlans.some((v) => v.name === ifaceName);
}
