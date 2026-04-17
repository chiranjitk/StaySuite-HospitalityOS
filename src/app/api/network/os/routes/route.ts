import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  addRoute,
  deleteRoute,
  addDefaultRoute,
  listRoutes,
  RouteInfo,
} from '@/lib/network/route';
import {
  persistRouteAdd,
  persistRouteRemove,
} from '@/lib/network/persist';

/**
 * POST   /api/network/os/routes — Add a static route
 * GET    /api/network/os/routes — Get all current routes (OS + DB)
 * DELETE /api/network/os/routes — Remove a route
 *
 * Uses shell script wrappers from @/lib/network for OS-level operations.
 * Persists to /etc/network/interfaces via persist.sh and StaticRoute in DB.
 */

const TENANT_ID = 'tenant-1';
const PROPERTY_ID = 'property-1';

const VALID_NAME = /^[a-zA-Z0-9._-]+$/;

function isValidIPv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every(p => { const n = parseInt(p, 10); return !isNaN(n) && n >= 0 && n <= 255 && String(n) === p; });
}

/**
 * Validate a CIDR destination (e.g., 10.0.0.0/24, 0.0.0.0/0, or 192.168.1.0/32)
 */
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

// ──────────────────────────────────────────────────
// GET /api/network/os/routes — List all routes
// ──────────────────────────────────────────────────
export async function GET() {
  try {
    // 1. Get OS routes via shell script wrapper
    const listResult = listRoutes();
    const osRoutes: RouteInfo[] = (listResult.success && listResult.data)
      ? listResult.data.routes
      : [];

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

    const routeDest = isDefault ? 'default' : destination;
    if (routeDest !== 'default' && !isValidDestination(routeDest)) {
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

    // 1. Add route at OS level via shell script wrapper
    if (isDefault) {
      const addResult = addDefaultRoute(gateway, interfaceName);
      results.push({
        step: 'add-route',
        success: addResult.success,
        message: addResult.success ? 'Default route added' : addResult.error || 'Failed to add default route',
      });
    } else {
      const addResult = addRoute({ destination: routeDest, gateway, metric: routeMetric, interface: interfaceName });
      results.push({
        step: 'add-route',
        success: addResult.success,
        message: addResult.success ? 'Route added' : addResult.error || 'Failed to add route',
      });
    }

    // 2. Persist to /etc/network/interfaces via shell script wrapper
    const destForFile = routeDest === 'default' ? 'default' : routeDest;
    const persistResult = persistRouteAdd({ interface: interfaceName, destination: destForFile, gateway });
    results.push({
      step: 'file-persist',
      success: persistResult.success,
      message: persistResult.success
        ? `Route persisted to interfaces file`
        : persistResult.error || 'Failed to persist route',
    });

    // 3. Save to DB (StaticRoute) — only if OS route add succeeded
    if (results[0].success) {
      try {
        const dbDest = isDefault ? '0.0.0.0/0' : routeDest;
        await db.staticRoute.create({
          data: {
            tenantId: TENANT_ID,
            propertyId: PROPERTY_ID,
            name: routeName || `route-${dbDest}-${gateway}`,
            destination: dbDest,
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

    // 1. Remove route at OS level via shell script wrapper
    const delResult = deleteRoute(destination, gateway);
    results.push({
      step: 'del-route',
      success: delResult.success,
      message: delResult.success ? 'Route deleted' : delResult.error || 'Failed to delete route',
    });

    // 2. Remove from /etc/network/interfaces via shell script wrapper
    const destForFile = (destination === 'default' || destination === '0.0.0.0/0') ? 'default' : destination;
    if (interfaceName) {
      const persistResult = persistRouteRemove(interfaceName, destForFile, gateway);
      results.push({
        step: 'file-remove',
        success: persistResult.success,
        message: persistResult.success
          ? 'Route removed from interfaces file'
          : persistResult.error || 'Failed to remove route from file',
      });
    } else {
      results.push({ step: 'file-remove', success: false, message: 'Skipped: no interfaceName provided' });
    }

    // 3. Remove from DB
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
