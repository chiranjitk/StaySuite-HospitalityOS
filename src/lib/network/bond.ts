/**
 * Bond Shell Script Wrapper
 *
 * Provides typed functions for bond operations via scripts/network/bond.sh
 */

import {
  executeScript,
  sanitizeInterfaceName,
  validateBondMode,
  ScriptResult,
} from './executor';

export interface BondCreateParams {
  name: string;
  mode: string;
  miimon?: number;
  lacpRate?: 'slow' | 'fast';
  primary?: string;
  members?: string[];
}

export interface BondInfo {
  name: string;
  mode: string;
  miimon: number;
  lacpRate: string;
  primary: string;
  members: string[];
  state: string;
}

export interface BondListResult {
  bonds: BondInfo[];
  count: number;
}

export interface BondCreateResult {
  name: string;
  mode: string;
  miimon: number;
  members: string[];
  state: string;
}

export interface BondDeleteResult {
  name: string;
  removedMembers: string[];
  removed: boolean;
}

/**
 * Create a network bond.
 * OS commands: modprobe bonding, ip link add name <name> type bond, add members
 */
export function createBond(params: BondCreateParams): ScriptResult<BondCreateResult> {
  const { name, mode, miimon = 100, lacpRate = 'slow', primary, members = [] } = params;

  sanitizeInterfaceName(name);
  validateBondMode(mode);

  const args = ['create', name, mode];
  args.push('--miimon', String(miimon));
  args.push('--lacp-rate', lacpRate);

  if (primary) {
    sanitizeInterfaceName(primary);
    args.push('--primary', primary);
  }

  if (members.length > 0) {
    members.forEach((m) => sanitizeInterfaceName(m));
    args.push('--members', members.join(','));
  }

  return executeScript<BondCreateResult>('bond.sh', args);
}

/**
 * Delete a network bond.
 * OS commands: remove members (nomaster), ip link del <name>
 */
export function deleteBond(name: string): ScriptResult<BondDeleteResult> {
  sanitizeInterfaceName(name);
  return executeScript<BondDeleteResult>('bond.sh', ['delete', name]);
}

/**
 * List all bonds.
 * OS command: reads /proc/net/bonding/* or ip link show type bond
 */
export function listBonds(): ScriptResult<BondListResult> {
  return executeScript<BondListResult>('bond.sh', ['list']);
}
