import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import * as fs from 'fs';
import { db } from '@/lib/db';

/**
 * POST   /api/network/os/routes — Add a static route
 * GET    /api/network/os/routes — Get all current routes (OS + DB)
 * DELETE /api/network/os/routes — Remove a route
 *
 * Uses `sudo ip route add/del/show` on Debian 13 to manage static routes.
 * Persists to /etc/network/interfaces (up/down commands) and StaticRoute in DB.
 */

function safeExec(cmd: string, timeout = 5000): string {
  try { return execSync(cmd, { encoding: 'utf-8', timeout }); } catch (e: any) { return e.stdout || ''; }
}

const INTERFACES_FILE = process.env.NETWORK_INTERFACES_FILE || '/etc/network/interfaces';
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

/**
 * Persist route as up/down commands inside the interface stanza
 * in /etc/network/interfaces.
 */
function persistRouteToFile(
  ifaceName: string,
  destination: string,
  gateway: string,
  metric: number,
): { success: boolean; message: string } {
  try {
    let content = '';
    try {
      content = fs.readFileSync(INTERFACES_FILE, 'utf-8');
    } catch {
      content = '# /etc/network/interfaces — managed by StaySuite HospitalityOS\n\nsource /etc/network/interfaces.d/*\n\n';
    }

    const lines = content.split('\n');
    const marker = `# STAYSUITE_ROUTE ${destination} via ${gateway}`;
    const upLine = `\tup ip route add ${destination} via ${gateway} dev ${ifaceName} metric ${metric}`;
    const downLine = `\tdown ip route del ${destination} via ${gateway} dev ${ifaceName} metric ${metric} 2>/dev/null || true`;

    // Check if already present
    const alreadyExists = lines.some(l => l.trim().includes(marker));
    if (alreadyExists) {
      return { success: true, message: 'Route already present in interfaces file' };
    }

    // Find the iface stanza and append inside it
    let stanzaEnd = -1;
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      const ifaceMatch = trimmed.match(/^iface\s+([a-zA-Z0-9._:-]+)\s+inet\s+(\S+)/);
      if (ifaceMatch && ifaceMatch[1] === ifaceName) {
        for (let j = i + 1; j < lines.length; j++) {
          const nextTrimmed = lines[j].trim();
          if (nextTrimmed === '' || nextTrimmed.match(/^(?:auto|allow-hotplug|iface|source)\s/)) {
            stanzaEnd = j;
            break;
          }
        }
        if (stanzaEnd === -1) stanzaEnd = lines.length;
        break;
      }
    }

    if (stanzaEnd > 0) {
      lines.splice(stanzaEnd, 0, marker, upLine, downLine);
    } else {
      // No stanza found — append
      if (lines.length > 0 && lines[lines.length - 1].trim() !== '') {
        lines.push('');
      }
      lines.push(`iface ${ifaceName} inet manual`);
      lines.push(marker);
      lines.push(upLine);
      lines.push(downLine);
      lines.push('');
    }

    fs.writeFileSync(INTERFACES_FILE, lines.join('\n'), 'utf-8');
    return { success: true, message: `Route persisted to ${INTERFACES_FILE}` };
  } catch (err: any) {
    return { success: false, message: `File write error: ${err.message}` };
  }
}

/**
 * Remove route entry from /etc/network/interfaces.
 */
function removeRouteFromFile(
  destination: string,
  gateway: string,
): { success: boolean; message: string } {
  try {
    let content = '';
    try {
      content = fs.readFileSync(INTERFACES_FILE, 'utf-8');
    } catch {
      return { success: true, message: 'No interfaces file to update' };
    }

    const lines = content.split('\n');
    const escapedDest = destination.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedGw = gateway.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const resultLines = lines.filter(line => {
      const trimmed = line.trim();
      // Remove marker
      if (trimmed.includes(`STAYSUITE_ROUTE ${destination}`)) return false;
      // Remove up/down route lines
      if (trimmed.match(new RegExp(`^(?:up|down)\\s+ip\\s+route\\s+(?:add|del)\\s+${escapedDest}\\s+via\\s+${escapedGw}`))) {
        return false;
      }
      return true;
    });

    fs.writeFileSync(INTERFACES_FILE, resultLines.join('\n'), 'utf-8');
    return { success: true, message: `Route removed from ${INTERFACES_FILE}` };
  } catch (err: any) {
    return { success: false, message: `File write error: ${err.message}` };
  }
}

/**
 * Parse a single line of `ip route show` output into a structured object.
 */
function parseRouteLine(line: string): Record<string, any> {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 2) return {};

  const route: Record<string, any> = {
    destination: parts[0],
    gateway: null,
    interfaceName: null,
    metric: null,
    protocol: 'kernel',
    raw: line.trim(),
  };

  for (let i = 1; i < parts.length; i++) {
    if (parts[i] === 'via' && parts[i + 1]) {
      route.gateway = parts[i + 1];
      i++;
    } else if (parts[i] === 'dev' && parts[i + 1]) {
      route.interfaceName = parts[i + 1];
      i++;
    } else if (parts[i] === 'metric' && parts[i + 1]) {
      route.metric = parseInt(parts[i + 1], 10);
      i++;
    } else if (parts[i] === 'proto' && parts[i + 1]) {
      route.protocol = parts[i + 1];
      i++;
    }
  }

  // Flag default routes
  route.isDefault = route.destination === 'default';

  return route;
}

// ──────────────────────────────────────────────────
// GET /api/network/os/routes — List all routes
// ──────────────────────────────────────────────────
export async function GET() {
  try {
    // 1. Get OS routes
    const output = safeExec('ip route show 2>/dev/null');
    const osRoutes = output.trim().split('\n').filter(Boolean).map(parseRouteLine).filter(r => r.destination);

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

    // 1. Add route at OS level
    let cmd: string;
    if (routeDest === 'default') {
      cmd = `sudo ip route add default via ${gateway} dev ${interfaceName} metric ${routeMetric} 2>&1`;
    } else {
      cmd = `sudo ip route add ${routeDest} via ${gateway} dev ${interfaceName} metric ${routeMetric} 2>&1`;
    }
    const addOutput = safeExec(cmd);
    if (addOutput.includes('File exists') || addOutput.includes('Network is unreachable')) {
      // Route may already exist — non-fatal
      results.push({ step: 'add-route', success: false, message: addOutput.trim() || 'Route may already exist' });
    } else {
      results.push({ step: 'add-route', success: true, message: addOutput.trim() });
    }

    // 2. Persist to /etc/network/interfaces
    const destForFile = routeDest === 'default' ? 'default' : routeDest;
    const fileResult = persistRouteToFile(interfaceName, destForFile, gateway, routeMetric);
    results.push({ step: 'file-persist', ...fileResult });

    // 3. Save to DB (StaticRoute)
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

    // 1. Remove route at OS level
    let cmd: string;
    if (destination === 'default' || destination === '0.0.0.0/0') {
      cmd = `sudo ip route del default via ${gateway}${interfaceName ? ` dev ${interfaceName}` : ''} 2>&1`;
    } else {
      cmd = `sudo ip route del ${destination} via ${gateway}${interfaceName ? ` dev ${interfaceName}` : ''} 2>&1`;
    }
    const delOutput = safeExec(cmd);
    results.push({ step: 'del-route', success: true, message: delOutput.trim() });

    // 2. Remove from /etc/network/interfaces
    const destForFile = (destination === 'default' || destination === '0.0.0.0/0') ? 'default' : destination;
    const fileResult = removeRouteFromFile(destForFile, gateway);
    results.push({ step: 'file-remove', ...fileResult });

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
