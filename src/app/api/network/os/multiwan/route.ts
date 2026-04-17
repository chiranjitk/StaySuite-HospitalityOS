import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { db } from '@/lib/db';

/**
 * POST   /api/network/os/multiwan — Apply multi-WAN configuration to OS
 * GET    /api/network/os/multiwan — Get current multi-WAN status
 * DELETE /api/network/os/multiwan — Reset all multi-WAN config
 *
 * Uses ip route/rule and nftables on Debian 13 to set up multi-WAN:
 *   - Creates routing tables (100-250) per WAN interface
 *   - Adds default routes per table
 *   - Adds ip rules with source-based routing
 *   - Sets up nftables masquerade per WAN
 *   - Supports ECMP for weighted and round-robin modes
 *   - Supports failover mode with monitoring script
 *
 * Persists to MultiWanConfig + MultiWanMember in DB.
 */

function safeExec(cmd: string, timeout = 10000): string {
  try { return execSync(cmd, { encoding: 'utf-8', timeout }); } catch (e: any) { return e.stdout || ''; }
}

const TENANT_ID = 'tenant-1';
const PROPERTY_ID = 'property-1';

const VALID_NAME = /^[a-zA-Z0-9._-]+$/;

function isValidIPv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every(p => { const n = parseInt(p, 10); return !isNaN(n) && n >= 0 && n <= 255 && String(n) === p; });
}

const VALID_MODES = ['weighted', 'failover', 'round-robin'];

/** Table numbers assigned to WAN interfaces (starting from 101) */
const TABLE_BASE = 101;
const NFTABLES_CHAIN = 'staysuite_multiwan';

/**
 * Flush all StaySuite multi-WAN custom routing tables.
 */
function flushCustomTables(wanNames: string[]): void {
  for (let i = 0; i < wanNames.length; i++) {
    const tableNum = TABLE_BASE + i;
    safeExec(`sudo ip route flush table ${tableNum} 2>&1`);
  }
}

/**
 * Remove all StaySuite multi-WAN ip rules.
 */
function removeCustomRules(): void {
  const ruleOutput = safeExec('ip rule show 2>/dev/null');
  for (const line of ruleOutput.trim().split('\n').filter(Boolean)) {
    // Match rules that use tables in our range (101-150)
    const match = line.match(/lookup\s+(\d+)/);
    if (match) {
      const tableNum = parseInt(match[1], 10);
      if (tableNum >= TABLE_BASE && tableNum <= TABLE_BASE + 50) {
        // Parse the rule to reconstruct the delete command
        const fromMatch = line.match(/from\s+(\S+)/);
        const toMatch = line.match(/to\s+(\S+)/);
        const fwmarkMatch = line.match(/fwmark\s+(\S+)/);
        const prioMatch = line.match(/(\d+):\s/);

        let delCmd = 'sudo ip rule del';
        if (prioMatch) delCmd += ` pref ${prioMatch[1]}`;
        if (fromMatch) delCmd += ` from ${fromMatch[1]}`;
        if (toMatch) delCmd += ` to ${toMatch[1]}`;
        if (fwmarkMatch) delCmd += ` fwmark ${fwmarkMatch[1]}`;
        delCmd += ` table ${tableNum}`;
        safeExec(`${delCmd} 2>&1`);
      }
    }
  }
}

/**
 * Remove StaySuite multi-WAN nftables chains.
 */
function removeNftablesChains(): void {
  safeExec(`sudo nft flush chain inet filter ${NFTABLES_CHAIN} 2>&1`);
  safeExec(`sudo nft delete chain inet filter ${NFTABLES_CHAIN} 2>&1`);
  safeExec(`sudo nft flush chain inet nat ${NFTABLES_CHAIN}_nat 2>&1`);
  safeExec(`sudo nft delete chain inet nat ${NFTABLES_CHAIN}_nat 2>&1`);
}

/**
 * Remove any existing ECMP default route added by StaySuite.
 */
function removeEcmpRoutes(): void {
  // We identify ECMP routes by their nexthop count; flush main default first
  safeExec('sudo ip route del default 2>&1');
}

// ──────────────────────────────────────────────────────────
// GET /api/network/os/multiwan — Get current multi-WAN status
// ──────────────────────────────────────────────────────────
export async function GET() {
  try {
    const results: Record<string, any> = {};

    // 1. Get custom routing tables
    const routeOutput = safeExec('ip route show table all 2>/dev/null');
    const customTables: { tableNum: number; routes: string[] }[] = [];
    for (const line of routeOutput.trim().split('\n').filter(Boolean)) {
      const tableMatch = line.match(/table\s+(\d+)/);
      if (tableMatch) {
        const tableNum = parseInt(tableMatch[1], 10);
        if (tableNum >= TABLE_BASE && tableNum <= TABLE_BASE + 50) {
          let existing = customTables.find(t => t.tableNum === tableNum);
          if (!existing) {
            existing = { tableNum, routes: [] };
            customTables.push(existing);
          }
          existing.routes.push(line.trim());
        }
      }
    }
    results.customRoutingTables = customTables;

    // 2. Get custom ip rules
    const ruleOutput = safeExec('ip rule show 2>/dev/null');
    const customRules = ruleOutput.trim().split('\n').filter(line => {
      const match = line.match(/lookup\s+(\d+)/);
      if (match) {
        const tableNum = parseInt(match[1], 10);
        return tableNum >= TABLE_BASE && tableNum <= TABLE_BASE + 50;
      }
      return false;
    });
    results.customRules = customRules;

    // 3. Get nftables chains for multi-WAN
    const nftOutput = safeExec('sudo nft list chains 2>/dev/null');
    const hasMultiWanChain = nftOutput.includes(NFTABLES_CHAIN);
    results.nftablesChain = { exists: hasMultiWanChain, chain: NFTABLES_CHAIN };

    // 4. Check main routing table for ECMP default route
    const mainRouteOutput = safeExec('ip route show default 2>/dev/null');
    const defaultRoutes = mainRouteOutput.trim().split('\n').filter(Boolean);
    const ecmpRoutes = defaultRoutes.filter(l => l.includes('nexthop'));
    results.ecmpDefaultRoute = ecmpRoutes.length > 0 ? ecmpRoutes : null;

    // 5. Get DB config
    try {
      const config = await db.multiWanConfig.findUnique({
        where: { propertyId: PROPERTY_ID },
        include: { members: true },
      });
      results.dbConfig = config;
    } catch (dbErr: any) {
      console.warn('[Network OS API] DB fetch failed for multi-WAN config:', dbErr);
      results.dbConfig = null;
    }

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('[Network OS API] Multi-WAN status error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'OS_ERROR', message: 'Failed to get multi-WAN status' } },
      { status: 500 }
    );
  }
}

// ──────────────────────────────────────────────────────────
// POST /api/network/os/multiwan — Apply multi-WAN config
// ──────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      enabled,
      mode,
      wanMembers,
      healthCheckUrl,
      healthCheckInterval,
      failoverThreshold,
    } = body;

    // ── Validation ──
    if (enabled === false) {
      // If explicitly disabling, reset everything
      return resetMultiWan();
    }

    const wanMode = mode || 'weighted';
    if (!VALID_MODES.includes(wanMode)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_MODE', message: `Mode must be one of: ${VALID_MODES.join(', ')}` } },
        { status: 400 }
      );
    }

    if (!Array.isArray(wanMembers) || wanMembers.length < 2) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'At least 2 WAN members are required' } },
        { status: 400 }
      );
    }

    const validMembers: Array<{
      interfaceName: string;
      gateway: string;
      weight: number;
      enabled: boolean;
      isPrimary: boolean;
    }> = [];

    for (const member of wanMembers) {
      if (!member.interfaceName || !VALID_NAME.test(member.interfaceName)) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_INTERFACE', message: `Invalid interface name: ${member.interfaceName}` } },
          { status: 400 }
        );
      }
      if (!member.gateway || !isValidIPv4(member.gateway)) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_GATEWAY', message: `Invalid gateway for ${member.interfaceName}` } },
          { status: 400 }
        );
      }

      validMembers.push({
        interfaceName: member.interfaceName,
        gateway: member.gateway,
        weight: member.weight ? parseInt(String(member.weight), 10) : 1,
        enabled: member.enabled !== false,
        isPrimary: !!member.isPrimary,
      });
    }

    const hcUrl = healthCheckUrl || 'https://1.1.1.1';
    const hcInterval = healthCheckInterval ? parseInt(String(healthCheckInterval), 10) : 10;
    const foThreshold = failoverThreshold ? parseInt(String(failoverThreshold), 10) : 3;

    const results: { step: string; success: boolean; message: string }[] = [];

    // ── Step 0: Clean up any existing multi-WAN config ──
    removeCustomRules();
    flushCustomTables(validMembers.map(m => m.interfaceName));
    removeEcmpRoutes();
    removeNftablesChains();
    results.push({ step: 'cleanup', success: true, message: 'Existing multi-WAN config cleaned' });

    // ── Step 1: Create per-WAN routing tables and rules ──
    const enabledMembers = validMembers.filter(m => m.enabled);

    if (wanMode === 'failover') {
      // Failover: only primary active, configure backup routes in separate tables
      const primary = enabledMembers.find(m => m.isPrimary) || enabledMembers[0];
      const backups = enabledMembers.filter(m => m.interfaceName !== primary.interfaceName);

      // Add primary as default in main table
      safeExec(`sudo ip route add default via ${primary.gateway} dev ${primary.interfaceName} metric 100 2>&1`);
      results.push({ step: 'primary-route', success: true, message: `Primary default route via ${primary.gateway} on ${primary.interfaceName}` });

      // Configure backup routes in separate tables
      for (let i = 0; i < backups.length; i++) {
        const tableNum = TABLE_BASE + i + 1;
        const member = backups[i];

        safeExec(`sudo ip route add default via ${member.gateway} dev ${member.interfaceName} table ${tableNum} 2>&1`);
        safeExec(`sudo ip route add ${member.gateway}/32 dev ${member.interfaceName} table ${tableNum} 2>&1`);
        results.push({ step: `backup-table-${tableNum}`, success: true, message: `Backup route table ${tableNum} for ${member.interfaceName}` });
      }

      // Deploy monitoring script (writes a shell script to /etc/network/staysuite-wan-monitor.sh)
      const monitorScript = buildMonitorScript(enabledMembers, hcUrl, hcInterval, foThreshold);
      safeExec(`sudo mkdir -p /etc/network 2>&1`);
      try {
        fs.writeFileSync('/etc/network/staysuite-wan-monitor.sh', monitorScript, { mode: 0o755 });
        results.push({ step: 'monitor-script', success: true, message: 'Failover monitoring script deployed' });
      } catch {
        results.push({ step: 'monitor-script', success: false, message: 'Could not write monitor script' });
      }

    } else {
      // Weighted or Round-robin — use ECMP or per-table routing
      if (wanMode === 'weighted' || wanMode === 'round-robin') {
        const weights = enabledMembers.map(m => wanMode === 'round-robin' ? 1 : m.weight);

        // Build ECMP route command
        const nexthops = enabledMembers.map((m, i) =>
          `nexthop via ${m.gateway} dev ${m.interfaceName} weight ${weights[i]}`
        ).join(' ');

        const ecmpCmd = `sudo ip route add default ${nexthops} 2>&1`;
        const ecmpOutput = safeExec(ecmpCmd);
        results.push({ step: 'ecmp-route', success: !ecmpOutput.includes('Error'), message: ecmpOutput.trim() || 'ECMP default route configured' });

        // Also set up per-table routes for source-based routing
        for (let i = 0; i < enabledMembers.length; i++) {
          const tableNum = TABLE_BASE + i;
          const member = enabledMembers[i];

          safeExec(`sudo ip route add default via ${member.gateway} dev ${member.interfaceName} table ${tableNum} 2>&1`);
          safeExec(`sudo ip route add ${member.gateway}/32 dev ${member.interfaceName} table ${tableNum} 2>&1`);

          // Add rule: traffic from this interface's subnet goes to its table
          // We use the interface IP as source identifier
          const ifaceIp = safeExec(`ip -o -4 addr show dev ${member.interfaceName} 2>/dev/null`);
          const ipMatch = ifaceIp.match(/inet\s+(\d+\.\d+\.\d+\.\d+)\//);
          if (ipMatch) {
            const srcIp = ipMatch[1];
            safeExec(`sudo ip rule add from ${srcIp} lookup ${tableNum} priority ${100 + i} 2>&1`);
          }

          results.push({ step: `table-${tableNum}`, success: true, message: `Table ${tableNum} for ${member.interfaceName}` });
        }
      }
    }

    // ── Step 2: Set up nftables masquerade per WAN ──
    safeExec(`sudo nft add table inet filter 2>&1`);
    safeExec(`sudo nft add chain inet filter ${NFTABLES_CHAIN} 2>&1`);

    safeExec(`sudo nft add table inet nat 2>&1`);
    safeExec(`sudo nft add chain inet nat ${NFTABLES_CHAIN}_nat 2>&1`);

    for (const member of enabledMembers) {
      safeExec(`sudo nft add rule inet nat ${NFTABLES_CHAIN}_nat outdev ${member.interfaceName} masquerade 2>&1`);
    }
    results.push({ step: 'nftables', success: true, message: `nftables masquerade rules set up for ${enabledMembers.length} WAN interfaces` });

    // ── Step 3: Persist to DB (MultiWanConfig + MultiWanMember) ──
    try {
      const upsertData: Record<string, any> = {
        enabled: true,
        mode: wanMode,
        healthCheckUrl: hcUrl,
        healthCheckInterval: hcInterval,
        failoverThreshold: foThreshold,
      };

      const config = await db.multiWanConfig.upsert({
        where: { propertyId: PROPERTY_ID },
        create: {
          tenantId: TENANT_ID,
          propertyId: PROPERTY_ID,
          ...upsertData,
        },
        update: upsertData,
      });

      // Delete existing members and recreate
      await db.multiWanMember.deleteMany({
        where: { multiWanConfigId: config.id },
      });

      for (const member of validMembers) {
        // Try to find the NetworkInterface
        let ifaceId: string | null = null;
        try {
          const netIface = await db.networkInterface.findUnique({
            where: { propertyId_name: { propertyId: PROPERTY_ID, name: member.interfaceName } },
          });
          if (netIface) ifaceId = netIface.id;
        } catch {
          // Non-fatal
        }

        await db.multiWanMember.create({
          data: {
            multiWanConfigId: config.id,
            interfaceName: member.interfaceName,
            interfaceId: ifaceId,
            gateway: member.gateway,
            weight: member.weight,
            enabled: member.enabled,
            isPrimary: member.isPrimary,
          },
        });
      }

      results.push({ step: 'database', success: true, message: 'Multi-WAN config saved to database' });
    } catch (dbErr: any) {
      console.warn('[Network OS API] DB upsert failed for multi-WAN:', dbErr);
      results.push({ step: 'database', success: false, message: dbErr.message });
    }

    return NextResponse.json({
      success: true,
      message: `Multi-WAN configuration applied (mode: ${wanMode})`,
      results,
      data: {
        enabled: true,
        mode: wanMode,
        wanMembers: validMembers,
      },
    });
  } catch (error) {
    console.error('[Network OS API] Multi-WAN apply error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'OS_ERROR', message: 'Failed to apply multi-WAN configuration' } },
      { status: 500 }
    );
  }
}

// ──────────────────────────────────────────────────────────
// DELETE /api/network/os/multiwan — Reset multi-WAN config
// ──────────────────────────────────────────────────────────
export async function DELETE() {
  return resetMultiWan();
}

/**
 * Internal: Reset all multi-WAN state (OS + DB).
 */
async function resetMultiWan(): Promise<NextResponse> {
  const results: { step: string; success: boolean; message: string }[] = [];

  // 1. Remove custom ip rules
  try {
    removeCustomRules();
    results.push({ step: 'remove-rules', success: true, message: 'Custom ip rules removed' });
  } catch (e: any) {
    results.push({ step: 'remove-rules', success: false, message: String(e) });
  }

  // 2. Flush custom routing tables — get all table numbers we might have used
  try {
    const ruleOutput = safeExec('ip rule show 2>/dev/null');
    const tableNums = new Set<number>();
    for (const line of ruleOutput.trim().split('\n').filter(Boolean)) {
      const match = line.match(/lookup\s+(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num >= TABLE_BASE && num <= TABLE_BASE + 50) tableNums.add(num);
      }
    }
    for (const num of tableNums) {
      safeExec(`sudo ip route flush table ${num} 2>&1`);
    }
    results.push({ step: 'flush-tables', success: true, message: `Flushed ${tableNums.size} custom routing tables` });
  } catch (e: any) {
    results.push({ step: 'flush-tables', success: false, message: String(e) });
  }

  // 3. Remove ECMP default route
  try {
    removeEcmpRoutes();
    results.push({ step: 'ecmp-cleanup', success: true, message: 'ECMP routes removed' });
  } catch (e: any) {
    results.push({ step: 'ecmp-cleanup', success: false, message: String(e) });
  }

  // 4. Remove nftables chains
  try {
    removeNftablesChains();
    results.push({ step: 'nftables-cleanup', success: true, message: 'nftables chains removed' });
  } catch (e: any) {
    results.push({ step: 'nftables-cleanup', success: false, message: String(e) });
  }

  // 5. Clean up monitor script
  try {
    safeExec('sudo rm -f /etc/network/staysuite-wan-monitor.sh 2>&1');
    results.push({ step: 'monitor-cleanup', success: true, message: 'Monitor script removed' });
  } catch (e: any) {
    results.push({ step: 'monitor-cleanup', success: false, message: String(e) });
  }

  // 6. Update DB
  try {
    const config = await db.multiWanConfig.findUnique({
      where: { propertyId: PROPERTY_ID },
    });
    if (config) {
      await db.multiWanMember.deleteMany({
        where: { multiWanConfigId: config.id },
      });
      await db.multiWanConfig.update({
        where: { id: config.id },
        data: { enabled: false },
      });
    }
    results.push({ step: 'database', success: true, message: 'Multi-WAN config disabled in database' });
  } catch (dbErr: any) {
    console.warn('[Network OS API] DB update failed for multi-WAN reset:', dbErr);
    results.push({ step: 'database', success: false, message: dbErr.message });
  }

  return NextResponse.json({
    success: true,
    message: 'Multi-WAN configuration reset',
    results,
  });
}

/**
 * Build a monitoring shell script for failover mode.
 * The script pings each WAN gateway and switches the default route
 * if the primary fails and a backup is available.
 */
function buildMonitorScript(
  members: Array<{ interfaceName: string; gateway: string; isPrimary: boolean }>,
  healthCheckUrl: string,
  interval: number,
  threshold: number,
): string {
  const wanEntries = members.map((m, i) => {
    const tableNum = TABLE_BASE + i + (m.isPrimary ? 0 : 1);
    return `WAN_${i}="${m.interfaceName} ${m.gateway} ${tableNum} ${m.isPrimary ? '1' : '0'}"`;
  }).join('\n');

  return `#!/bin/bash
# StaySuite WAN Failover Monitor — auto-generated
# Health check: ${healthCheckUrl}, interval: ${interval}s, threshold: ${threshold}

INTERVAL=${interval}
THRESHOLD=${threshold}
HEALTH_URL="${healthCheckUrl}"

${wanEntries}

FAIL_COUNTS=()
for i in $(seq 0 $(( $(echo "${wanEntries}" | wc -l) - 1 ))); do
  FAIL_COUNTS[$i]=0
done

switch_to_backup() {
  local table=$1
  sudo ip route replace default table main
  # The backup route is in its own table; we add a higher-priority rule
  sudo ip rule add pref 50 lookup $table 2>/dev/null
  logger -t staysuite-wan "Switched to backup (table $table)"
}

restore_primary() {
  # Remove backup rule and restore primary
  sudo ip rule del pref 50 lookup 2>/dev/null
  logger -t staysuite-wan "Restored primary WAN"
}

while true; do
  i=0
  while IFS=' ' read -r iface gw table is_primary; do
    # Ping the gateway
    if ping -c 1 -W 3 $gw >/dev/null 2>&1; then
      FAIL_COUNTS[$i]=0
    else
      FAIL_COUNTS[$i]=$((FAIL_COUNTS[$i] + 1))
    fi

    if [ "\${FAIL_COUNTS[$i]}" -ge "$THRESHOLD" ]; then
      if [ "$is_primary" = "1" ]; then
        switch_to_backup $table
      fi
    else
      if [ "$is_primary" = "1" ]; then
        restore_primary
      fi
    fi
    i=$((i + 1))
  done <<< "$(printf '%s\\n' ${wanEntries.replace(/"/g, '\\"').split('\n').join(' ')})"

  sleep $INTERVAL
done
`;
}
