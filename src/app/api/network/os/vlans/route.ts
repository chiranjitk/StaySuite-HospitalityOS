import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import {
  scanConnections,
  createVlan,
  deleteVlan,
  NmConnectionInfo,
} from '@/lib/network/nmcli';
import { NET_TYPES } from '@/lib/network/nettypes';

function safeExec(cmd: string, timeout = 10000): string {
  try { return execSync(cmd, { encoding: 'utf-8', timeout }); } catch (e: any) { return e.stderr?.trim() || e.stdout?.trim() || ''; }
}

function isValidIPv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every(p => { const n = parseInt(p, 10); return !isNaN(n) && n >= 0 && n <= 255 && String(n) === p; });
}

/**
 * GET  /api/network/os/vlans — List VLAN interfaces from nmcli scanConnections
 * POST /api/network/os/vlans — Create a VLAN interface via nmcli
 * DELETE /api/network/os/vlans — Delete a VLAN interface via nmcli
 *
 * Uses nmcli wrapper for Rocky Linux 10 NetworkManager.
 */

// ──────────────────────────────────────────────
// GET — List VLAN interfaces from scanConnections()
// ──────────────────────────────────────────────
export async function GET() {
  try {
    // Scan all connections and filter for VLAN type
    const connections = scanConnections();
    const vlans = connections.filter(c => c.type === 'vlan');

    return NextResponse.json({
      success: true,
      data: vlans,
    });
  } catch (error: any) {
    console.error('[Network OS API] VLAN list error:', error);

    // Inline fallback: nmcli -t -f
    try {
      const output = safeExec('nmcli -t -f NAME,TYPE,DEVICE con show 2>/dev/null');
      const vlans: Array<{ name: string; parent: string; vlanId: number; state: string }> = [];
      for (const line of output.trim().split('\n').filter(Boolean)) {
        const parts = line.split(':');
        if (parts[1] === 'vlan') {
          vlans.push({ name: parts[0], parent: '', vlanId: 0, state: 'unknown' });
        }
      }
      return NextResponse.json({ success: true, data: vlans });
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'OS_ERROR', message: 'Failed to list VLANs' } },
        { status: 500 }
      );
    }
  }
}

// ──────────────────────────────────────────────
// POST — Create a VLAN interface via nmcli
// ──────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { parentInterface, vlanId, mtu, name, ipAddress, netmask, gateway } = body;

    if (!parentInterface || !vlanId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'parentInterface and vlanId are required' } },
        { status: 400 }
      );
    }

    const vid = parseInt(String(vlanId), 10);
    if (isNaN(vid) || vid < 1 || vid > 4094) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID', message: 'VLAN ID must be 1-4094' } },
        { status: 400 }
      );
    }

    if (ipAddress && !isValidIPv4(ipAddress)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID', message: 'Invalid IPv4 address format' } },
        { status: 400 }
      );
    }

    const vlanName = name || `${parentInterface}.${vid}`;
    const mtuVal = mtu ? parseInt(String(mtu), 10) : 1500;

    // Create VLAN via nmcli wrapper
    let nmcliResult: { name: string; success: boolean; error?: string };
    try {
      nmcliResult = createVlan({
        parentInterface,
        vlanId: vid,
        name: vlanName,
        mtu: mtuVal !== 1500 ? mtuVal : undefined,
        ipAddress,
        netmask,
        gateway: gateway || undefined,
      });
    } catch (e: any) {
      return NextResponse.json(
        { success: false, error: { code: 'OS_ERROR', message: `Failed to create VLAN: ${e.message}` } },
        { status: 500 }
      );
    }

    if (!nmcliResult.success) {
      const errMsg = nmcliResult.error || 'Unknown error';
      if (errMsg.toLowerCase().includes('already exists')) {
        return NextResponse.json(
          { success: false, error: { code: 'EXISTS', message: `VLAN ${vid} on ${parentInterface} already exists` } },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { success: false, error: { code: 'OS_ERROR', message: `Failed to create VLAN: ${errMsg}` } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: ipAddress
        ? `VLAN ${vid} (${vlanName}) created on ${parentInterface} with IP ${ipAddress}`
        : `VLAN ${vid} (${vlanName}) created on ${parentInterface}`,
      data: {
        name: vlanName,
        parent: parentInterface,
        vlanId: vid,
        mtu: mtuVal,
        state: 'up',
        ...(ipAddress ? { ipAddress, netmask: netmask || '255.255.255.0' } : {}),
      },
    });
  } catch (error: any) {
    if (error.message?.includes('Invalid')) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID', message: error.message } },
        { status: 400 }
      );
    }
    console.error('[Network OS API] VLAN create error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'OS_ERROR', message: `Failed to create VLAN: ${error.message}` } },
      { status: 500 }
    );
  }
}

// ──────────────────────────────────────────────
// DELETE — Delete a VLAN interface via nmcli
// ──────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let vlanName = searchParams.get('name');

    // Also try to parse from body if not in query
    if (!vlanName) {
      try {
        const body = await request.json();
        vlanName = body.name;
      } catch {
        // No body
      }
    }

    if (!vlanName || typeof vlanName !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'VLAN name is required (query param or body)' } },
        { status: 400 }
      );
    }

    // Delete via nmcli wrapper (with inline fallback)
    try {
      deleteVlan(vlanName);
    } catch (e: any) {
      console.warn(`[Network OS API] nmcli deleteVlan failed for ${vlanName}: ${e.message}, trying inline fallback`);
      safeExec(`sudo nmcli con down "${vlanName}" 2>/dev/null || true`);
      safeExec(`sudo nmcli con delete "${vlanName}" 2>/dev/null`);
    }

    return NextResponse.json({
      success: true,
      message: `VLAN ${vlanName} deleted successfully`,
    });
  } catch (error: any) {
    console.error('[Network OS API] VLAN delete error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'OS_ERROR', message: 'Failed to delete VLAN' } },
      { status: 500 }
    );
  }
}
