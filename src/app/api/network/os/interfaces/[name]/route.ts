import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '@/lib/db';

/**
 * POST /api/network/os/interfaces/[name] - Interface actions:
 *   - mtu: Set MTU
 *   - action: up/down
 *   - ipAddress + netmask + gateway + mode (static/dhcp): Set IP configuration
 *
 * Also persists IP config to /etc/network/interfaces and InterfaceConfig in DB.
 */

function safeExec(cmd: string, timeout = 5000): string {
  try { return execSync(cmd, { encoding: 'utf-8', timeout }); } catch (e: any) { return e.stdout || ''; }
}

const INTERFACES_FILE = process.env.NETWORK_INTERFACES_FILE || '/etc/network/interfaces';
const TENANT_ID = 'tenant-1';
const PROPERTY_ID = 'property-1';

/**
 * Validate an IPv4 address
 */
function isValidIPv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every(p => { const n = parseInt(p, 10); return !isNaN(n) && n >= 0 && n <= 255 && String(n) === p; });
}

/**
 * Validate a netmask (e.g., 255.255.255.0)
 */
function isValidNetmask(mask: string): boolean {
  if (!isValidIPv4(mask)) return false;
  const num = mask.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  // Must be contiguous 1s followed by 0s
  const inverted = (~num) >>> 0;
  return (inverted & (inverted + 1)) === 0 && num > 0;
}

/**
 * Convert netmask to CIDR prefix length
 */
function netmaskToCidr(mask: string): number {
  const num = mask.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  let count = 0;
  while (num & (1 << (31 - count))) count++;
  return count;
}

/**
 * Persist IP configuration to /etc/network/interfaces file.
 * Reads the file, finds or creates the interface stanza, and sets the
 * addressing method (dhcp/static) with appropriate parameters.
 *
 * Also injects a STAYSUITE_CONFIG tag to mark StaySuite-managed blocks.
 */
function persistIPConfigToFile(
  ifaceName: string,
  mode: 'dhcp' | 'static',
  ipAddress?: string,
  netmask?: string,
  gateway?: string,
): { success: boolean; message: string } {
  try {
    let content = '';
    try {
      content = fs.readFileSync(INTERFACES_FILE, 'utf-8');
    } catch {
      content = '# /etc/network/interfaces — managed by StaySuite HospitalityOS\n\nsource /etc/network/interfaces.d/*\n\n';
    }

    const lines = content.split('\n');

    // Find the iface stanza for this interface
    let stanzaStart = -1;
    let stanzaEnd = lines.length;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      const ifaceMatch = trimmed.match(/^iface\s+([a-zA-Z0-9._-]+)\s+inet\s+(\S+)/);
      if (ifaceMatch && ifaceMatch[1] === ifaceName) {
        stanzaStart = i;
        // Find end of stanza (next blank line or next stanza keyword)
        for (let j = i + 1; j < lines.length; j++) {
          const nextTrimmed = lines[j].trim();
          if (nextTrimmed === '' || nextTrimmed.match(/^(?:auto|allow-hotplug|iface|source)\s/)) {
            stanzaEnd = j;
            break;
          }
        }
        break;
      }
    }

    // Build new stanza content
    const newStanzaLines: string[] = [];

    if (stanzaStart !== -1) {
      // Replace existing stanza
      const before = lines.slice(0, stanzaStart);
      const after = lines.slice(stanzaEnd);

      // Keep any STAYSUITE_ROLE/STAYSUITE_PRIORITY comment tags before the stanza
      // by checking the lines immediately before stanzaStart
      const tagLines: string[] = [];
      for (let i = stanzaStart - 1; i >= 0; i--) {
        const trimmed = lines[i].trim();
        if (trimmed.match(/^#\s*STAYSUITE_/i)) {
          tagLines.unshift(lines[i]);
        } else {
          break;
        }
      }

      // Remove the tag lines from before since we'll re-add them
      const cleanBefore = tagLines.length > 0 ? lines.slice(0, stanzaStart - tagLines.length) : before;

      // Build new iface line
      newStanzaLines.push(`iface ${ifaceName} inet ${mode}`);

      if (mode === 'static' && ipAddress) {
        newStanzaLines.push(`\taddress ${ipAddress}`);
        if (netmask) {
          newStanzaLines.push(`\tnetmask ${netmask}`);
        }
        if (gateway) {
          newStanzaLines.push(`\tgateway ${gateway}`);
        }
      }

      const separator = cleanBefore.length > 0 && cleanBefore[cleanBefore.length - 1].trim() !== '' ? [''] : [];
      const result = [...cleanBefore, ...separator, ...tagLines, ...newStanzaLines, ...after];
      fs.writeFileSync(INTERFACES_FILE, result.join('\n'), 'utf-8');
    } else {
      // No existing stanza — append new one
      // Also check if there's an allow-hotplug or auto line
      let hasAutoLine = false;
      for (const line of lines) {
        const trimmed = line.trim();
        if ((trimmed.match(/^auto\s+/) || trimmed.match(/^allow-hotplug\s+/)) && trimmed.includes(ifaceName)) {
          hasAutoLine = true;
          break;
        }
      }

      const appended = [...lines];

      if (appended.length > 0 && appended[appended.length - 1].trim() !== '') {
        appended.push('');
      }

      if (!hasAutoLine) {
        appended.push(`allow-hotplug ${ifaceName}`);
      }

      appended.push(`iface ${ifaceName} inet ${mode}`);

      if (mode === 'static' && ipAddress) {
        appended.push(`\taddress ${ipAddress}`);
        if (netmask) {
          appended.push(`\tnetmask ${netmask}`);
        }
        if (gateway) {
          appended.push(`\tgateway ${gateway}`);
        }
      }

      appended.push('');
      fs.writeFileSync(INTERFACES_FILE, appended.join('\n'), 'utf-8');
    }

    return { success: true, message: `IP config persisted to ${INTERFACES_FILE}` };
  } catch (err: any) {
    return { success: false, message: `File write error: ${err.message}` };
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const body = await request.json();

    // Validate interface name (security: prevent command injection)
    if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_NAME', message: 'Invalid interface name' } },
        { status: 400 }
      );
    }

    // Handle different actions based on body
    if (body.mtu !== undefined) {
      const mtu = parseInt(body.mtu, 10);
      if (isNaN(mtu) || mtu < 68 || mtu > 9000) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_MTU', message: 'MTU must be between 68 and 9000' } },
          { status: 400 }
        );
      }
      const output = safeExec(`sudo ip link set dev ${name} mtu ${mtu} 2>&1`);
      return NextResponse.json({
        success: true,
        message: `MTU for ${name} set to ${mtu}`,
        output: output.trim(),
      });
    }

    if (body.action === 'up') {
      const output = safeExec(`sudo ip link set dev ${name} up 2>&1`);
      return NextResponse.json({
        success: true,
        message: `Interface ${name} brought up`,
        output: output.trim(),
      });
    }

    if (body.action === 'down') {
      const output = safeExec(`sudo ip link set dev ${name} down 2>&1`);
      return NextResponse.json({
        success: true,
        message: `Interface ${name} brought down`,
        output: output.trim(),
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
      const mode = body.mode as 'dhcp' | 'static';
      if (mode !== 'dhcp' && mode !== 'static') {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_MODE', message: 'Mode must be "dhcp" or "static"' } },
          { status: 400 }
        );
      }

      if (mode === 'static') {
        if (!body.ipAddress || !isValidIPv4(body.ipAddress)) {
          return NextResponse.json(
            { success: false, error: { code: 'INVALID_IP', message: 'A valid IPv4 address is required for static mode' } },
            { status: 400 }
          );
        }
        if (body.netmask && !isValidNetmask(body.netmask)) {
          return NextResponse.json(
            { success: false, error: { code: 'INVALID_NETMASK', message: 'Invalid netmask format' } },
            { status: 400 }
          );
        }
        if (body.gateway && !isValidIPv4(body.gateway)) {
          return NextResponse.json(
            { success: false, error: { code: 'INVALID_GATEWAY', message: 'Invalid gateway address' } },
            { status: 400 }
          );
        }
      }

      const results: { step: string; success: boolean; message: string }[] = [];

      // 1. Apply at OS level (runtime via ip command)
      if (mode === 'static' && body.ipAddress) {
        const cidr = body.netmask ? `/${netmaskToCidr(body.netmask)}` : '/24';
        const addrOutput = safeExec(`sudo ip addr flush dev ${name} 2>&1`);
        const addrAddOutput = safeExec(`sudo ip addr add ${body.ipAddress}${cidr} dev ${name} 2>&1`);

        if (body.gateway) {
          // Remove old default routes for this interface, add new one
          safeExec(`sudo ip route del default dev ${name} 2>&1`);
          const gwOutput = safeExec(`sudo ip route add default via ${body.gateway} dev ${name} 2>&1`);
          results.push({ step: 'gateway', success: true, message: gwOutput.trim() });
        }

        results.push({ step: 'ip-address', success: true, message: addrAddOutput.trim() });
      } else if (mode === 'dhcp') {
        // Release and re-acquire DHCP
        const dhclientOutput = safeExec(`sudo dhclient -r ${name} 2>&1; sudo dhclient ${name} 2>&1`);
        results.push({ step: 'dhcp', success: true, message: dhclientOutput.trim() });
      }

      // 2. Persist to /etc/network/interfaces
      const fileResult = persistIPConfigToFile(name, mode, body.ipAddress, body.netmask, body.gateway);
      results.push({ step: 'file-persist', ...fileResult });

      // 3. Store in database (InterfaceConfig) — ensure NetworkInterface exists for FK
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
