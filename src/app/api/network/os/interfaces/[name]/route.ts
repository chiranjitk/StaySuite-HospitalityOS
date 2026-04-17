import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { db } from '@/lib/db';
import {
  setStaticIP,
  setDHCP,
  flushIPs,
  setMTU,
  interfaceUp,
  interfaceDown,
} from '@/lib/network/ip-config';
import { persistIPConfig } from '@/lib/network/persist';

function safeExec(cmd: string, timeout = 10000): string {
  try { return execSync(cmd, { encoding: 'utf-8', timeout }); } catch (e: any) { return e.stderr?.trim() || e.stdout?.trim() || ''; }
}

/**
 * POST /api/network/os/interfaces/[name] - Interface actions:
 *   - mtu: Set MTU
 *   - action: up/down
 *   - ipAddress + netmask + gateway + mode (static/dhcp/disabled): Set IP configuration
 *
 * Tries shell script wrappers first, falls back to inline ip commands.
 */

const TENANT_ID = 'tenant-1';
const PROPERTY_ID = 'property-1';

function tryShellScript(fn: () => { success: boolean; data?: any; error?: string }, fallback: () => { success: boolean; data?: any; error?: string }): { success: boolean; data?: any; error?: string } {
  try {
    const result = fn();
    if (result.success) return result;
    console.warn(`[Network OS API] Script failed: ${result.error}, using inline fallback`);
    return fallback();
  } catch (e: any) {
    console.warn(`[Network OS API] Script error: ${e.message}, using inline fallback`);
    return fallback();
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const body = await request.json();

    // ── MTU ──
    if (body.mtu !== undefined) {
      const mtu = parseInt(body.mtu, 10);
      const result = tryShellScript(
        () => setMTU(name, mtu),
        () => {
          safeExec(`sudo ip link set ${name} mtu ${mtu}`);
          return { success: true, data: { interface: name, state: 'mtu-updated' } };
        }
      );

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: { code: 'MTU_FAILED', message: result.error || 'Failed to set MTU' } },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `MTU for ${name} set to ${mtu}`,
        data: result.data,
      });
    }

    // ── Up ──
    if (body.action === 'up') {
      const result = tryShellScript(
        () => interfaceUp(name),
        () => { safeExec(`sudo ip link set ${name} up`); return { success: true, data: { interface: name, state: 'up' } }; }
      );

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: { code: 'UP_FAILED', message: result.error || 'Failed to bring interface up' } },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Interface ${name} brought up`,
        data: result.data,
      });
    }

    // ── Down ──
    if (body.action === 'down') {
      const result = tryShellScript(
        () => interfaceDown(name),
        () => { safeExec(`sudo ip link set ${name} down`); return { success: true, data: { interface: name, state: 'down' } }; }
      );

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: { code: 'DOWN_FAILED', message: result.error || 'Failed to bring interface down' } },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Interface ${name} brought down`,
        data: result.data,
      });
    }

    // ── Description (metadata-only, saves to DB) ──
    if (body.description !== undefined && body.mode === undefined) {
      try {
        const existing = await db.networkInterface.findUnique({
          where: { propertyId_name: { propertyId: PROPERTY_ID, name } },
        });
        if (existing) {
          await db.networkInterface.update({
            where: { id: existing.id },
            data: { description: body.description },
          });
        } else {
          await db.networkInterface.create({
            data: {
              tenantId: TENANT_ID,
              propertyId: PROPERTY_ID,
              name,
              type: 'ethernet',
              status: 'up',
              description: body.description,
            },
          });
        }
        return NextResponse.json({
          success: true,
          message: `Description updated for ${name}`,
        });
      } catch (dbErr: any) {
        return NextResponse.json({
          success: false,
          error: { code: 'DB_ERROR', message: dbErr.message },
        }, { status: 500 });
      }
    }

    // ── IP Address / Subnet / Gateway Configuration ──
    if (body.mode !== undefined) {
      const mode = body.mode as 'dhcp' | 'static' | 'disabled';
      if (!['dhcp', 'static', 'disabled'].includes(mode)) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_MODE', message: 'Mode must be "dhcp", "static", or "disabled"' } },
          { status: 400 }
        );
      }

      const results: { step: string; success: boolean; message: string }[] = [];

      // 1. Apply at OS level — shell script with inline fallback
      if (mode === 'static' && body.ipAddress) {
        const netmask = body.netmask || '255.255.255.0';
        // Convert netmask to CIDR
        const maskParts = netmask.split('.').map(Number);
        let cidr = 0;
        for (const p of maskParts) cidr += (p >>> 0).toString(2).split('1').length - 1;

        const osResult = tryShellScript(
          () => setStaticIP({
            interface: name,
            ipAddress: body.ipAddress,
            netmask,
            gateway: body.gateway,
            dnsPrimary: body.dnsPrimary,
            dnsSecondary: body.dnsSecondary,
          }),
          () => {
            // Inline fallback: flush, add addr, add gateway
            safeExec(`sudo ip addr flush dev ${name} 2>/dev/null`);
            const addrOutput = safeExec(`sudo ip addr add ${body.ipAddress}/${cidr} dev ${name} 2>&1`);
            if (addrOutput.includes('File exists')) {
              return { success: false, error: `IP ${body.ipAddress} already assigned to ${name}` };
            }
            if (body.gateway) {
              safeExec(`sudo ip route add default via ${body.gateway} dev ${name} 2>/dev/null`);
            }
            return { success: true, data: { interface: name, mode: 'static', ipAddress: body.ipAddress, cidr } };
          }
        );

        if (!osResult.success) {
          return NextResponse.json(
            { success: false, error: { code: 'STATIC_IP_FAILED', message: osResult.error || 'Failed to set static IP' } },
            { status: 500 }
          );
        }
        results.push({ step: 'set-static', success: true, message: 'Static IP applied' });
      } else if (mode === 'dhcp') {
        const osResult = tryShellScript(
          () => setDHCP(name),
          () => {
            safeExec(`sudo ip addr flush dev ${name} 2>/dev/null`);
            safeExec(`sudo dhclient -1 ${name} 2>/dev/null || sudo systemctl restart networking 2>/dev/null`);
            return { success: true, data: { interface: name, mode: 'dhcp' } };
          }
        );

        if (!osResult.success) {
          return NextResponse.json(
            { success: false, error: { code: 'DHCP_FAILED', message: osResult.error || 'Failed to enable DHCP' } },
            { status: 500 }
          );
        }
        results.push({ step: 'dhcp', success: true, message: 'DHCP enabled' });
      } else if (mode === 'disabled') {
        const osResult = tryShellScript(
          () => flushIPs(name),
          () => {
            safeExec(`sudo ip addr flush dev ${name} 2>/dev/null`);
            safeExec(`sudo ip link set ${name} down 2>/dev/null`);
            return { success: true, data: { interface: name, mode: 'disabled' } };
          }
        );

        if (!osResult.success) {
          return NextResponse.json(
            { success: false, error: { code: 'FLUSH_FAILED', message: osResult.error || 'Failed to flush IPs' } },
            { status: 500 }
          );
        }
        results.push({ step: 'flush', success: true, message: 'IPs flushed' });
      }

      // 2. Persist to /etc/network/interfaces via shell script (non-blocking)
      try {
        const persistResult = persistIPConfig({
          interface: name,
          mode,
          ipAddress: body.ipAddress,
          netmask: body.netmask,
          gateway: body.gateway,
          dnsPrimary: body.dnsPrimary,
          dnsSecondary: body.dnsSecondary,
        });
        if (!persistResult.success) {
          console.warn(`[Network OS API] File persist failed for ${name}: ${persistResult.error} — continuing with DB only`);
        }
        results.push({
          step: 'file-persist',
          success: persistResult.success,
          message: persistResult.success ? 'Config persisted to interfaces file' : (persistResult.error || 'File persist failed'),
        });
      } catch (e) {
        console.warn(`[Network OS API] File persist error for ${name}:`, e);
        results.push({ step: 'file-persist', success: false, message: 'File persist skipped (script not available)' });
      }

      // 3. Store in database (InterfaceConfig)
      try {
        let dbIface = await db.networkInterface.findUnique({
          where: { propertyId_name: { propertyId: PROPERTY_ID, name } },
        });
        if (!dbIface) {
          dbIface = await db.networkInterface.create({
            data: {
              tenantId: TENANT_ID,
              propertyId: PROPERTY_ID,
              name,
              type: 'ethernet',
              status: 'up',
            },
          });
        }

        await db.interfaceConfig.upsert({
          where: {
            propertyId_interfaceId: {
              propertyId: PROPERTY_ID,
              interfaceId: dbIface.id,
            },
          },
          create: {
            tenantId: TENANT_ID,
            propertyId: PROPERTY_ID,
            interfaceId: dbIface.id,
            mode,
            ipAddress: body.ipAddress || null,
            netmask: body.netmask || null,
            gateway: body.gateway || null,
            dnsPrimary: body.dnsPrimary || null,
            dnsSecondary: body.dnsSecondary || null,
          },
          update: {
            mode,
            ipAddress: body.ipAddress || null,
            netmask: body.netmask || null,
            gateway: body.gateway || null,
            dnsPrimary: body.dnsPrimary || null,
            dnsSecondary: body.dnsSecondary || null,
          },
        });
        results.push({ step: 'database', success: true, message: 'Config saved to database' });
      } catch (dbErr: any) {
        console.warn(`[Network OS API] DB upsert failed for ${name}:`, dbErr);
        results.push({ step: 'database', success: false, message: dbErr.message });
      }

      return NextResponse.json({
        success: true,
        message: `IP configuration updated for ${name} (mode: ${mode})`,
        results,
      });
    }

    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ACTION', message: 'Specify mtu, action=up/down, or mode+ipAddress for IP config' } },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Network OS API] Interface action error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'OS_ERROR', message: 'Failed to modify interface' } },
      { status: 500 }
    );
  }
}
