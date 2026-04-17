import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';

/**
 * POST /api/network/os/vlans - Create a VLAN interface on the OS
 * GET /api/network/os/vlans - List VLAN interfaces from the OS
 */

function safeExec(cmd: string, timeout = 5000): string {
  try { return execSync(cmd, { encoding: 'utf-8', timeout }); } catch { return ''; }
}

export async function GET() {
  try {
    const output = safeExec('ip -o link show type vlan 2>/dev/null');
    const vlans: any[] = [];
    for (const line of output.trim().split('\n').filter(Boolean)) {
      const match = line.match(/:\s*(\S+).*vlan\s+id\s+(\d+)/);
      if (match) {
        vlans.push({ name: match[1], vlanId: parseInt(match[2]) });
      }
    }
    return NextResponse.json({ success: true, data: vlans });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: 'OS_ERROR', message: 'Failed to list VLANs' } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { parentInterface, vlanId, mtu } = body;

    if (!parentInterface || !vlanId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'parentInterface and vlanId are required' } },
        { status: 400 }
      );
    }

    // Security: validate inputs
    if (!/^[a-zA-Z0-9._-]+$/.test(parentInterface)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID', message: 'Invalid parent interface name' } },
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

    const vlanName = `${parentInterface}.${vid}`;
    const output = safeExec(`sudo ip link add link ${parentInterface} name ${vlanName} type vlan id ${vid} 2>&1`);

    if (mtu && mtu >= 68 && mtu <= 9000) {
      safeExec(`sudo ip link set dev ${vlanName} mtu ${mtu} 2>&1`);
    }
    safeExec(`sudo ip link set dev ${vlanName} up 2>&1`);

    return NextResponse.json({
      success: true,
      message: `VLAN ${vid} created on ${parentInterface}`,
      output: output.trim(),
    });
  } catch (error) {
    console.error('[Network OS API] VLAN create error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'OS_ERROR', message: 'Failed to create VLAN' } },
      { status: 500 }
    );
  }
}
