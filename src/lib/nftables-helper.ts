/**
 * nftables Service Integration Helper
 *
 * Provides a "best effort" bridge between the Next.js WiFi firewall API
 * and the nftables mini-service (port 3013).
 *
 * Key principle: nftables application is non-blocking and non-fatal.
 * The DB write must succeed regardless of whether nftables is available.
 * Errors are logged but never propagated to the API consumer.
 */

import { db } from '@/lib/db';

const NFTABLES_SERVICE_URL =
  process.env.NFTABLES_SERVICE_URL || 'http://localhost:3013';

/**
 * Send a request to the nftables service.
 * Returns nothing — fire-and-forget. Errors are logged but never thrown.
 */
export async function applyToNftables(
  path: string,
  method: string,
  body?: Record<string, unknown>
): Promise<void> {
  try {
    const response = await fetch(`${NFTABLES_SERVICE_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(
        `[nftables] apply failed: ${response.status} ${response.statusText}`,
        text
      );
    }
  } catch (error) {
    console.error('[nftables] service unreachable:', error);
    // Non-fatal: DB writes succeed even if nftables is down
  }
}

/**
 * Send a request to the nftables service and return the parsed result.
 * Use this when the caller needs the response (e.g., test endpoint).
 */
export async function applyToNftablesWithResult(
  path: string,
  method: string = 'POST',
  body?: unknown
): Promise<{ success: boolean; error?: string; data?: unknown }> {
  try {
    const response = await fetch(`${NFTABLES_SERVICE_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await response.json().catch(() => null);
    if (!response.ok) {
      const errorMsg = typeof json === 'object' && json !== null && 'error' in json
        ? String((json as Record<string, unknown>).error)
        : await response.text().catch(() => `HTTP ${response.status}`);
      console.error(`[nftables] apply failed: ${response.status}`, errorMsg);
      return { success: false, error: errorMsg };
    }
    return { success: true, data: json };
  } catch (error) {
    console.error('[nftables] service unreachable:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Map DB listType to nftables set name.
 */
export function macListTypeToSet(
  listType: string
): 'mac_whitelist' | 'mac_blacklist' {
  return listType === 'whitelist' ? 'mac_whitelist' : 'mac_blacklist';
}

/**
 * Build a full FirewallConfig from the database for a given tenant.
 * Used by the /api/apply endpoint to regenerate all nftables rules at once.
 */
export async function buildFirewallConfigFromDb(tenantId: string): Promise<{
  zones: Array<{
    name: string;
    inputPolicy: string;
    forwardPolicy: string;
    outputPolicy: string;
    rules: Array<{
      chain: string;
      sourceIp?: string;
      destIp?: string;
      protocol?: string;
      sourcePort?: string;
      destPort?: string;
      action: string;
      comment?: string;
    }>;
  }>;
  macFilters: Array<{ set: string; address: string }>;
  bandwidthLimits: Array<{ ip: string; rate: string; direction: string }>;
  contentFilters: Array<{ domain: string; sinkholeIp: string }>;
}> {
  // Fetch zones with their rules
  const zones = await db.firewallZone.findMany({
    where: { tenantId },
    include: {
      rules: {
        where: { enabled: true },
        orderBy: { priority: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Fetch MAC filters
  const macFilters = await db.macFilter.findMany({
    where: { tenantId, enabled: true },
  });

  // Fetch bandwidth policies
  const bandwidthPolicies = await db.bandwidthPolicy.findMany({
    where: { tenantId, enabled: true },
  });

  // Fetch content filters
  const contentFilters = await db.contentFilter.findMany({
    where: { tenantId, enabled: true },
  });

  // Build config object
  const config = {
    zones: zones.map((zone) => ({
      name: zone.name,
      inputPolicy: zone.inputPolicy,
      forwardPolicy: zone.forwardPolicy,
      outputPolicy: zone.outputPolicy,
      rules: zone.rules.map((rule) => ({
        chain: rule.chain,
        sourceIp: rule.sourceIp ?? undefined,
        destIp: rule.destIp ?? undefined,
        protocol: rule.protocol ?? undefined,
        sourcePort: rule.sourcePort != null ? String(rule.sourcePort) : undefined,
        destPort: rule.destPort != null ? String(rule.destPort) : undefined,
        action: rule.action,
        comment: rule.comment ?? undefined,
      })),
    })),
    macFilters: macFilters.map((mf) => ({
      set: macListTypeToSet(mf.listType),
      address: mf.macAddress,
    })),
    bandwidthLimits: bandwidthPolicies.map((bp) => {
      // Convert Kbps to rate string for nftables
      // e.g., 10240 Kbps = 10 mbit/s
      const downloadRate = formatRate(bp.downloadKbps);
      const uploadRate = formatRate(bp.uploadKbps);
      const limits: Array<{ ip: string; rate: string; direction: string }> = [];
      // Since bandwidth policies may not be IP-specific, we use the policy name as identifier
      // In production, these would be tied to specific IPs/subnets
      if (bp.downloadKbps > 0) {
        limits.push({ ip: bp.name, rate: downloadRate, direction: 'download' });
      }
      if (bp.uploadKbps > 0) {
        limits.push({ ip: bp.name, rate: uploadRate, direction: 'upload' });
      }
      return limits;
    }).flat(),
    contentFilters: contentFilters.flatMap((cf) => {
      let domains: string[] = [];
      try {
        domains = cf.domains ? JSON.parse(cf.domains) : [];
      } catch {
        domains = [];
      }
      return domains.map((domain: string) => ({
        domain,
        sinkholeIp: '0.0.0.0',
      }));
    }),
  };

  return config;
}

/**
 * Format a Kbps value into an nftables rate string.
 * e.g., 10240 Kbps → "10m" (10 mbit/s)
 *       512 Kbps → "512k" (512 kbit/s)
 */
function formatRate(kbps: number): string {
  if (kbps >= 1000000) {
    return `${Math.round(kbps / 1000000)}g`;
  }
  if (kbps >= 1000) {
    return `${Math.round(kbps / 1000)}m`;
  }
  return `${kbps}k`;
}

/**
 * Full apply: build config from DB and send to nftables /api/apply.
 * Used after rule changes that need a full regeneration.
 */
export async function fullApplyToNftables(tenantId: string): Promise<void> {
  try {
    const config = await buildFirewallConfigFromDb(tenantId);
    await applyToNftables('/api/apply', 'POST', config as Record<string, unknown>);
  } catch (error) {
    console.error('[nftables] full apply failed:', error);
    // Non-fatal
  }
}
