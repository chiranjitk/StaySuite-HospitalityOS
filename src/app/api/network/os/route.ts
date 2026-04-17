import { NextRequest, NextResponse } from 'next/server';
import { scanConnections, getDeviceStatus } from '@/lib/network/nmcli';
import { NET_TYPES, NET_TYPE_LABELS, netTypeToLabel } from '@/lib/network/nettypes';

/**
 * GET /api/network/os — Scan .nmconnection files and return all network interfaces
 *
 * On Rocky Linux 10, this scans /etc/NetworkManager/system-connections/*.nmconnection
 * files, parses the [staysuite] section for nettype (role mapping), and merges with
 * nmcli device status for runtime state.
 *
 * Query params:
 *   ?section=interfaces    → Only interfaces
 *   ?section=device-status → Only device runtime status
 *   ?section=all           → Everything (default)
 */

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const section = searchParams.get('section');

    if (section === 'device-status') {
      return NextResponse.json({ success: true, data: getDeviceStatus() });
    }

    // Scan .nmconnection files
    const interfaces = scanConnections();

    // Group by nettype
    const byNetType: Record<string, typeof interfaces> = {};
    for (const iface of interfaces) {
      const label = iface.nettypeLabel;
      if (!byNetType[label]) byNetType[label] = [];
      byNetType[label].push(iface);
    }

    // Filter types
    const physical = interfaces.filter(i => i.isPhysical);
    const virtual = interfaces.filter(i => !i.isPhysical);
    const vlans = interfaces.filter(i => i.type === 'vlan');
    const bridges = interfaces.filter(i => i.type === 'bridge');
    const bonds = interfaces.filter(i => i.type === 'bond');

    if (section === 'interfaces') {
      return NextResponse.json({ success: true, data: interfaces });
    }

    return NextResponse.json({
      success: true,
      data: {
        interfaces,
        byNetType,
        physical,
        virtual,
        vlans,
        bridges,
        bonds,
        deviceStatus: getDeviceStatus(),
        netTypes: Object.fromEntries(
          Object.entries(NET_TYPES).map(([k, v]) => [k, { value: v, label: NET_TYPE_LABELS[v] }])
        ),
      },
    });
  } catch (error) {
    console.error('[Network OS API] Scan error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SCAN_ERROR', message: 'Failed to scan network connections' } },
      { status: 500 }
    );
  }
}
