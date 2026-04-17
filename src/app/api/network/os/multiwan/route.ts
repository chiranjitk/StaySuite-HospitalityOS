import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  applyWeighted,
  applyFailover,
  applyRoundRobin,
  resetMultiWan,
  deployMonitor,
  MultiWanConfig,
  WanMember,
} from '@/lib/network/multiwan';

/**
 * POST   /api/network/os/multiwan — Apply multi-WAN configuration to OS
 * GET    /api/network/os/multiwan — Get current multi-WAN status from DB
 * DELETE /api/network/os/multiwan — Reset all multi-WAN config
 *
 * Uses shell script wrappers from @/lib/network/multiwan for all OS-level
 * operations (routing tables, ip rules, nftables, ECMP, monitor deployment).
 *
 * Persists to MultiWanConfig + MultiWanMember in DB.
 */

const TENANT_ID = 'tenant-1';
const PROPERTY_ID = 'property-1';

const VALID_NAME = /^[a-zA-Z0-9._-]+$/;

function isValidIPv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every(p => { const n = parseInt(p, 10); return !isNaN(n) && n >= 0 && n <= 255 && String(n) === p; });
}

const VALID_MODES = ['weighted', 'failover', 'round-robin'];

// ──────────────────────────────────────────────────────────
// GET /api/network/os/multiwan — Get current multi-WAN status
// ──────────────────────────────────────────────────────────
export async function GET() {
  try {
    const results: Record<string, any> = {};

    // Return OS state fields as empty/unknown — read operations are handled
    // by the shell scripts and are not exposed via a dedicated list endpoint.
    results.customRoutingTables = [];
    results.customRules = [];
    results.nftablesChain = { exists: false, chain: 'staysuite_multiwan' };
    results.ecmpDefaultRoute = null;

    // Get DB config
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
      return handleReset();
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

    const validMembers: WanMember[] = [];

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

    // ── Step 1: Apply multi-WAN via shell script wrapper ──
    const mwConfig: MultiWanConfig = {
      mode: wanMode,
      healthCheckUrl: hcUrl,
      healthCheckInterval: hcInterval,
      failoverThreshold: foThreshold,
      wanMembers: validMembers,
    };

    let applyResult;
    switch (wanMode) {
      case 'failover':
        applyResult = applyFailover(mwConfig);
        break;
      case 'round-robin':
        applyResult = applyRoundRobin(mwConfig);
        break;
      case 'weighted':
      default:
        applyResult = applyWeighted(mwConfig);
        break;
    }

    results.push({
      step: 'apply-config',
      success: applyResult.success,
      message: applyResult.success
        ? `Multi-WAN ${wanMode} configuration applied`
        : applyResult.error || `Failed to apply ${wanMode} configuration`,
    });

    // ── Step 2: Deploy monitoring script for failover mode ──
    if (wanMode === 'failover' && applyResult.success) {
      const monitorResult = deployMonitor(mwConfig);
      results.push({
        step: 'monitor-deploy',
        success: monitorResult.success,
        message: monitorResult.success
          ? 'Failover monitoring script deployed'
          : monitorResult.error || 'Failed to deploy monitor script',
      });
    }

    // ── Step 3: Persist to DB (only if shell script succeeded) ──
    if (applyResult.success) {
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
              weight: member.weight || 1,
              enabled: member.enabled !== false,
              isPrimary: !!member.isPrimary,
            },
          });
        }

        results.push({ step: 'database', success: true, message: 'Multi-WAN config saved to database' });
      } catch (dbErr: any) {
        console.warn('[Network OS API] DB upsert failed for multi-WAN:', dbErr);
        results.push({ step: 'database', success: false, message: dbErr.message });
      }
    } else {
      results.push({ step: 'database', success: false, message: 'Skipped: shell script apply did not succeed' });
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
  return handleReset();
}

/**
 * Internal: Reset all multi-WAN state (OS via shell script + DB).
 */
async function handleReset(): Promise<NextResponse> {
  const results: { step: string; success: boolean; message: string }[] = [];

  // 1. Reset OS-level multi-WAN via shell script wrapper
  try {
    const resetResult = resetMultiWan();
    results.push({
      step: 'os-reset',
      success: resetResult.success,
      message: resetResult.success
        ? `Multi-WAN reset: ${resetResult.data?.rulesRemoved || 0} rules removed, ${resetResult.data?.tablesFlushed || 0} tables flushed, ${resetResult.data?.nftablesChainsRemoved || 0} chains removed`
        : resetResult.error || 'Failed to reset multi-WAN',
    });
  } catch (e: any) {
    results.push({ step: 'os-reset', success: false, message: String(e) });
  }

  // 2. Update DB
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
