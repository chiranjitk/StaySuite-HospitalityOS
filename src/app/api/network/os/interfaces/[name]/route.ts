import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { db } from '@/lib/db';
import {
  scanConnections,
  setStaticIP,
  setDHCP,
  disableInterface,
  setMtu,
  interfaceUp,
  interfaceDown,
  withStaySuitePreserved,
  NmConnectionInfo,
} from '@/lib/network/nmcli';

function safeExec(cmd: string, timeout = 10000): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout });
  } catch (e: any) {
    return e.stderr?.trim() || e.stdout?.trim() || '';
  }
}

/**
 * Inline fallback that preserves [staysuite] around nmcli con mod commands.
 * Used when the main nmcli.ts functions fail.
 */
function inlineNmcliModWithPreserve(name: string, fn: () => void): void {
  withStaySuitePreserved(name, fn);
}

const TENANT_ID = 'tenant-1';
const PROPERTY_ID = 'property-1';
const VALID_NAME = /^[a-zA-Z0-9._-]+$/;

function tryNmcli(fn: () => void, fallback: () => { success: boolean; data?: any; error?: string }): { success: boolean; data?: any; error?: string } {
  try {
    fn();
    return { success: true };
  } catch (e: any) {
    console.warn(`[Network OS API] nmcli failed: ${e.message}, using inline fallback`);
    return fallback();
  }
}

/**
 * GET  /api/network/os/interfaces/[name] - Read single interface details from nmcli
 * POST /api/network/os/interfaces/[name] - Update interface (IP config, MTU, up/down, description)
 * DELETE /api/network/os/interfaces/[name] - Delete virtual interface ONLY (reject for physical)
 *
 * Uses nmcli wrapper for Rocky Linux 10 NetworkManager.
 * Falls back to inline ip/nmcli commands on failure.
 */

// ────────────────────────────────────────────────────────────
// GET — Read single interface details
// ────────────────────────────────────────────────────────────
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;

    if (!VALID_NAME.test(name)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_NAME', message: 'Invalid interface name' } },
        { status: 400 }
      );
    }

    // 1. Scan all connections from nmcli
    const connections = scanConnections();
    const iface = connections.find(
      c => c.name === name || c.deviceName === name
    );

    if (!iface) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `Interface "${name}" not found` } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: iface,
    });
  } catch (error) {
    console.error('[Network OS API] Interface GET error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'OS_ERROR', message: 'Failed to read interface details' } },
      { status: 500 }
    );
  }
}

// ────────────────────────────────────────────────────────────
// POST — Update interface (IP config, MTU, up/down, description)
// ────────────────────────────────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const body = await request.json();

    if (!VALID_NAME.test(name)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_NAME', message: 'Invalid interface name' } },
        { status: 400 }
      );
    }

    // ── MTU ──
    if (body.mtu !== undefined) {
      const mtu = parseInt(body.mtu, 10);
      const result = tryNmcli(
        () => setMtu(name, mtu),
        () => {
          inlineNmcliModWithPreserve(name, () => {
            safeExec(`sudo nmcli con mod ${name} 802-3-ethernet.mtu ${mtu}`);
            safeExec(`sudo nmcli con up ${name}`);
          });
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
      const result = tryNmcli(
        () => interfaceUp(name),
        () => {
          safeExec(`sudo nmcli con up ${name}`);
          return { success: true, data: { interface: name, state: 'up' } };
        }
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
      const result = tryNmcli(
        () => interfaceDown(name),
        () => {
          safeExec(`sudo nmcli con down ${name}`);
          return { success: true, data: { interface: name, state: 'down' } };
        }
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

      // 1. Apply at OS level via nmcli wrapper
      if (mode === 'static' && body.ipAddress) {
        const netmask = body.netmask || '255.255.255.0';
        const dns = [];
        if (body.dnsPrimary) dns.push(body.dnsPrimary);
        if (body.dnsSecondary) dns.push(body.dnsSecondary);

        const osResult = tryNmcli(
          () => setStaticIP(name, body.ipAddress, netmask, body.gateway, dns.length > 0 ? dns : undefined),
          () => {
            // Inline fallback: use nmcli directly
            const maskParts = netmask.split('.').map(Number);
            let cidr = 0;
            for (const p of maskParts) cidr += (p >>> 0).toString(2).split('1').length - 1;

            let cmd = `sudo nmcli con mod ${name} ipv4.method manual ipv4.addresses ${body.ipAddress}/${cidr}`;
            if (body.gateway) cmd += ` ipv4.gateway ${body.gateway}`;
            if (dns.length > 0) cmd += ` ipv4.dns ${dns.join(',')}`;
            inlineNmcliModWithPreserve(name, () => {
              safeExec(cmd);
              safeExec(`sudo nmcli con up ${name}`);
            });
            return { success: true, data: { interface: name, mode: 'static', ipAddress: body.ipAddress, cidr } };
          }
        );

        if (!osResult.success) {
          return NextResponse.json(
            { success: false, error: { code: 'STATIC_IP_FAILED', message: osResult.error || 'Failed to set static IP' } },
            { status: 500 }
          );
        }
        results.push({ step: 'set-static', success: true, message: 'Static IP applied via nmcli' });
      } else if (mode === 'dhcp') {
        const osResult = tryNmcli(
          () => setDHCP(name),
          () => {
            inlineNmcliModWithPreserve(name, () => {
              safeExec(`sudo nmcli con mod ${name} ipv4.method auto`);
              safeExec(`sudo nmcli con up ${name}`);
            });
            return { success: true, data: { interface: name, mode: 'dhcp' } };
          }
        );

        if (!osResult.success) {
          return NextResponse.json(
            { success: false, error: { code: 'DHCP_FAILED', message: osResult.error || 'Failed to enable DHCP' } },
            { status: 500 }
          );
        }
        results.push({ step: 'dhcp', success: true, message: 'DHCP enabled via nmcli' });
      } else if (mode === 'disabled') {
        const osResult = tryNmcli(
          () => disableInterface(name),
          () => {
            inlineNmcliModWithPreserve(name, () => {
              safeExec(`sudo nmcli con mod ${name} ipv4.method disabled`);
              safeExec(`sudo nmcli con down ${name}`);
            });
            return { success: true, data: { interface: name, mode: 'disabled' } };
          }
        );

        if (!osResult.success) {
          return NextResponse.json(
            { success: false, error: { code: 'FLUSH_FAILED', message: osResult.error || 'Failed to disable interface' } },
            { status: 500 }
          );
        }
        results.push({ step: 'disable', success: true, message: 'Interface disabled via nmcli' });
      }

      // 2. Store in database (InterfaceConfig)
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

// ────────────────────────────────────────────────────────────
// DELETE — Delete virtual interface ONLY (reject for physical)
// ────────────────────────────────────────────────────────────
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;

    if (!VALID_NAME.test(name)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_NAME', message: 'Invalid interface name' } },
        { status: 400 }
      );
    }

    // Check if interface is physical — physical interfaces cannot be deleted
    const connections = scanConnections();
    const iface = connections.find(
      c => c.name === name || c.deviceName === name
    );

    if (!iface) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `Interface "${name}" not found` } },
        { status: 404 }
      );
    }

    if (iface.isPhysical) {
      return NextResponse.json(
        { success: false, error: { code: 'PHYSICAL_INTERFACE', message: `Cannot delete physical interface "${name}". Only virtual interfaces (VLAN, bridge, bond) can be deleted.` } },
        { status: 403 }
      );
    }

    // Delete via nmcli
    try {
      safeExec(`sudo nmcli con down ${name} 2>/dev/null || true`);
      safeExec(`sudo nmcli con delete ${name}`);
    } catch (e: any) {
      console.warn(`[Network OS API] nmcli delete failed for ${name}: ${e.message}, trying inline fallback`);
      safeExec(`sudo nmcli con delete "${name}" 2>/dev/null`);
    }

    return NextResponse.json({
      success: true,
      message: `Virtual interface "${name}" deleted successfully`,
      data: { name, type: iface.type },
    });
  } catch (error) {
    console.error('[Network OS API] Interface delete error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'OS_ERROR', message: 'Failed to delete interface' } },
      { status: 500 }
    );
  }
}
