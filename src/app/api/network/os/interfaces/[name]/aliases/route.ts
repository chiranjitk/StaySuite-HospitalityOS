import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { db } from '@/lib/db';
import {
  scanConnections,
  addSecondaryIP,
  removeSecondaryIP,
} from '@/lib/network/nmcli';
import { netmaskToCidr } from '@/lib/network/executor';
import { NM_CONNECTIONS_DIR } from '@/lib/network/nettypes';
import { parseNmConnectionFile, getSecondaryAddresses, getPrimaryAddress } from '@/lib/network/nmconnection';

function safeExec(cmd: string, timeout = 5000): string {
  try { return execSync(cmd, { encoding: 'utf-8', timeout }); } catch { return ''; }
}

const TENANT_ID = 'tenant-1';
const PROPERTY_ID = 'property-1';
const VALID_NAME = /^[a-zA-Z0-9._-]+$/;

function cidrToNetmask(cidr: number): string {
  const masks = [
    '0.0.0.0', '128.0.0.0', '192.0.0.0', '224.0.0.0', '240.0.0.0', '248.0.0.0',
    '252.0.0.0', '254.0.0.0', '255.0.0.0', '255.128.0.0', '255.192.0.0',
    '255.224.0.0', '255.240.0.0', '255.248.0.0', '255.252.0.0', '255.254.0.0',
    '255.255.0.0', '255.255.128.0', '255.255.192.0', '255.255.224.0',
    '255.255.240.0', '255.255.248.0', '255.255.252.0', '255.255.254.0',
    '255.255.255.0', '255.255.255.128', '255.255.255.192', '255.255.255.224',
    '255.255.255.240', '255.255.255.248', '255.255.255.252', '255.255.255.254',
    '255.255.255.255',
  ];
  return masks[cidr] || '255.255.255.0';
}

/** Parse "ip/cidr" string from .nmconnection address fields */
function parseAddressStr(addr: string): { ip: string; cidr: number } | null {
  if (!addr) return null;
  const slashIdx = addr.indexOf('/');
  if (slashIdx < 0) return null;
  return {
    ip: addr.substring(0, slashIdx),
    cidr: parseInt(addr.substring(slashIdx + 1), 10) || 24,
  };
}

/**
 * POST   /api/network/os/interfaces/[name]/aliases — Add a secondary IP alias
 * GET    /api/network/os/interfaces/[name]/aliases — List all aliases for the interface
 * DELETE /api/network/os/interfaces/[name]/aliases — Remove an alias IP
 *
 * Uses nmcli wrapper for Rocky Linux 10 NetworkManager.
 * Aliases are stored as additional ipv4.addresses in .nmconnection files.
 */

// ────────────────────────────────────────────────────────────
// GET — List secondary IPs from .nmconnection file
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

    // 1. Get secondary IPs from .nmconnection file via nmcli wrapper
    let osAliases: { ip: string; cidr: number; netmask: string }[] = [];
    try {
      const connections = scanConnections();
      const conn = connections.find(c => c.name === name || c.deviceName === name);
      if (conn && conn.secondaryIps) {
        osAliases = conn.secondaryIps.map(addrStr => {
          const parsed = parseAddressStr(addrStr);
          return parsed
            ? { ip: parsed.ip, cidr: parsed.cidr, netmask: cidrToNetmask(parsed.cidr) }
            : { ip: addrStr, cidr: 24, netmask: '255.255.255.0' };
        });
      }
    } catch (e: any) {
      console.warn(`[Network OS API] nmcli alias list failed for ${name}: ${e.message}, using inline fallback`);
      // Inline fallback: parse ip addr show
      const output = safeExec(`ip -o -4 addr show dev ${name} 2>/dev/null`);
      const lines = output.trim().split('\n').filter(Boolean);
      let isFirst = true;
      for (const line of lines) {
        const match = line.match(/inet\s+([\d.]+)\/(\d+)/);
        if (match) {
          if (isFirst) { isFirst = false; continue; }
          osAliases.push({
            ip: match[1],
            cidr: parseInt(match[2], 10),
            netmask: cidrToNetmask(parseInt(match[2], 10)),
          });
        }
      }
    }

    // 2. Fetch from DB
    let dbAliases: any[] = [];
    try {
      const netIface = await db.networkInterface.findUnique({
        where: { propertyId_name: { propertyId: PROPERTY_ID, name } },
      });
      if (netIface) {
        dbAliases = await db.interfaceAlias.findMany({
          where: { propertyId: PROPERTY_ID, interfaceId: netIface.id },
          orderBy: { createdAt: 'desc' },
        });
      }
    } catch (dbErr: any) {
      console.warn(`[Network OS API] DB fetch failed for aliases on ${name}:`, dbErr);
    }

    return NextResponse.json({
      success: true,
      data: {
        interfaceName: name,
        osAliases,
        dbAliases,
      },
    });
  } catch (error) {
    console.error('[Network OS API] Alias list error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'OS_ERROR', message: 'Failed to list aliases' } },
      { status: 500 }
    );
  }
}

// ────────────────────────────────────────────────────────────
// POST — Add secondary IP via nmcli con mod +ipv4.addresses
// ────────────────────────────────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const body = await request.json();
    const { ipAddress, netmask, description } = body;

    if (!VALID_NAME.test(name)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_NAME', message: 'Invalid interface name' } },
        { status: 400 }
      );
    }

    if (!ipAddress) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_IP', message: 'An IP address is required' } },
        { status: 400 }
      );
    }

    const aliasNetmask = netmask || '255.255.255.0';
    const cidr = netmaskToCidr(aliasNetmask);
    const results: { step: string; success: boolean; message: string }[] = [];

    // 1. Add alias at OS level via nmcli wrapper (with inline fallback)
    let addOk = false;
    try {
      addSecondaryIP(name, ipAddress, cidr);
      addOk = true;
    } catch (e: any) {
      const errMsg = e.message || '';
      if (errMsg.includes('already exists') || errMsg.includes('exists') || errMsg.includes('is already')) {
        return NextResponse.json(
          { success: false, error: { code: 'EXISTS', message: `IP ${ipAddress} already exists on ${name}` } },
          { status: 409 }
        );
      }
      console.warn(`[Network OS API] nmcli addSecondaryIP failed for ${ipAddress} on ${name}: ${errMsg}, trying inline fallback`);

      // Inline fallback: nmcli directly
      try {
        safeExec(`sudo nmcli con mod "${name}" +ipv4.addresses ${ipAddress}/${cidr}`);
        safeExec(`sudo nmcli con up "${name}"`);
        addOk = true;
      } catch (fbErr: any) {
        console.warn(`[Network OS API] Inline fallback alias add also failed for ${ipAddress} on ${name}: ${fbErr.message}`);
      }
    }

    if (!addOk) {
      return NextResponse.json(
        { success: false, error: { code: 'ADD_FAILED', message: 'Failed to add alias at OS level' } },
        { status: 500 }
      );
    }
    results.push({ step: 'add-addr', success: true, message: 'Alias added via nmcli' });

    // 2. Save to DB (InterfaceAlias)
    try {
      let netIface = await db.networkInterface.findUnique({
        where: { propertyId_name: { propertyId: PROPERTY_ID, name } },
      });
      if (!netIface) {
        netIface = await db.networkInterface.create({
          data: {
            tenantId: TENANT_ID,
            propertyId: PROPERTY_ID,
            name,
            type: 'ethernet',
            status: 'up',
          },
        });
      }

      await db.interfaceAlias.create({
        data: {
          tenantId: TENANT_ID,
          propertyId: PROPERTY_ID,
          interfaceId: netIface.id,
          interfaceName: name,
          ipAddress,
          netmask: aliasNetmask,
          description: description || null,
        },
      });
      results.push({ step: 'database', success: true, message: 'Alias saved to database' });
    } catch (dbErr: any) {
      console.warn(`[Network OS API] DB create failed for alias on ${name}:`, dbErr);
      results.push({ step: 'database', success: false, message: dbErr.message });
    }

    return NextResponse.json({
      success: true,
      message: `Alias ${ipAddress}/${cidr} added to ${name}`,
      results,
      data: { interfaceName: name, ipAddress, netmask: aliasNetmask, cidr, description: description || undefined },
    });
  } catch (error) {
    console.error('[Network OS API] Alias add error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'OS_ERROR', message: 'Failed to add alias' } },
      { status: 500 }
    );
  }
}

// ────────────────────────────────────────────────────────────
// DELETE — Remove secondary IP via nmcli con mod -ipv4.addresses
// ────────────────────────────────────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const { searchParams } = new URL(request.url);
    const ip = searchParams.get('ip');
    const netmask = searchParams.get('netmask') || '255.255.255.0';

    if (!VALID_NAME.test(name)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_NAME', message: 'Invalid interface name' } },
        { status: 400 }
      );
    }

    if (!ip) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_IP', message: 'Valid "ip" query parameter is required' } },
        { status: 400 }
      );
    }

    const cidr = netmaskToCidr(netmask);
    const results: { step: string; success: boolean; message: string }[] = [];

    // 1. Remove at OS level via nmcli wrapper (with inline fallback)
    let osRemoveOk = false;
    try {
      removeSecondaryIP(name, ip, cidr);
      osRemoveOk = true;
    } catch (e: any) {
      console.warn(`[Network OS API] nmcli removeSecondaryIP failed for ${ip} on ${name}: ${e.message}, trying inline fallback`);

      // Inline fallback: nmcli directly
      try {
        safeExec(`sudo nmcli con mod "${name}" -ipv4.addresses ${ip}/${cidr}`);
        safeExec(`sudo nmcli con up "${name}"`);
        osRemoveOk = true;
      } catch (fbErr: any) {
        console.warn(`[Network OS API] Inline fallback alias remove also failed for ${ip} on ${name}: ${fbErr.message}`);
        // Still continue to DB cleanup — IP may already be gone
        osRemoveOk = true;
      }
    }

    results.push({
      step: 'del-addr',
      success: osRemoveOk,
      message: osRemoveOk ? 'Alias removed via nmcli' : 'OS remove failed',
    });

    // 2. Remove from DB
    try {
      const netIface = await db.networkInterface.findUnique({
        where: { propertyId_name: { propertyId: PROPERTY_ID, name } },
      });
      if (netIface) {
        await db.interfaceAlias.deleteMany({
          where: { propertyId: PROPERTY_ID, interfaceId: netIface.id, ipAddress: ip },
        });
      }
      results.push({ step: 'database', success: true, message: 'Alias removed from database' });
    } catch (dbErr: any) {
      console.warn(`[Network OS API] DB delete failed for alias on ${name}:`, dbErr);
      results.push({ step: 'database', success: false, message: dbErr.message });
    }

    return NextResponse.json({
      success: true,
      message: `Alias ${ip}/${cidr} removed from ${name}`,
      results,
    });
  } catch (error) {
    console.error('[Network OS API] Alias delete error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'OS_ERROR', message: 'Failed to remove alias' } },
      { status: 500 }
    );
  }
}
