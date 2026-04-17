import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';

/**
 * POST /api/network/os/interfaces/[name]/mtu - Set MTU on an interface
 * POST /api/network/os/interfaces/[name]/up - Bring interface up
 * POST /api/network/os/interfaces/[name]/down - Bring interface down
 */

function safeExec(cmd: string, timeout = 5000): string {
  try { return execSync(cmd, { encoding: 'utf-8', timeout }); } catch (e: any) { return e.stdout || ''; }
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

    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ACTION', message: 'Specify mtu, action=up, or action=down' } },
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
