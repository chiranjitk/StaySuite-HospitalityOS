/**
 * Interface Shell Script Wrapper
 *
 * Provides typed functions for interface introspection via scripts/network/interface.sh
 */

import {
  executeScript,
  sanitizeInterfaceName,
  ScriptResult,
} from './executor';

export interface InterfaceStats {
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
  rxErrors: number;
  txErrors: number;
  rxDropped: number;
  txDropped: number;
}

export interface InterfaceInfo {
  name: string;
  type: string;
  hwAddress: string;
  mtu: number;
  state: string;
  speed: string;
  duplex: string;
  ipv4Addresses: string[];
  ipv6Addresses: string[];
  carrier: boolean;
  stats: InterfaceStats;
}

export interface InterfaceListResult {
  interfaces: InterfaceInfo[];
  count: number;
}

export interface InterfaceSystemInfo {
  hostname: string;
  kernel: string;
  osRelease: string;
  uptime: string;
  loadAverage: string[];
  memory: { total: number; free: number; used: number };
  cpuCount: number;
}

/**
 * List all network interfaces with details.
 * Reads from /sys/class/net/ and ip addr
 */
export function listInterfaces(): ScriptResult<InterfaceListResult> {
  return executeScript<InterfaceListResult>('interface.sh', ['list']);
}

/**
 * Get detailed info for a single interface.
 */
export function getInterfaceInfo(name: string): ScriptResult<InterfaceInfo> {
  sanitizeInterfaceName(name);
  return executeScript<InterfaceInfo>('interface.sh', ['info', name]);
}

/**
 * Get RX/TX statistics for an interface.
 */
export function getInterfaceStats(name: string): ScriptResult<InterfaceStats> {
  sanitizeInterfaceName(name);
  return executeScript<InterfaceStats>('interface.sh', ['stats', name]);
}
