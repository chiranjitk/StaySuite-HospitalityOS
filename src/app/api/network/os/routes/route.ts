import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { db } from '@/lib/db';
import { addRoute, removeRoute, withStaySuitePreserved } from '@/lib/network/nmcli';

function safeExec(cmd: string, timeout = 10000): string {
  try { return execSync(cmd, { encoding: 'utf-8', timeout }); } catch (e: any) { return e.stderr?.trim() || e.stdout?.trim() || ''; }
}

const TENANT_ID = 'tenant-1';
const PROPERTY_ID = 'property-1';

const VALID_NAME = /^[a-zA-Z0-9._-]+$/;

function isValidIPv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every(p => { const n = parseInt(p, 10); return !isNaN(n) && n >= 0 && n <= 255 && String(n) === p; });
}

function isValidDestination(dest: string): boolean {
  const parts = dest.split('/');
  if (parts.length !== 2 && parts.length !== 1) return false;
  if (!isValidIPv4(parts[0])) return false;
  if (parts.length === 2) {
    const cidr = parseInt(parts[1], 10);
    if (isNaN(cidr) || cidr < 0 || cidr > 32) return false;
  }
  return true;
}

interface RouteEntry {
  destination: string;
  gateway: string;
  interface: string;
  metric: number;
  protocol: string;
  isDefault: boolean;
}

/**
 * POST   /api/network/os/routes — Add a static route via nmcli
 * GET    /api/network/os/routes — Get all current routes (OS + DB)
 * DELETE /api/network/os/routes — Remove a route via nmcli
 *
 * Uses nmcli wrapper for Rocky Linux 10 NetworkManager.
 * Routes are managed per-connection via nmcli con mod +ipv4.routes/-ipv4.routes.
 */

// ──────────────────────────────────────────────────
// GET /api/network/os/routes — List all routes
// ──────────────────────────────────────────────────
export async function GET() {
  try {
    // 1. Get OS routes via nmcli -j route show or ip route
    let osRoutes: RouteEntry[] = [];
    try {
      const output = safeExec('nmcli -j route show 2>/dev/null');
      if (output) {
        const parsed = JSON.parse(output);
        if (Array.isArray(parsed)) {
          for (const route of parsed) {
            const dest = route.dst || '';
            const gw = route.gw || '';
            const dev = route.dev || '';
            const metric = parseInt(route.metric, 10) || 0;
            const proto = route.proto || route.src ? 'static' : 'kernel';

            if (dest && gw) {
              osRoutes.push({
                destination: dest,
                gateway: gw,
                interface: dev,
                metric,
                protocol: proto,
                isDefault: dest === '0.0.0.0/0' || dest === 'default',
              });
            }
          }
        }
      }
    } catch {
      // Fallback to ip route
      try {
        const output = safeExec('ip -4 route show 2>/dev/null');
        for (const line of output.trim().split('\n').filter(Boolean)) {
          const parts = line.split(/\s+/);
          if (parts.length >= 3) {
            const dest = parts[0] || 'unknown';
            const gw = parts.find((p, i) => parts[i - 1] === 'via') || '';
            const dev = parts.find((p, i) => parts[i - 1] === 'dev') || '';
            const metricMatch = line.match(/metric\s+(\d+)/);
            const metric = metricMatch ? parseInt(metricMatch[1], 10) : 0;

            osRoutes.push({
              destination: dest,
              gateway: gw,
              interface: dev,
              metric,
              protocol: 'kernel',
              isDefault: dest === 'default',
            });
          }
        }
      } catch (e: any) {
        console.warn('[Network OS API] ip route fallback also failed:', e.message);
      }
    }

    // 2. Get DB routes
    let dbRoutes: any[] = [];
    try {
      dbRoutes = await db.staticRoute.findMany({
        where: { propertyId: PROPERTY_ID },
        orderBy: { metric: 'asc' },
      });
    } catch (dbErr: any) {
      console.warn('[Network OS API] DB fetch failed for static routes:', dbErr);
    }

    return NextResponse.json({
      success: true,
      data: {
        osRoutes,
        dbRoutes,
      },
    });
  } catch (error) {
    console.error('[Network OS API] Route list error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'OS_ERROR', message: 'Failed to list routes' } },
      { status: 500 }
    );
  }
}

// ──────────────────────────────────────────────────
// POST /api/network/os/routes — Add a static route
// ──────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { destination, gateway, interfaceName, metric, isDefault, name: routeName, description } = body;

    if (!destination && !isDefault) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'destination is required (or set isDefault=true)' } },
        { status: 400 }
      );
    }

    const routeDest = isDefault ? '0.0.0.0/0' : destination;
    if (routeDest && !isValidDestination(routeDest) && routeDest !== '0.0.0.0/0') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_DESTINATION', message: 'Invalid destination format (expected IP/CIDR)' } },
        { status: 400 }
      );
    }

    if (!gateway || !isValidIPv4(gateway)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_GATEWAY', message: 'A valid gateway IPv4 address is required' } },
        { status: 400 }
      );
    }

    if (!interfaceName || !VALID_NAME.test(interfaceName)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INTERFACE', message: 'Valid interfaceName is required' } },
        { status: 400 }
      );
    }

    const routeMetric = metric ? parseInt(String(metric), 10) : 100;
    if (isNaN(routeMetric) || routeMetric < 0 || routeMetric > 4294967295) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_METRIC', message: 'Metric must be a valid integer 0-4294967295' } },
        { status: 400 }
      );
    }

    const results: { step: string; success: boolean; message: string }[] = [];

    // 1. Add route at OS level via nmcli wrapper (with inline fallback)
    let addOk = false;
    try {
      addRoute(interfaceName, routeDest, gateway, routeMetric);
      addOk = true;
    } catch (e: any) {
      console.warn(`[Network OS API] nmcli addRoute failed: ${e.message}, trying inline fallback`);
      // Inline fallback: nmcli directly (with staysuite preservation)
      try {
        const metricArg = routeMetric ? ` ${routeMetric}` : '';
        withStaySuitePreserved(interfaceName, () => {
          safeExec(`sudo nmcli con mod "${interfaceName}" +ipv4.routes "${routeDest} ${gateway}${metricArg}"`);
        });
        addOk = true;
      } catch (fbErr: any) {
        console.warn(`[Network OS API] Inline fallback addRoute also failed: ${fbErr.message}`);
      }
    }

    results.push({
      step: 'add-route',
      success: addOk,
      message: addOk ? 'Route added via nmcli' : 'Failed to add route at OS level',
    });

    // 2. Save to DB (StaticRoute)
    if (addOk) {
      try {
        await db.staticRoute.create({
          data: {
            tenantId: TENANT_ID,
            propertyId: PROPERTY_ID,
            name: routeName || `route-${routeDest}-${gateway}`,
            destination: routeDest,
            gateway,
            metric: routeMetric,
            interfaceName,
            protocol: 'static',
            isDefault: !!isDefault,
            enabled: true,
            description: description || null,
          },
        });
        results.push({ step: 'database', success: true, message: 'Static route saved to database' });
      } catch (dbErr: any) {
        console.warn('[Network OS API] DB create failed for static route:', dbErr);
        results.push({ step: 'database', success: false, message: dbErr.message });
      }
    } else {
      results.push({ step: 'database', success: false, message: 'Skipped: OS route add did not succeed' });
    }

    return NextResponse.json({
      success: true,
      message: `Static route added: ${routeDest} via ${gateway}`,
      results,
      data: {
        destination: routeDest,
        gateway,
        interfaceName,
        metric: routeMetric,
        isDefault: !!isDefault,
        name: routeName || undefined,
        description: description || undefined,
      },
    });
  } catch (error) {
    console.error('[Network OS API] Route add error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'OS_ERROR', message: 'Failed to add route' } },
      { status: 500 }
    );
  }
}

// ──────────────────────────────────────────────────
// DELETE /api/network/os/routes — Remove a route
// ──────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const destination = searchParams.get('destination');
    const gateway = searchParams.get('gateway');
    const interfaceName = searchParams.get('interfaceName');

    if (!destination || !gateway) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: '"destination" and "gateway" query params are required' } },
        { status: 400 }
      );
    }

    if (!isValidIPv4(gateway)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_GATEWAY', message: 'Invalid gateway address' } },
        { status: 400 }
      );
    }

    const results: { step: string; success: boolean; message: string }[] = [];

    // 1. Remove route at OS level via nmcli wrapper (with inline fallback)
    let delOk = false;
    if (interfaceName) {
      try {
        removeRoute(interfaceName, destination, gateway);
        delOk = true;
      } catch (e: any) {
        console.warn(`[Network OS API] nmcli removeRoute failed: ${e.message}, trying inline fallback`);
        // Inline fallback: nmcli directly (with staysuite preservation)
        try {
          withStaySuitePreserved(interfaceName, () => {
            safeExec(`sudo nmcli con mod "${interfaceName}" -ipv4.routes "${destination} ${gateway}"`);
          });
          delOk = true;
        } catch (fbErr: any) {
          console.warn(`[Network OS API] Inline fallback removeRoute also failed: ${fbErr.message}`);
        }
      }
    }

    results.push({
      step: 'del-route',
      success: delOk,
      message: delOk ? 'Route removed via nmcli' : 'Failed to remove route at OS level',
    });

    // 2. Remove from DB
    try {
      const dbDest = destination === 'default' ? '0.0.0.0/0' : destination;
      await db.staticRoute.deleteMany({
        where: {
          propertyId: PROPERTY_ID,
          destination: dbDest,
          gateway,
        },
      });
      results.push({ step: 'database', success: true, message: 'Route removed from database' });
    } catch (dbErr: any) {
      console.warn('[Network OS API] DB delete failed for static route:', dbErr);
      results.push({ step: 'database', success: false, message: dbErr.message });
    }

    return NextResponse.json({
      success: true,
      message: `Route ${destination} via ${gateway} removed`,
      results,
    });
  } catch (error) {
    console.error('[Network OS API] Route delete error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'OS_ERROR', message: 'Failed to remove route' } },
      { status: 500 }
    );
  }
}
