import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { createVlan, deleteVlan, listVlans } from '@/lib/network';

function safeExec(cmd: string, timeout = 10000): string {
  try { return execSync(cmd, { encoding: 'utf-8', timeout }); } catch (e: any) { return e.stderr?.trim() || e.stdout?.trim() || ''; }
}

/**
 * GET  /api/network/os/vlans — List VLAN interfaces from the OS
 * POST /api/network/os/vlans — Create a VLAN interface on the OS
 * DELETE /api/network/os/vlans — Delete a VLAN interface from the OS
 *
 * Tries shell script first, falls back to inline ip commands.
 */

// ──────────────────────────────────────────────
// GET — List VLAN interfaces
// ──────────────────────────────────────────────
export async function GET() {
  try {
    // Try shell script first
    try {
      const result = listVlans();
      if (result.success && result.data && Array.isArray(result.data.vlans)) {
        return NextResponse.json({ success: true, data: result.data.vlans });
      }
    } catch (e) {
      console.warn('[Network OS API] VLAN list script failed, using inline fallback');
    }

    // Inline fallback: parse ip link show type vlan
    const vlans: { name: string; parent: string; vlanId: number; state: string }[] = [];
    const output = safeExec('ip -o link show type vlan 2>/dev/null');
    for (const line of output.trim().split('\n').filter(Boolean)) {
      const match = line.match(/(\S+).*link\/(\S+).*vlan id (\d+)/);
      if (match) {
        const stateMatch = line.match(/state (\w+)/);
        vlans.push({
          name: match[1],
          parent: match[2],
          vlanId: parseInt(match[3], 10),
          state: stateMatch?.[1] || 'UNKNOWN',
        });
      }
    }
    return NextResponse.json({ success: true, data: vlans });
  } catch (error: any) {
    console.error('[Network OS API] VLAN list error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'OS_ERROR', message: 'Failed to list VLANs' } },
      { status: 500 }
    );
  }
}

// ──────────────────────────────────────────────
// POST — Create a VLAN interface
// ──────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { parentInterface, vlanId, mtu, name } = body;

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

    // Auto-generate VLAN name if not provided
    const vlanName = name || `${parentInterface}.${vid}`;
    const mtuVal = mtu ? parseInt(String(mtu), 10) : 1500;

    // Try shell script first
    let scriptSuccess = false;
    let scriptError = '';
    try {
      const result = createVlan({
        parentInterface,
        vlanId: vid,
        name: vlanName,
        mtu: mtuVal,
      });
      if (result.success) {
        scriptSuccess = true;
      } else {
        scriptError = result.error || 'Script failed';
        console.warn(`[Network OS API] VLAN create script failed: ${scriptError}, using inline fallback`);
      }
    } catch (e: any) {
      scriptError = e.message || String(e);
      console.warn(`[Network OS API] VLAN create script error: ${scriptError}, using inline fallback`);
    }

    // Inline fallback: use ip link add directly
    if (!scriptSuccess) {
      const mtuCmd = mtuVal && mtuVal !== 1500 ? ` && sudo ip link set ${vlanName} mtu ${mtuVal}` : '';
      const cmd = `sudo ip link add link ${parentInterface} name ${vlanName} type vlan id ${vid}${mtuCmd} && sudo ip link set ${vlanName} up`;
      const output = safeExec(cmd);
      if (output.includes('already exists') || output.includes('exists')) {
        return NextResponse.json(
          { success: false, error: { code: 'EXISTS', message: `VLAN ${vid} on ${parentInterface} already exists` } },
          { status: 409 }
        );
      }
      if (output.includes('Cannot find') || output.includes('No such device') || output.includes('not found')) {
        return NextResponse.json(
          { success: false, error: { code: 'OS_ERROR', message: `Parent interface ${parentInterface} not found. ${output}` } },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `VLAN ${vid} (${vlanName}) created on ${parentInterface}`,
      data: {
        name: vlanName,
        parent: parentInterface,
        vlanId: vid,
        mtu: mtuVal,
        state: 'up',
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
// DELETE — Delete a VLAN interface
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

    // Try shell script first
    let scriptSuccess = false;
    try {
      const result = deleteVlan(vlanName);
      if (result.success) {
        scriptSuccess = true;
      } else {
        console.warn(`[Network OS API] VLAN delete script failed: ${result.error}, using inline fallback`);
      }
    } catch (e) {
      console.warn('[Network OS API] VLAN delete script error, using inline fallback');
    }

    // Inline fallback
    if (!scriptSuccess) {
      safeExec(`sudo ip link del ${vlanName} 2>/dev/null`);
    }

    return NextResponse.json({
      success: true,
      message: `VLAN ${vlanName} deleted successfully`,
    });
  } catch (error: any) {
    if (error.message?.includes('Invalid')) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID', message: error.message } },
        { status: 400 }
      );
    }
    console.error('[Network OS API] VLAN delete error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'OS_ERROR', message: 'Failed to delete VLAN' } },
      { status: 500 }
    );
  }
}
