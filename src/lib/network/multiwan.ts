/**
 * Multi-WAN Shell Script Wrapper
 *
 * Provides typed functions for multi-WAN configuration via scripts/network/multiwan.sh
 */

import {
  executeScript,
  validateMultiWanMode,
  sanitizeInterfaceName,
  validateIPv4,
  ScriptResult,
} from './executor';

export interface WanMember {
  interfaceName: string;
  gateway: string;
  weight?: number;
  isPrimary?: boolean;
  enabled?: boolean;
}

export interface MultiWanConfig {
  mode: string;
  healthCheckUrl?: string;
  healthCheckInterval?: number;
  healthCheckTimeout?: number;
  failoverThreshold?: number;
  autoSwitchback?: boolean;
  switchbackDelay?: number;
  wanMembers: WanMember[];
}

export interface MultiWanApplyResult {
  mode: string;
  routesApplied: number;
  rulesApplied: number;
  members: string[];
}

export interface MultiWanResetResult {
  tablesFlushed: number;
  rulesRemoved: number;
  nftablesChainsRemoved: number;
}

export interface MultiWanMonitorResult {
  scriptPath: string;
  deployed: boolean;
  crontabEntry?: string;
}

/**
 * Apply weighted ECMP multi-WAN routing.
 */
export function applyWeighted(config: MultiWanConfig): ScriptResult<MultiWanApplyResult> {
  validateMultiWanMode(config.mode);
  validateConfig(config);
  return executeScript<MultiWanApplyResult>('multiwan.sh', ['apply-weighted', JSON.stringify(config)]);
}

/**
 * Apply failover multi-WAN configuration.
 */
export function applyFailover(config: MultiWanConfig): ScriptResult<MultiWanApplyResult> {
  validateMultiWanMode(config.mode);
  validateConfig(config);
  return executeScript<MultiWanApplyResult>('multiwan.sh', ['apply-failover', JSON.stringify(config)]);
}

/**
 * Apply round-robin ECMP multi-WAN routing.
 */
export function applyRoundRobin(config: MultiWanConfig): ScriptResult<MultiWanApplyResult> {
  validateMultiWanMode(config.mode);
  validateConfig(config);
  return executeScript<MultiWanApplyResult>('multiwan.sh', ['apply-round-robin', JSON.stringify(config)]);
}

/**
 * Reset all multi-WAN configuration (remove custom routes, rules, nftables chains).
 */
export function resetMultiWan(): ScriptResult<MultiWanResetResult> {
  return executeScript<MultiWanResetResult>('multiwan.sh', ['reset']);
}

/**
 * Deploy WAN health monitoring script.
 */
export function deployMonitor(config: MultiWanConfig): ScriptResult<MultiWanMonitorResult> {
  validateConfig(config);
  return executeScript<MultiWanMonitorResult>('multiwan.sh', ['deploy-monitor', JSON.stringify(config)]);
}

/**
 * Validate multi-WAN config before sending to script.
 */
function validateConfig(config: MultiWanConfig): void {
  if (!config.wanMembers || config.wanMembers.length === 0) {
    throw new Error('Multi-WAN config must have at least one WAN member.');
  }

  for (const member of config.wanMembers) {
    sanitizeInterfaceName(member.interfaceName);
    if (member.gateway) validateIPv4(member.gateway);
  }
}
