import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import * as fs from 'fs';
import { db } from '@/lib/db';

/**
 * POST   /api/network/os/interfaces/[name]/aliases — Add a secondary IP alias
 * GET    /api/network/os/interfaces/[name]/aliases — List all aliases for the interface
 * DELETE /api/network/os/interfaces/[name]/aliases — Remove an alias IP
 *
 * Uses `sudo ip addr add/del` on Debian 13 to manage secondary IPs.
 * Persists to /etc/network/interfaces and InterfaceAlias in DB.
 */

function safeExec(cmd: string, timeout = 5000): string {
  try { return execSync(cmd, { encoding: 'utf-8', timeout }); } catch (e: any) { return e.stdout || ''; }
}

const INTERFACES_FILE = process.env.NETWORK_INTERFACES_FILE || '/etc/network/interfaces';
const TENANT_ID = 'tenant-1';
const PROPERTY_ID = 'property-1';

const VALID_NAME = /^[a-zA-Z0-9._-]+$/;

function isValidIPv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every(p => { const n = parseInt(p, 10); return !isNaN(n) && n >= 0 && n <= 255 && String(n) === p; });
}

function isValidNetmask(mask: string): boolean {
  if (!isValidIPv4(mask)) return false;
  const num = mask.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  const inverted = (~num) >>> 0;
  return (inverted & (inverted + 1)) === 0 && num > 0;
}

function netmaskToCidr(mask: string): number {
  const num = mask.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  let count = 0;
  while (num & (1 << (31 - count))) count++;
  return count;
}

/**
 * Persist alias to /etc/network/interfaces.
 * Adds an `up ip addr add ...` line inside the interface stanza.
 */
function persistAliasToFile(
  ifaceName: string,
  ipAddress: string,
  cidr: number,
): { success: boolean; message: string } {
  try {
    let content = '';
    try {
      content = fs.readFileSync(INTERFACES_FILE, 'utf-8');
    } catch {
      content = '# /etc/network/interfaces — managed by StaySuite HospitalityOS\n\nsource /etc/network/interfaces.d/*\n\n';
    }

    const lines = content.split('\n');
    const aliasLine = `\tup ip addr add ${ipAddress}/${cidr} dev ${ifaceName}`;
    const aliasMarker = `# STAYSUITE_ALIAS ${ipAddress}/${cidr}`;

    // Check if alias is already in the file
    const alreadyExists = lines.some(
      l => l.trim() === aliasLine.trim() || l.trim().includes(aliasMarker)
    );
    if (alreadyExists) {
      return { success: true, message: 'Alias already present in interfaces file' };
    }

    // Find the iface stanza and append inside it
    let stanzaEnd = -1;
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      const ifaceMatch = trimmed.match(/^iface\s+([a-zA-Z0-9._:-]+)\s+inet\s+(\S+)/);
      if (ifaceMatch && (ifaceMatch[1] === ifaceName || ifaceMatch[1].startsWith(ifaceName + ':'))) {
        // Find end of stanza
        for (let j = i + 1; j < lines.length; j++) {
          const nextTrimmed = lines[j].trim();
          if (nextTrimmed === '' || nextTrimmed.match(/^(?:auto|allow-hotplug|iface|source)\s/)) {
            stanzaEnd = j;
            break;
          }
        }
        if (stanzaEnd === -1) stanzaEnd = lines.length;
        break;
      }
    }

    if (stanzaEnd > 0) {
      lines.splice(stanzaEnd, 0, aliasMarker, aliasLine);
    } else {
      // No stanza found — append
      if (lines.length > 0 && lines[lines.length - 1].trim() !== '') {
        lines.push('');
      }
      lines.push(`iface ${ifaceName} inet manual`);
      lines.push(aliasMarker);
      lines.push(aliasLine);
      lines.push('');
    }

    fs.writeFileSync(INTERFACES_FILE, lines.join('\n'), 'utf-8');
    return { success: true, message: `Alias persisted to ${INTERFACES_FILE}` };
  } catch (err: any) {
    return { success: false, message: `File write error: ${err.message}` };
  }
}

/**
 * Remove alias from /etc/network/interfaces.
 */
function removeAliasFromFile(
  ifaceName: string,
  ipAddress: string,
): { success: boolean; message: string } {
  try {
    let content = '';
    try {
      content = fs.readFileSync(INTERFACES_FILE, 'utf-8');
    } catch {
      return { success: true, message: 'No interfaces file to update' };
    }

    const lines = content.split('\n');
    const resultLines = lines.filter(line => {
      const trimmed = line.trim();
      // Remove the marker and the alias line
      if (trimmed.includes(`STAYSUITE_ALIAS ${ipAddress}`)) return false;
      if (trimmed.match(new RegExp(`^up\\s+ip\\s+addr\\s+add\\s+${ipAddress.replace('.', '\\.')}\\/`))) return false;
      return true;
    });

    fs.writeFileSync(INTERFACES_FILE, resultLines.join('\n'), 'utf-8');
    return { success: true, message: `Alias removed from ${INTERFACES_FILE}` };
  } catch (err: any) {
    return { success: false, message: `File write error: ${err.message}` };
  }
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

    // 1. Parse from OS
    const output = safeExec(`ip -o -4 addr show dev ${name} 2>/dev/null`);
    const addresses: { ip: string; cidr: number; netmask: string; primary: boolean }[] = [];

    const addrLines = output.trim().split('\n').filter(Boolean);
    for (let idx = 0; idx < addrLines.length; idx++) {
      const match = addrLines[idx].match(/inet\s+(\S+)/);
      if (match) {
        const ipWithCidr = match[1];
        const [ip, cidrStr] = ipWithCidr.split('/');
        const cidr = parseInt(cidrStr, 10) || 24;
        // Convert CIDR to netmask
        const maskNum = (0xFFFFFFFF << (32 - cidr)) >>> 0;
        const netmask = [
          (maskNum >>> 24) & 0xFF,
          (maskNum >>> 16) & 0xFF,
          (maskNum >>> 8) & 0xFF,
          maskNum & 0xFF,
        ].join('.');
        addresses.push({ ip, cidr, netmask, primary: idx === 0 });
      }
    }

    // Aliases are everything after the first (primary) address
    const osAliases = addresses.slice(1);

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

    if (!ipAddress || !isValidIPv4(ipAddress)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_IP', message: 'A valid IPv4 address is required' } },
        { status: 400 }
      );
    }

    const aliasNetmask = netmask || '255.255.255.0';
    if (!isValidNetmask(aliasNetmask)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_NETMASK', message: 'Invalid netmask' } },
        { status: 400 }
      );
    }

    const cidr = netmaskToCidr(aliasNetmask);
    const results: { step: string; success: boolean; message: string }[] = [];

    // 1. Add alias at OS level
    const addOutput = safeExec(`sudo ip addr add ${ipAddress}/${cidr} dev ${name} 2>&1`);
    if (addOutput.includes('File exists')) {
      return NextResponse.json(
        { success: false, error: { code: 'EXISTS', message: `IP ${ipAddress}/${cidr} already exists on ${name}` } },
        { status: 409 }
      );
    }
    results.push({ step: 'add-addr', success: true, message: addOutput.trim() });

    // 2. Persist to /etc/network/interfaces
    const fileResult = persistAliasToFile(name, ipAddress, cidr);
    results.push({ step: 'file-persist', ...fileResult });

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

    if (!VALID_NAME.test(name)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_NAME', message: 'Invalid interface name' } },
        { status: 400 }
      );
    }

    if (!ip || !isValidIPv4(ip)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_IP', message: 'Valid "ip" query parameter is required' } },
        { status: 400 }
      );
    }

    const results: { step: string; success: boolean; message: string }[] = [];

    // 1. Determine the CIDR — read from OS to get the correct prefix
    const addrOutput = safeExec(`ip -o -4 addr show dev ${name} 2>/dev/null`);
    let cidr = 24; // default
    for (const line of addrOutput.trim().split('\n').filter(Boolean)) {
      const match = line.match(new RegExp(`inet\\s+${ip.replace('.', '\\.')}/(\\d+)`));
      if (match) {
        cidr = parseInt(match[1], 10);
        break;
      }
    }

    // 2. Remove at OS level
    const delOutput = safeExec(`sudo ip addr del ${ip}/${cidr} dev ${name} 2>&1`);
    results.push({ step: 'del-addr', success: true, message: delOutput.trim() });

    // 3. Remove from /etc/network/interfaces
    const fileResult = removeAliasFromFile(name, ip);
    results.push({ step: 'file-remove', ...fileResult });

    // 4. Remove from DB
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
