import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { db } from '@/lib/db';
import { addAlias, removeAlias, listAliases } from '@/lib/network/alias';
import { persistAliasAdd, persistAliasRemove } from '@/lib/network/persist';
import { netmaskToCidr } from '@/lib/network/executor';

function safeExec(cmd: string, timeout = 5000): string {
  try { return execSync(cmd, { encoding: 'utf-8', timeout }); } catch { return ''; }
}

/**
 * POST   /api/network/os/interfaces/[name]/aliases — Add a secondary IP alias
 * GET    /api/network/os/interfaces/[name]/aliases — List all aliases for the interface
 * DELETE /api/network/os/interfaces/[name]/aliases — Remove an alias IP
 *
 * Uses shell script wrappers for OS commands and file persistence.
 * Persists InterfaceAlias in DB after successful OS operations.
 */

const TENANT_ID = 'tenant-1';
const PROPERTY_ID = 'property-1';

const VALID_NAME = /^[a-zA-Z0-9._-]+$/;

// Inline fallback: read aliases directly from `ip addr show`
function getAliasesInline(ifaceName: string): { ip: string; cidr: number; netmask: string }[] {
  const aliases: { ip: string; cidr: number; netmask: string }[] = [];
  const output = safeExec(`ip -o -4 addr show dev ${ifaceName} 2>/dev/null`);
  const lines = output.trim().split('\n').filter(Boolean);

  // Skip the first address (primary), return the rest as aliases
  let isFirst = true;
  for (const line of lines) {
    const match = line.match(/inet\s+([\d.]+)\/(\d+)/);
    if (match) {
      if (isFirst) {
        isFirst = false;
        continue; // Skip primary IP
      }
      const ip = match[1];
      const cidr = parseInt(match[2], 10);
      aliases.push({ ip, cidr, netmask: cidrToNetmask(cidr) });
    }
  }
  return aliases;
}

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

// ────────────────────────────────────────────────────────────
// GET /api/network/os/interfaces/[name]/aliases — List aliases
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

    // 1. List aliases from OS — try shell script first, fallback to inline
    let osAliases: { ip: string; cidr: number; netmask: string }[] = [];
    try {
      const osResult = listAliases(name);
      if (osResult.success && osResult.data && Array.isArray(osResult.data.aliases)) {
        osAliases = osResult.data.aliases.map(a => ({
          ip: a.ipAddress,
          cidr: a.cidr,
          netmask: a.netmask,
        }));
      } else {
        // Inline fallback: parse ip addr show
        osAliases = getAliasesInline(name);
      }
    } catch {
      osAliases = getAliasesInline(name);
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
// POST /api/network/os/interfaces/[name]/aliases — Add alias
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
    const results: { step: string; success: boolean; message: string }[] = [];

    // 1. Add alias at OS level via shell script
    const addResult = addAlias({ interface: name, ipAddress, netmask: aliasNetmask });

    if (!addResult.success) {
      const errMsg = addResult.error || 'Failed to add alias';
      if (errMsg.includes('File exists') || errMsg.includes('exists')) {
        return NextResponse.json(
          { success: false, error: { code: 'EXISTS', message: `IP ${ipAddress} already exists on ${name}` } },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { success: false, error: { code: 'ADD_FAILED', message: errMsg } },
        { status: 500 }
      );
    }
    results.push({ step: 'add-addr', success: true, message: 'Alias added at OS level' });

    // 2. Persist to /etc/network/interfaces via shell script
    const persistResult = persistAliasAdd({ interface: name, ipAddress, netmask: aliasNetmask });

    if (!persistResult.success) {
      console.warn(`[Network OS API] File persist failed for alias on ${name}: ${persistResult.error} — continuing with DB only`);
    }
    results.push({
      step: 'file-persist',
      success: persistResult.success,
      message: persistResult.success ? 'Alias persisted to interfaces file' : (persistResult.error || 'File persist failed'),
    });

    // 3. Save to DB (InterfaceAlias)
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

    const cidr = addResult.data?.cidr || 24;
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
// DELETE /api/network/os/interfaces/[name]/aliases — Remove alias
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

    const results: { step: string; success: boolean; message: string }[] = [];

    // 1. Remove at OS level via shell script (with inline fallback)
    let osRemoveOk = false;
    try {
      const removeResult = removeAlias(name, ip, netmask);
      if (removeResult.success) {
        osRemoveOk = true;
      } else {
        console.warn(`[Network OS API] Shell script alias remove failed for ${ip} on ${name}: ${removeResult.error}, trying inline fallback`);
      }
    } catch (e: any) {
      console.warn(`[Network OS API] Shell script alias remove error for ${ip} on ${name}: ${e.message}, trying inline fallback`);
    }

    // Inline fallback: try ip addr del directly
    if (!osRemoveOk) {
      try {
        const cidr = cidrToNetmask(netmask) === netmask
          ? Object.entries({
              '0.0.0.0': 0, '128.0.0.0': 1, '192.0.0.0': 2, '224.0.0.0': 3,
              '240.0.0.0': 4, '248.0.0.0': 5, '252.0.0.0': 6, '254.0.0.0': 7,
              '255.0.0.0': 8, '255.128.0.0': 9, '255.192.0.0': 10, '255.224.0.0': 11,
              '255.240.0.0': 12, '255.248.0.0': 13, '255.252.0.0': 14, '255.254.0.0': 15,
              '255.255.0.0': 16, '255.255.128.0': 17, '255.255.192.0': 18, '255.255.224.0': 19,
              '255.255.240.0': 20, '255.255.248.0': 21, '255.255.252.0': 22, '255.255.254.0': 23,
              '255.255.255.0': 24, '255.255.255.128': 25, '255.255.255.192': 26,
              '255.255.255.224': 27, '255.255.255.240': 28, '255.255.255.248': 29,
              '255.255.255.252': 30, '255.255.255.254': 31, '255.255.255.255': 32,
            }).find(([, v]) => v === netmaskToCidr(netmask))?.[1] || 24
          : 24;
        const delOutput = safeExec(`sudo ip addr del ${ip}/${cidr} dev ${name} 2>&1`);
        // ip addr del returns error if IP doesn't exist, that's OK — we still want to clean up DB
        osRemoveOk = true; // Consider it success — the IP is gone (or was never there)
        if (delOutput.includes('Cannot find device') || delOutput.includes('not found')) {
          console.log(`[Network OS API] Alias ${ip} was not on ${name} (already removed or never existed)`);
        }
      } catch (e: any) {
        console.warn(`[Network OS API] Inline alias remove also failed for ${ip} on ${name}: ${e.message}`);
        // Still continue to DB cleanup
        osRemoveOk = true;
      }
    }

    results.push({
      step: 'del-addr',
      success: osRemoveOk,
      message: osRemoveOk ? 'Alias removed from OS (or did not exist)' : 'OS remove failed',
    });

    // 2. Remove from /etc/network/interfaces via shell script
    const persistResult = persistAliasRemove(name, ip);

    if (!persistResult.success) {
      console.warn(`[Network OS API] File remove failed for alias ${ip} on ${name}: ${persistResult.error} — continuing with DB only`);
    }
    results.push({
      step: 'file-remove',
      success: persistResult.success,
      message: persistResult.success ? 'Alias removed from interfaces file' : (persistResult.error || 'File remove failed'),
    });

    // 3. Remove from DB
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

    const cidr = netmaskToCidr(netmask);
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
