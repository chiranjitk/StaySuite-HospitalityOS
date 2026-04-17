import { NextRequest, NextResponse } from 'next/server';
import { createVlan, deleteVlan, listVlans } from '@/lib/network';

/**
 * GET  /api/network/os/vlans — List VLAN interfaces from the OS
 * POST /api/network/os/vlans — Create a VLAN interface on the OS
 * DELETE /api/network/os/vlans — Delete a VLAN interface from the OS
 *
 * All OS operations go through shell script wrappers in @/lib/network.
 */

// ──────────────────────────────────────────────
// GET — List VLAN interfaces
// ──────────────────────────────────────────────
export async function GET() {
  try {
    const result = listVlans();

    if (!result.success || !result.data) {
      return NextResponse.json(
        { success: false, error: { code: 'OS_ERROR', message: result.error || 'Failed to list VLANs' } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: result.data.vlans });
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

    const result = createVlan({
      parentInterface,
      vlanId: vid,
      name: vlanName,
      mtu: mtu ? parseInt(String(mtu), 10) : undefined,
    });

    if (!result.success) {
      const errMsg = result.error || 'Failed to create VLAN';
      if (errMsg.toLowerCase().includes('already exists')) {
        return NextResponse.json(
          { success: false, error: { code: 'EXISTS', message: `VLAN ${vid} on ${parentInterface} already exists` } },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { success: false, error: { code: 'OS_ERROR', message: errMsg } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `VLAN ${vid} created on ${parentInterface}`,
      data: result.data,
    });
  } catch (error: any) {
    // Catch validation errors thrown by the wrapper (sanitizeInterfaceName, validateVlanId, validateMtu)
    if (error.message?.includes('Invalid')) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID', message: error.message } },
        { status: 400 }
      );
    }
    console.error('[Network OS API] VLAN create error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'OS_ERROR', message: 'Failed to create VLAN' } },
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

    const result = deleteVlan(vlanName);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: { code: 'OS_ERROR', message: result.error || 'Failed to delete VLAN' } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `VLAN ${vlanName} deleted successfully`,
      data: result.data,
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
