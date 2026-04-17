/**
 * Shell Script Executor for Network Operations
 *
 * This module provides a typed, safe interface to execute the shell scripts
 * in scripts/network/ for all OS-level network operations.
 *
 * Architecture:
 *   GUI → API Route → TypeScript Wrapper → Shell Script → OS
 *                                    ↘ If success → Update DB
 *                                    ↘ If fail → Return error, don't touch DB
 */

import { execSync, ExecSyncOptions } from 'child_process';
import path from 'path';

// Path to scripts directory (relative to project root)
const SCRIPTS_DIR = path.resolve(process.cwd(), 'scripts/network');

/** Default timeout for script execution (10 seconds) */
const DEFAULT_TIMEOUT = 10000;

/**
 * Result from a shell script execution.
 * All scripts return JSON with this shape.
 */
export interface ScriptResult<T = Record<string, unknown>> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp?: string;
}

/**
 * Executor options for running scripts.
 */
export interface ExecutorOptions extends ExecSyncOptions {
  /** Timeout in ms (default: 10000) */
  timeout?: number;
  /** Whether to throw on non-zero exit (default: false) */
  throwOnError?: boolean;
}

/**
 * Sanitize a string for safe shell usage.
 * Rejects any input containing shell metacharacters.
 */
export function sanitizeInput(input: string, fieldName = 'input'): string {
  // Allow only alphanumeric, dots, dashes, underscores, colons (for IPv6), slashes (for CIDR)
  const safePattern = /^[a-zA-Z0-9._:/@-]+$/;
  if (!safePattern.test(input)) {
    throw new Error(`Invalid ${fieldName}: contains unsafe characters. Only alphanumeric, dots, dashes, underscores, colons, slashes, and @ allowed.`);
  }
  return input;
}

/**
 * Sanitize an interface name (stricter than general input).
 */
export function sanitizeInterfaceName(name: string): string {
  const ifacePattern = /^[a-zA-Z0-9._-]+$/;
  if (!ifacePattern.test(name)) {
    throw new Error(`Invalid interface name: "${name}". Only alphanumeric, dots, dashes, and underscores allowed.`);
  }
  if (name.length > 15) {
    throw new Error(`Interface name too long: "${name}" (max 15 characters).`);
  }
  return name;
}

/**
 * Validate an IPv4 address.
 */
export function validateIPv4(ip: string): void {
  const parts = ip.split('.');
  if (parts.length !== 4) {
    throw new Error(`Invalid IPv4 address: "${ip}". Must have 4 octets.`);
  }
  for (const part of parts) {
    const num = parseInt(part, 10);
    if (isNaN(num) || num < 0 || num > 255 || part !== String(num)) {
      throw new Error(`Invalid IPv4 octet: "${part}".`);
    }
  }
}

/**
 * Validate a VLAN ID (1-4094).
 */
export function validateVlanId(vlanId: number): void {
  if (!Number.isInteger(vlanId) || vlanId < 1 || vlanId > 4094) {
    throw new Error(`Invalid VLAN ID: ${vlanId}. Must be between 1 and 4094.`);
  }
}

/**
 * Validate MTU value (576-9000).
 */
export function validateMtu(mtu: number): void {
  if (!Number.isInteger(mtu) || mtu < 576 || mtu > 9000) {
    throw new Error(`Invalid MTU: ${mtu}. Must be between 576 and 9000.`);
  }
}

/**
 * Validate a netmask (e.g., "255.255.255.0").
 */
export function validateNetmask(netmask: string): void {
  const validMasks = [
    '0.0.0.0', '128.0.0.0', '192.0.0.0', '224.0.0.0', '240.0.0.0', '248.0.0.0',
    '252.0.0.0', '254.0.0.0', '255.0.0.0', '255.128.0.0', '255.192.0.0',
    '255.224.0.0', '255.240.0.0', '255.248.0.0', '255.252.0.0', '255.254.0.0',
    '255.255.0.0', '255.255.128.0', '255.255.192.0', '255.255.224.0',
    '255.255.240.0', '255.255.248.0', '255.255.252.0', '255.255.254.0',
    '255.255.255.0', '255.255.255.128', '255.255.255.192', '255.255.255.224',
    '255.255.255.240', '255.255.255.248', '255.255.255.252', '255.255.255.254',
    '255.255.255.255',
  ];
  if (!validMasks.includes(netmask)) {
    throw new Error(`Invalid netmask: "${netmask}".`);
  }
}

/**
 * Validate a valid bond mode.
 */
export function validateBondMode(mode: string): void {
  const validModes = ['active-backup', 'balance-rr', 'balance-xor', '802.3ad', 'balance-tlb', 'balance-alb'];
  if (!validModes.includes(mode)) {
    throw new Error(`Invalid bond mode: "${mode}". Valid modes: ${validModes.join(', ')}`);
  }
}

/**
 * Validate a valid interface role.
 */
export function validateRole(role: string): void {
  const validRoles = ['wan', 'lan', 'dmz', 'management', 'wifi', 'guest', 'iot', 'unused'];
  if (!validRoles.includes(role)) {
    throw new Error(`Invalid role: "${role}". Valid roles: ${validRoles.join(', ')}`);
  }
}

/**
 * Validate a valid multi-WAN mode.
 */
export function validateMultiWanMode(mode: string): void {
  const validModes = ['weighted', 'failover', 'round-robin', 'ECMP'];
  if (!validModes.includes(mode)) {
    throw new Error(`Invalid multi-WAN mode: "${mode}". Valid modes: ${validModes.join(', ')}`);
  }
}

/**
 * Convert a netmask to CIDR prefix length.
 */
export function netmaskToCidr(netmask: string): number {
  const parts = netmask.split('.').map(Number);
  let cidr = 0;
  for (const part of parts) {
    cidr += (part >>> 0).toString(2).split('1').length - 1;
  }
  return cidr;
}

/**
 * Execute a network shell script and return a typed result.
 *
 * @param scriptName - Name of the script (e.g., "vlan.sh")
 * @param args - Arguments to pass to the script
 * @param options - Execution options
 * @returns Parsed JSON result from the script
 */
export function executeScript<T = Record<string, unknown>>(
  scriptName: string,
  args: string[] = [],
  options: ExecutorOptions = {},
): ScriptResult<T> {
  const {
    timeout = DEFAULT_TIMEOUT,
    throwOnError = false,
    ...execOptions
  } = options;

  const scriptPath = path.join(SCRIPTS_DIR, scriptName);

  // Build the command with proper argument quoting
  const quotedArgs = args.map(arg => {
    // Wrap in single quotes and escape any embedded single quotes
    const escaped = arg.replace(/'/g, "'\\''");
    return `'${escaped}'`;
  });
  const command = `${scriptPath} ${quotedArgs.join(' ')}`;

  try {
    const stdout = execSync(command, {
      timeout,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      ...execOptions,
    });

    // Parse the JSON output from the script
    const output = stdout.trim();
    if (!output) {
      return {
        success: false,
        error: 'Script produced no output',
        timestamp: new Date().toISOString(),
      } as ScriptResult<T>;
    }

    try {
      const result: ScriptResult<T> = JSON.parse(output);
      return result;
    } catch {
      // Script didn't return valid JSON, return raw output as data
      return {
        success: true,
        data: { raw: output } as unknown as T,
        timestamp: new Date().toISOString(),
      };
    }
  } catch (error: unknown) {
    const err = error as Error & { stdout?: string; stderr?: string; status?: number };
    const errorMsg = err.stderr?.trim() || err.stdout?.trim() || err.message || 'Unknown error';

    // Try to parse error as JSON (scripts output JSON even on errors)
    try {
      const parsed = JSON.parse(errorMsg);
      if (parsed.success === false) {
        return parsed as ScriptResult<T>;
      }
    } catch {
      // Not JSON, continue with error message
    }

    const result: ScriptResult<T> = {
      success: false,
      error: `Script "${scriptName}" failed (exit ${err.status || 'unknown'}): ${errorMsg}`,
      timestamp: new Date().toISOString(),
    };

    if (throwOnError) {
      throw new Error(result.error);
    }

    return result;
  }
}

/**
 * Convenience: build a script command string without executing.
 * Useful for logging/debugging.
 */
export function buildScriptCommand(scriptName: string, args: string[] = []): string {
  const scriptPath = path.join(SCRIPTS_DIR, scriptName);
  const quotedArgs = args.map(arg => {
    const escaped = arg.replace(/'/g, "'\\''");
    return `'${escaped}'`;
  });
  return `${scriptPath} ${quotedArgs.join(' ')}`;
}

const executor = {
  executeScript,
  sanitizeInput,
  sanitizeInterfaceName,
  validateIPv4,
  validateVlanId,
  validateMtu,
  validateNetmask,
  validateBondMode,
  validateRole,
  validateMultiWanMode,
  netmaskToCidr,
  buildScriptCommand,
};

export default executor;
