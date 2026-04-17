import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { db } from '@/lib/db';
import { addRoute, removeRoute, withStaySuitePreserved } from '@/lib/network/nmcli';

function safeExec(cmd: string, timeout = 10000): string {
  try { return execSync(cmd, { encoding: 'utf-8', timeout }); } catch (e: any) { return e.stderr?.trim() || e.stdout?.trim() || ''; }
}

// ─── /etc/route persistence helpers ─────────────────────────────────────
const ROUTE_FILE = '/etc/route';
const ROUTE_FILE_HEADER = `# StaySuite Static Routes Configuration
# This file is managed by StaySuite-HospitalityOS
# Routes added here can be applied with: sudo ip route add <line>
# or source this file
`;

/** Ensure /etc/route exists with the proper header */
function ensureRouteFile(): boolean {
  try {
    if (!existsSync(ROUTE_FILE)) {
      writeFileSync(ROUTE_FILE, ROUTE_FILE_HEADER, { encoding: 'utf-8', mode: 0o644 });
      return true;
    }
    // Ensure header exists
    const content = readFileSync(ROUTE_FILE, 'utf-8');
    if (!content.includes('# StaySuite Static Routes Configuration')) {
      writeFileSync(ROUTE_FILE, ROUTE_FILE_HEADER + content, { encoding: 'utf-8' });
    }
    return true;
  } catch (err) {
    console.warn('[Network OS API] Failed to ensure /etc/route file:', err);
    return false;
  }
}

/** Append a route entry to /etc/route */
function persistRouteToFile(destination: string, gateway: string, interfaceName: string, metric: number, name?: string): boolean {
  try {
    ensureRouteFile();
    const timestamp = new Date().toISOString();
    const routeLine = `ip route add ${destination} via ${gateway} dev ${interfaceName}${metric ? ` metric ${metric}` : ''}`;
    const nameLine = name ? `# Name: ${name}\n` : '';
    const entry = `\n# StaySuite Static Route\n# Added: ${timestamp}\n${nameLine}${routeLine}\n`;
    execSync(`echo '${entry.replace(/'/g, "'\\''")}' | sudo tee -a ${ROUTE_FILE} > /dev/null`, { encoding: 'utf-8', timeout: 5000 });
    return true;
  } catch (err) {
    console.warn('[Network OS API] Failed to persist route to /etc/route:', err);
    return false;
  }
}

/** Remove a route entry from /etc/route by destination + gateway */
function removeRouteFromFile(destination: string, gateway: string, interfaceName?: string): boolean {
  try {
    // Read file via sudo since it may be root-owned
    const readResult = execSync(`sudo cat ${ROUTE_FILE} 2>/dev/null`, { encoding: 'utf-8', timeout: 5000 });
    if (!readResult) return true;
    const content = readResult;
    const lines = content.split('\n');
    const newLines: string[] = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      // Check if this line matches the route pattern (with or without 'ip route add' prefix)
      // Match: [ip route add] DEST via GW [dev IFACE] [metric N]
      const routePattern = new RegExp(`^(?:ip route add\\s+)?${escapeRegExp(destination)}\\s+via\\s+${escapeRegExp(gateway)}(\\s+dev\\s+${interfaceName ? escapeRegExp(interfaceName) + '\\b' : '\\S+'})`);
      if (routePattern.test(line.trim())) {
        // Walk backwards through newLines to remove comment header for this route
        while (newLines.length > 0 && newLines[newLines.length - 1].trimStart().startsWith('#') && newLines[newLines.length - 1].trim() !== '') {
          // Stop if we hit the file header or another route entry
          if (newLines[newLines.length - 1].includes('StaySuite Static Routes Configuration')) break;
          newLines.pop();
        }
        // Skip trailing empty line if present
        if (i + 1 < lines.length && lines[i + 1].trim() === '') {
          i += 2;
        } else {
          i += 1;
        }
      } else {
        newLines.push(line);
        i += 1;
      }
    }
    // Clean up trailing empty lines (keep at most one)
    while (newLines.length > 1 && newLines[newLines.length - 1].trim() === '' && newLines[newLines.length - 2].trim() === '') {
      newLines.pop();
    }
    // Write back via sudo since file may be root-owned
    const newContent = newLines.join('\n');
 execSync(`echo '${newContent.replace(/'/g, "'\\\\''")}' | sudo tee ${ROUTE_FILE} > /dev/null`, { encoding: 'utf-8', timeout: 5000 });
    return true;
  } catch (err) {
    console.warn('[Network OS API] Failed to remove route from /etc/route:', err);
    return false;
  }
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
          // Bring connection up to activate the route
          safeExec(`sudo nmcli con up "${interfaceName}"`);
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

    // 2. Persist route to /etc/route file for cross-boot persistence
    if (addOk) {
      const persistOk = persistRouteToFile(routeDest, gateway, interfaceName, routeMetric, routeName || undefined);
      results.push({
        step: 'persist-file',
        success: persistOk,
        message: persistOk ? 'Route persisted to /etc/route' : 'Failed to persist route to /etc/route',
      });
    }

    // 3. Save to DB (StaticRoute)
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

    // 0. If no interfaceName provided, try to find it from DB
    let resolvedInterfaceName = interfaceName;
    if (!resolvedInterfaceName) {
      try {
        const dbDest = destination === 'default' ? '0.0.0.0/0' : destination;
        const dbRoute = await db.staticRoute.findFirst({
          where: { propertyId: PROPERTY_ID, destination: dbDest, gateway },
        });
        if (dbRoute?.interfaceName) {
          resolvedInterfaceName = dbRoute.interfaceName;
        }
      } catch { /* ignore */ }
    }

    // 1. Remove route at OS level via nmcli wrapper (with inline fallback)
    let delOk = false;
    if (resolvedInterfaceName) {
      try {
        removeRoute(resolvedInterfaceName, destination, gateway);
        delOk = true;
      } catch (e: any) {
        console.warn(`[Network OS API] nmcli removeRoute failed: ${e.message}, trying inline fallback`);
        // Inline fallback: nmcli directly (with staysuite preservation)
        try {
          withStaySuitePreserved(resolvedInterfaceName, () => {
            safeExec(`sudo nmcli con mod "${resolvedInterfaceName}" -ipv4.routes "${destination} ${gateway}"`);
            // Bring connection up to apply the route removal
            safeExec(`sudo nmcli con up "${resolvedInterfaceName}"`);
          });
          delOk = true;
        } catch (fbErr: any) {
          console.warn(`[Network OS API] Inline fallback removeRoute also failed: ${fbErr.message}`);
        }
      }
    } else {
      console.warn(`[Network OS API] No interfaceName for route ${destination} via ${gateway} — cannot remove at OS level`);
    }

    results.push({
      step: 'del-route',
      success: delOk,
      message: delOk ? `Route removed via nmcli (interface: ${resolvedInterfaceName})` : 'Failed to remove route at OS level (no interface name)',
    });

    // 2. Always try to remove from /etc/route persistence file (even if OS removal failed)
    const persistOk = removeRouteFromFile(destination, gateway, resolvedInterfaceName || undefined);
    results.push({
      step: 'persist-file',
      success: persistOk,
      message: persistOk ? 'Route removed from /etc/route' : 'Failed to remove route from /etc/route',
    });

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
