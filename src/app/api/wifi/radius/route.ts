/**
 * RADIUS Integration API Route
 * 
 * Proxies requests to the RADIUS management service running on port 3010.
 * Provides endpoints for:
 * - Service status and control (start/stop/restart)
 * - Connection testing
 * - Configuration export/import
 * - Statistics & monitoring
 * - Accounting records
 * - WiFi sessions
 * - RADIUS server logs
 * - Guest provisioning/deprovisioning (check-in/check-out)
 * - SQL module configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requirePermission, hasPermission } from '@/lib/auth/tenant-context';
import { db } from '@/lib/db';

const RADIUS_SERVICE_URL = process.env.RADIUS_SERVICE_URL || 'http://localhost:3010';

/**
 * Fix radacct DateTime columns that FreeRADIUS fills with empty strings ""
 * instead of NULL. Prisma expects NULL or valid ISO dates — empty strings
 * cause P2023 parse errors which silently trigger the fallback path
 * (querying empty LiveSession/RadiusAuthLog tables → no data shown).
 *
 * Called once on first request, then cached.
 */
let radacctCleaned = false;
async function ensureRadacctClean() {
  if (radacctCleaned) return;
  try {
    // SQLite doesn't support multi-statement executeRawUnsafe well.
    // Run each UPDATE individually to avoid "Execute returned results" errors.
    const cleanups = [
      // PostgreSQL: cast timestamptz to text before comparing to empty string / zero-date
      // SQLite would accept plain `= ''` but PG rejects implicit cast from text to timestamptz
      "UPDATE radacct SET acctstoptime = NULL WHERE acctstoptime::text IN ('', '0000-00-00 00:00:00')",
      "UPDATE radacct SET acctstarttime = NULL WHERE acctstarttime::text IN ('', '0000-00-00 00:00:00')",
      "UPDATE radacct SET acctupdatetime = NULL WHERE acctupdatetime::text IN ('', '0000-00-00 00:00:00')",
      // acctinterval is BigInt, not timestamp — compare as text for empty/zero values
      "UPDATE radacct SET acctinterval = NULL WHERE acctinterval::text IN ('', '0')",
      "UPDATE radacct SET connectinfo_start = NULL WHERE connectinfo_start = ''",
      "UPDATE radacct SET connectinfo_stop = NULL WHERE connectinfo_stop = ''",
    ];
    for (const sql of cleanups) {
      await db.$executeRawUnsafe(sql);
    }
    radacctCleaned = true;
  } catch (e) {
    // Table might not exist yet; don't block requests
    console.warn('[radacct] Cleanup warning:', e instanceof Error ? e.message : e);
  }
}

// Helper to make requests to RADIUS management service
async function freeradiusRequest(endpoint: string, options: RequestInit = {}) {
  const url = `${RADIUS_SERVICE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const errorBody = await response.text();
    let parsedError;
    try {
      parsedError = JSON.parse(errorBody);
    } catch {
      parsedError = { error: errorBody };
    }
    return { success: false, status: response.status, ...parsedError };
  }
  
  return response.json();
}

// Read-only actions that can be accessed with either wifi.manage OR reports.view
const VIEW_ACTIONS = new Set([
  'auth-logs', 'auth-logs-stats',
  'live-sessions-list', 'live-sessions-get', 'live-sessions-stats',
  'user-usage-summary', 'user-usage-detail',
  'accounting', 'accounting-status', 'accounting-db', 'active-accounting',
  'sessions', 'active-sessions',
  'logs',
  'stats',
  'coa-logs', 'coa-audit-list', 'coa-audit-stats',
  'nas-health-current', 'nas-health-list', 'nas-health-stats',
  'concurrent-sessions', 'concurrent-violations',
]);

// GET /api/wifi/radius - Get RADIUS service data
export async function GET(request: NextRequest) {
  // First authenticate
  const context = await requireAuth(request);
  if (context instanceof NextResponse) return context;

  // Determine required permission based on action
  const action = request.nextUrl.searchParams.get('action');
  if (!action) {
    return NextResponse.json({ success: false, error: 'Missing action parameter' }, { status: 400 });
  }

  // View-only actions accept either wifi.manage OR reports.view
  const isViewAction = VIEW_ACTIONS.has(action);
  if (isViewAction) {
    if (!hasPermission(context, 'wifi.manage') && !hasPermission(context, 'reports.view')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied: requires wifi.manage or reports.view' },
        { status: 403 }
      );
    }
  } else {
    // Management actions require wifi.manage
    if (!hasPermission(context, 'wifi.manage')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied: requires wifi.manage' },
        { status: 403 }
      );
    }
  }

  try {
    const searchParams = request.nextUrl.searchParams;

    switch (action) {
      case 'status': {
        const data = await freeradiusRequest('/api/status');
        return NextResponse.json(data);
      }

      case 'stats': {
        const data = await freeradiusRequest('/api/stats');
        return NextResponse.json(data);
      }

      case 'config': {
        const data = await freeradiusRequest('/api/config/export');
        return NextResponse.json(data);
      }

      case 'default': {
        const data = await freeradiusRequest('/api/config/default');
        return NextResponse.json(data);
      }

      case 'groups': {
        const data = await freeradiusRequest('/api/groups');
        return NextResponse.json(data);
      }

      // ─── Users: Query from v_wifi_users view ───────────────────
      // Direct DB query for reliability — does not depend on freeradius-service.
      case 'users': {
        try {
          const propertyId = searchParams.get('propertyId');
          const status = searchParams.get('status');

          const conditions: string[] = [];
          const sqlParams: unknown[] = [];
          if (propertyId) { conditions.push(`"propertyId" = $${sqlParams.length + 1}`); sqlParams.push(propertyId); }
          if (status) { conditions.push(`status = $${sqlParams.length + 1}`); sqlParams.push(status); }
          const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

          const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(`
            SELECT id, "tenantId", "propertyId", "guestId", "bookingId", username, "planId",
                   status, "authMethod", "macAddress", "validFrom", "validUntil",
                   "totalBytesIn", "totalBytesOut", "sessionCount", "lastSeenAt",
                   "createdAt", "updatedAt",
                   radius_password, radius_group,
                   guest_first_name, guest_last_name, guest_email, guest_phone,
                   guest_loyalty_tier, guest_is_vip,
                   room_number, room_name, room_floor,
                   property_name, plan_name,
                   plan_download_speed, plan_upload_speed, plan_data_limit,
                   booking_code, booking_status, booking_check_in, booking_check_out
            FROM v_wifi_users ${whereClause}
            ORDER BY "createdAt" DESC
          `, ...sqlParams);

          const users = rows.map((row) => ({
            id: row.id,
            username: row.username || '',
            password: row.radius_password || '',
            group: row.radius_group || '',
            attributes: row.planId ? {
              'WISPr-Bandwidth-Max-Down': String(row.plan_download_speed || 0),
              'WISPr-Bandwidth-Max-Up': String(row.plan_upload_speed || 0),
              'Session-Timeout': '',
            } : {},
            downloadSpeed: Number(row.plan_download_speed || 0),
            uploadSpeed: Number(row.plan_upload_speed || 0),
            sessionTimeout: 0,
            dataLimit: row.plan_data_limit ? Number(row.plan_data_limit) : 0,
            createdAt: row.createdAt ? String(row.createdAt) : '',
            updatedAt: row.updatedAt ? String(row.updatedAt) : '',
            guestId: row.guestId || '',
            bookingId: row.bookingId || '',
            userType: row.authMethod || 'guest',
            status: row.status || 'active',
            validUntil: row.validUntil ? String(row.validUntil) : '',
            fupPolicy: null,
            // Enriched fields
            guest_first_name: row.guest_first_name || '',
            guest_last_name: row.guest_last_name || '',
            room_number: row.room_number || '',
            property_name: row.property_name || '',
            plan_name: row.plan_name || '',
            totalBytesIn: Number(row.totalBytesIn || 0),
            totalBytesOut: Number(row.totalBytesOut || 0),
            sessionCount: Number(row.sessionCount || 0),
          }));

          const safeUsers = JSON.parse(JSON.stringify(users, (_, v) => typeof v === 'bigint' ? Number(v) : v));
          return NextResponse.json({ success: true, data: safeUsers });
        } catch (error) {
          console.error('[users] Direct query error:', error);
          // Fallback to freeradius-service
          try {
            const data = await freeradiusRequest('/api/users');
            return NextResponse.json(data);
          } catch {
            return NextResponse.json({ success: true, data: [] });
          }
        }
      }

      case 'accounting': {
        const limit = searchParams.get('limit') || '100';
        const offset = searchParams.get('offset') || '0';
        const username = searchParams.get('username') || '';
        const nasIp = searchParams.get('nasIp') || '';
        const status = searchParams.get('status') || '';
        const queryParams = new URLSearchParams({ limit, offset });
        if (username) queryParams.set('username', username);
        if (nasIp) queryParams.set('nasIp', nasIp);
        if (status) queryParams.set('status', status);
        const data = await freeradiusRequest(`/api/accounting?${queryParams.toString()}`);
        return NextResponse.json(data);
      }

      case 'sessions': {
        const limit = searchParams.get('limit') || '50';
        const data = await freeradiusRequest(`/api/sessions?limit=${limit}`);
        return NextResponse.json(data);
      }

      case 'active-sessions': {
        const data = await freeradiusRequest('/api/sessions/active');
        return NextResponse.json(data);
      }

      case 'accounting-status': {
        const data = await freeradiusRequest('/api/accounting/status');
        return NextResponse.json(data);
      }

      case 'active-accounting': {
        const data = await freeradiusRequest('/api/accounting/active');
        return NextResponse.json(data);
      }

      case 'logs': {
        const lines = searchParams.get('lines') || '50';
        const data = await freeradiusRequest(`/api/logs?lines=${lines}`);
        return NextResponse.json(data);
      }

      // ─── Auth Logs: Query from v_session_history view ─────────────
      // The view joins radacct with StaySuite tables (Guest, Room, Property, Plan).
      // Every accounting Start represents a successful authentication.
      case 'auth-logs': {
        try {
          const limitStr = searchParams.get('limit') || '100';
          const limit = Math.min(parseInt(limitStr, 10) || 100, 500);
          const resultFilter = searchParams.get('result');
          const startDateStr = searchParams.get('startDate');
          const endDateStr = searchParams.get('endDate');
          const usernameFilter = searchParams.get('username');

          if (resultFilter === 'Access-Reject') {
            // Rejects won't appear in radacct (they don't get accounting)
            return NextResponse.json({ success: true, data: [] });
          }

          // Build SQL conditions on the view
          const conditions: string[] = [];
          const sqlParams: unknown[] = [];
          if (usernameFilter) { conditions.push(`username LIKE $${sqlParams.length + 1}`); sqlParams.push(`%${usernameFilter}%`); }
          if (startDateStr) { conditions.push(`acctstarttime >= $${sqlParams.length + 1}::timestamptz`); sqlParams.push(startDateStr); }
          if (endDateStr) { conditions.push(`acctstarttime <= $${sqlParams.length + 1}::timestamptz`); sqlParams.push(`${endDateStr} 23:59:59`); }
          const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
          sqlParams.push(limit);

          const authEvents = await db.$queryRawUnsafe<{
            radacctid: number;
            acctuniqueid: string;
            username: string;
            nasipaddress: string;
            callingstationid: string;
            acctstarttime: string | null;
            nasporttype: string | null;
            calledstationid: string;
            guest_first_name: string | null;
            guest_last_name: string | null;
            room_number: string | null;
            property_name: string | null;
            plan_name: string | null;
          }[]>(`
            SELECT MIN(radacctid) as radacctid, acctuniqueid,
                   MAX(username) as username, MAX(nasipaddress) as nasipaddress,
                   MAX(callingstationid) as callingstationid, MAX(acctstarttime) as acctstarttime,
                   MAX(nasporttype) as nasporttype, MAX(calledstationid) as calledstationid,
                   MAX(guest_first_name) as guest_first_name,
                   MAX(guest_last_name) as guest_last_name,
                   MAX(room_number) as room_number,
                   MAX(property_name) as property_name,
                   MAX(plan_name) as plan_name
            FROM v_session_history ${whereClause}
            GROUP BY acctuniqueid
            ORDER BY MAX(acctstarttime) DESC
            LIMIT $${sqlParams.length}
          `, ...sqlParams);

          const logs = authEvents.map((e) => ({
            id: `auth_${e.radacctid}`,
            timestamp: e.acctstarttime || '',
            username: e.username || '',
            authResult: 'Access-Accept',
            authType: e.nasporttype || 'PAP',
            nasIpAddress: e.nasipaddress || '',
            callingStationId: e.callingstationid || '',
            replyMessage: e.plan_name ? `Plan: ${e.plan_name}` : 'Authenticated successfully',
            // Enriched fields from view
            guestName: [e.guest_first_name, e.guest_last_name].filter(Boolean).join(' ') || '',
            roomNumber: e.room_number || '',
            propertyName: e.property_name || '',
            planName: e.plan_name || '',
          }));

          return NextResponse.json({ success: true, data: logs });
        } catch (error) {
          console.error('[auth-logs] Direct query error:', error);
          const queryParams = new URLSearchParams();
          const params = ['limit', 'offset', 'username', 'result', 'startDate', 'endDate'];
          for (const p of params) {
            const v = searchParams.get(p);
            if (v) queryParams.set(p, v);
          }
          const data = await freeradiusRequest(`/api/auth-logs?${queryParams.toString()}`);
          return NextResponse.json(data);
        }
      }

      // ─── Auth Logs Stats: Query from v_session_history view ──────
      case 'auth-logs-stats': {
        try {
          const usernameFilter = searchParams.get('username');
          const resultFilter = searchParams.get('result');
          const startDateStr = searchParams.get('startDate');
          const endDateStr = searchParams.get('endDate');

          // Build SQL conditions on the view
          const conditions: string[] = [];
          const params: unknown[] = [];
          if (usernameFilter) { conditions.push(`username LIKE $${params.length + 1}`); params.push(`%${usernameFilter}%`); }
          if (startDateStr) { conditions.push(`acctstarttime >= $${params.length + 1}::timestamptz`); params.push(startDateStr); }
          if (endDateStr) { conditions.push(`acctstarttime <= $${params.length + 1}::timestamptz`); params.push(`${endDateStr} 23:59:59`); }
          const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

          const totalAuths = Number((await db.$queryRawUnsafe<{ c: number | bigint }[]>(
            `SELECT COUNT(DISTINCT acctuniqueid) as c FROM v_session_history ${whereClause}`,
            ...params
          ))[0]?.c ?? 0);

          // All records in the view are successful auths (rejects don't get accounting)
          const acceptCount = resultFilter === 'Access-Reject' ? 0 : totalAuths;
          const rejectCount = 0;
          const successRate = totalAuths > 0 ? 100 : 0;

          // Calculate 24h trend using separate queries
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const dayBefore = new Date();
          dayBefore.setDate(dayBefore.getDate() - 2);

          const nextParamIdx = params.length + 1;
          const todayWhere = conditions.length > 0
            ? `${whereClause} AND acctstarttime >= $${nextParamIdx}::timestamptz`
            : `WHERE acctstarttime >= $${nextParamIdx}::timestamptz`;
          const todayParams = [...params, yesterday.toISOString().slice(0, 10)];

          const prevDayWhere = conditions.length > 0
            ? `${whereClause} AND acctstarttime >= $${params.length + 1}::timestamptz AND acctstarttime < $${params.length + 2}::timestamptz`
            : `WHERE acctstarttime >= $${params.length + 1}::timestamptz AND acctstarttime < $${params.length + 2}::timestamptz`;
          const prevDayParams = [...params, dayBefore.toISOString().slice(0, 10), yesterday.toISOString().slice(0, 10)];

          // Calculate 24h trend — wrap in try/catch so basic stats always return
          let last24hTrend = 0;
          try {
            const todayCount = Number((await db.$queryRawUnsafe<{ c: number | bigint }[]>(
              `SELECT COUNT(DISTINCT acctuniqueid) as c FROM v_session_history ${todayWhere}`,
              ...todayParams
            ))[0]?.c ?? 0);

            const prevDayCount = Number((await db.$queryRawUnsafe<{ c: number | bigint }[]>(
              `SELECT COUNT(DISTINCT acctuniqueid) as c FROM v_session_history ${prevDayWhere}`,
              ...prevDayParams
            ))[0]?.c ?? 0);

            last24hTrend = prevDayCount > 0
              ? Math.round(((todayCount - prevDayCount) / prevDayCount) * 100)
              : (todayCount > 0 ? 100 : 0);
          } catch (trendErr) {
            console.error('[auth-logs-stats] Trend calculation error (non-fatal):', trendErr);
            // Return basic stats without trend
          }

          return NextResponse.json({
            success: true,
            data: {
              totalAuths,
              acceptCount,
              rejectCount,
              successRate,
              last24hTrend,
            },
          });
        } catch (error) {
          console.error('[auth-logs-stats] Direct query error:', error);
          // Return zero stats instead of crashing or depending on freeradius-service
          return NextResponse.json({
            success: true,
            data: {
              totalAuths: 0,
              acceptCount: 0,
              rejectCount: 0,
              successRate: 0,
              last24hTrend: 0,
            },
          });
        }
      }

      case 'mac-auth': {
        const queryParams = new URLSearchParams();
        const params = ['propertyId', 'status'];
        for (const p of params) {
          const v = searchParams.get(p);
          if (v) queryParams.set(p, v);
        }
        const data = await freeradiusRequest(`/api/mac-auth?${queryParams.toString()}`);
        return NextResponse.json(data);
      }

      case 'check-mac': {
        const mac = searchParams.get('mac');
        if (!mac) {
          return NextResponse.json({ success: false, error: 'MAC address is required' }, { status: 400 });
        }
        const data = await freeradiusRequest(`/api/mac-auth/check`, {
          method: 'POST',
          body: JSON.stringify({ macAddress: mac }),
        });
        return NextResponse.json(data);
      }

      case 'event-users': {
        const queryParams = new URLSearchParams();
        const params = ['eventId', 'status'];
        for (const p of params) {
          const v = searchParams.get(p);
          if (v) queryParams.set(p, v);
        }
        const data = await freeradiusRequest(`/api/event-users?${queryParams.toString()}`);
        return NextResponse.json(data);
      }

      case 'portal-whitelist': {
        const queryParams = new URLSearchParams();
        const propertyId = searchParams.get('propertyId');
        if (propertyId) queryParams.set('propertyId', propertyId);
        const data = await freeradiusRequest(`/api/portal-whitelist?${queryParams.toString()}`);
        return NextResponse.json(data);
      }

      case 'coa-logs': {
        const queryParams = new URLSearchParams();
        const params = ['limit', 'offset'];
        for (const p of params) {
          const v = searchParams.get(p);
          if (v) queryParams.set(p, v);
        }
        const data = await freeradiusRequest(`/api/coa/logs?${queryParams.toString()}`);
        return NextResponse.json(data);
      }

      case 'accounting-db': {
        const queryParams = new URLSearchParams();
        const params = ['limit', 'offset', 'username', 'nasIpAddress', 'framedIpAddress', 'callingStationId', 'status', 'startDate', 'endDate'];
        for (const p of params) {
          const v = searchParams.get(p);
          if (v) queryParams.set(p, v);
        }
        const data = await freeradiusRequest(`/api/accounting/db?${queryParams.toString()}`);
        return NextResponse.json(data);
      }

      case 'data-cap-check': {
        const username = searchParams.get('username');
        if (!username) {
          return NextResponse.json({ success: false, error: 'Username is required' }, { status: 400 });
        }
        const data = await freeradiusRequest(`/api/data-cap/check?username=${encodeURIComponent(username)}`);
        return NextResponse.json(data);
      }

      case 'sql-mod-config': {
        const data = await freeradiusRequest('/api/config/sql-mod');
        return NextResponse.json(data);
      }

      // ─── New endpoints ─────────────────────────────────────────
      case 'concurrent-sessions': {
        const data = await freeradiusRequest('/api/concurrent-sessions');
        return NextResponse.json(data);
      }

      case 'concurrent-violations': {
        const data = await freeradiusRequest('/api/concurrent-sessions/violations');
        return NextResponse.json(data);
      }

      case 'provisioning-logs': {
        const queryParams = new URLSearchParams();
        const params = ['limit', 'offset', 'result', 'username'];
        for (const p of params) {
          const v = searchParams.get(p);
          if (v) queryParams.set(p, v);
        }
        // Forward action filter (from dropdown) as 'action' param to backend
        const filterAction = searchParams.get('filterAction');
        if (filterAction) queryParams.set('action', filterAction);
        const data = await freeradiusRequest(`/api/provisioning-logs?${queryParams.toString()}`);
        return NextResponse.json(data);
      }

      case 'provisioning-logs-stats': {
        const data = await freeradiusRequest('/api/provisioning-logs/stats');
        return NextResponse.json(data);
      }

      case 'content-filter':
      case 'content-filters': {  // alias — frontend uses plural
        const queryParams = new URLSearchParams();
        const params = ['propertyId', 'category', 'enabled'];
        for (const p of params) {
          const v = searchParams.get(p);
          if (v) queryParams.set(p, v);
        }
        const data = await freeradiusRequest(`/api/content-filter?${queryParams.toString()}`);
        return NextResponse.json(data);
      }

      case 'test-content-filter': {
        const url = searchParams.get('url');
        if (!url) {
          return NextResponse.json({ success: false, error: 'URL is required' }, { status: 400 });
        }
        // Test URL against content filter rules by checking pattern matching
        const queryParams = new URLSearchParams({ url });
        const data = await freeradiusRequest(`/api/content-filter/test?${queryParams.toString()}`);
        return NextResponse.json(data);
      }

      case 'content-filter-export': {
        const data = await freeradiusRequest('/api/content-filter/export');
        return NextResponse.json(data);
      }

      case 'guest-wifi-link': {
        const queryParams = new URLSearchParams();
        const guestId = searchParams.get('guestId');
        const username = searchParams.get('username');
        if (guestId) queryParams.set('guestId', guestId);
        if (username) queryParams.set('username', username);
        const data = await freeradiusRequest(`/api/guest-wifi-link?${queryParams.toString()}`);
        return NextResponse.json(data);
      }

      case 'bandwidth-schedules': {
        const queryParams = new URLSearchParams();
        const params = ['propertyId', 'enabled'];
        for (const p of params) {
          const v = searchParams.get(p);
          if (v) queryParams.set(p, v);
        }
        const data = await freeradiusRequest(`/api/bandwidth-schedules?${queryParams.toString()}`);
        return NextResponse.json(data);
      }

      // ─── Active Users: Query from v_active_sessions view ──────────
      // The view joins radacct with StaySuite tables and filters for active sessions.
      case 'live-sessions-list': {
        try {
          const username = searchParams.get('username');
          const nasIp = searchParams.get('nasIp');
          const status = searchParams.get('status');

          // Build SQL conditions on the view
          const conditions: string[] = ["session_status = 'active'"];
          const sqlParams: unknown[] = [];
          if (username) { conditions.push(`username LIKE $${sqlParams.length + 1}`); sqlParams.push(`%${username}%`); }
          if (nasIp) { conditions.push(`nasipaddress LIKE $${sqlParams.length + 1}`); sqlParams.push(`%${nasIp}%`); }
          const whereClause = `WHERE ${conditions.join(' AND ')}`;

          const activeSessions = await db.$queryRawUnsafe<{
            acctuniqueid: string;
            acctsessionid: string;
            username: string;
            framedipaddress: string | null;
            callingstationid: string | null;
            nasipaddress: string | null;
            calledstationid: string | null;
            acctstarttime: string | null;
            acctupdatetime: string | null;
            acctsessiontime: number | null;
            acctinputoctets: number | null;
            acctoutputoctets: number | null;
            nasporttype: string | null;
            guest_first_name: string | null;
            guest_last_name: string | null;
            room_number: string | null;
            property_name: string | null;
            plan_name: string | null;
            downloadspeed: number | null;
            uploadspeed: number | null;
          }[]>(`
            SELECT acctuniqueid, acctsessionid, username, framedipaddress,
                   callingstationid, nasipaddress, calledstationid,
                   acctstarttime, acctupdatetime, acctsessiontime,
                   acctinputoctets, acctoutputoctets, nasporttype,
                   guest_first_name, guest_last_name, room_number,
                   property_name, plan_name, downloadspeed, uploadspeed
            FROM v_active_sessions ${whereClause}
            ORDER BY acctstarttime DESC
          `, ...sqlParams);

          const sessions = activeSessions.map((s) => ({
            id: `ls_${s.acctuniqueid}`,
            username: s.username || '',
            ipAddress: s.framedipaddress || '',
            macAddress: s.callingstationid || '',
            nasIp: s.nasipaddress || '',
            nasIdentifier: s.calledstationid || '',
            deviceType: '',
            operatingSystem: '',
            manufacturer: '',
            bandwidthDown: s.downloadspeed != null ? `${Number(s.downloadspeed)} Mbps` : null,
            bandwidthUp: s.uploadspeed != null ? `${Number(s.uploadspeed)} Mbps` : null,
            sessionTime: Number(s.acctsessiontime || 0),
            dataDownload: Number(s.acctoutputoctets || 0),
            dataUpload: Number(s.acctinputoctets || 0),
            status: 'active' as const,
            startedAt: s.acctstarttime || '',
            lastSeenAt: s.acctupdatetime || '',
            sessionTimeout: null,
            idleTimeout: null,
            planName: s.plan_name || '',
            roomId: s.room_number || '',
            // Enriched fields from view
            guestName: [s.guest_first_name, s.guest_last_name].filter(Boolean).join(' ') || '',
            propertyName: s.property_name || '',
          }));

          const safeSessions = JSON.parse(JSON.stringify(sessions, (_, v) => typeof v === 'bigint' ? Number(v) : v));
          return NextResponse.json({ success: true, data: safeSessions });
        } catch (error) {
          console.error('[live-sessions-list] Direct query error:', error);
          // Fallback to proxy if query fails
          const queryParams = new URLSearchParams();
          const params = ['propertyId', 'status', 'nasId', 'limit', 'offset'];
          for (const p of params) {
            const v = searchParams.get(p);
            if (v) queryParams.set(p, v);
          }
          const data = await freeradiusRequest(`/api/live-sessions?${queryParams.toString()}`);
          if (data.success && Array.isArray(data.data)) {
            data.data = data.data.map((s: Record<string, unknown>) => ({
              id: s.id,
              username: s.username,
              ipAddress: s.framedIpAddress || s.clientIpAddress || '',
              macAddress: s.macAddress || '',
              nasIp: s.nasIpAddress || '',
              nasIdentifier: s.nasIdentifier || '',
              deviceType: s.deviceType || '',
              operatingSystem: s.operatingSystem || '',
              manufacturer: s.manufacturer || '',
              bandwidthDown: s.bandwidthDown ? `${s.bandwidthDown} Mbps` : null,
              bandwidthUp: s.bandwidthUp ? `${s.bandwidthUp} Mbps` : null,
              sessionTime: s.currentSessionTime || 0,
              dataDownload: s.currentOutputBytes || 0,
              dataUpload: s.currentInputBytes || 0,
              status: s.status || 'active',
              startedAt: s.startedAt || '',
              lastSeenAt: s.lastInterimUpdate || s.updatedAt || '',
              sessionTimeout: s.sessionTimeout || null,
              idleTimeout: s.idleTimeout || null,
              planName: s.planId || '',
              roomId: s.roomNo || '',
            }));
          }
          return NextResponse.json(data);
        }
      }

      case 'live-sessions-get': {
        const username = searchParams.get('username');
        if (!username) {
          return NextResponse.json({ success: false, error: 'Username is required' }, { status: 400 });
        }
        const data = await freeradiusRequest(`/api/live-sessions/${encodeURIComponent(username)}`);
        return NextResponse.json(data);
      }

      // ─── Live Sessions Stats: Query from v_active_sessions view ──
      case 'live-sessions-stats': {
        try {
          const activeRecords = await db.$queryRawUnsafe<{
            nasipaddress: string | null;
            calledstationid: string | null;
            acctoutputoctets: number | null;
            acctinputoctets: number | null;
          }[]>(`
            SELECT nasipaddress, calledstationid, COALESCE(acctoutputoctets, 0) as acctoutputoctets, COALESCE(acctinputoctets, 0) as acctinputoctets
            FROM v_active_sessions
            WHERE session_status = 'active'
          `);

          const totalActive = activeRecords.length;
          // Group by NAS IP for per-NAS breakdown
          const nasMap = new Map<string, { nasIdentifier: string; count: number }>();
          let totalDownload = 0;
          let totalUpload = 0;

          for (const r of activeRecords) {
            totalDownload += Number(r.acctoutputoctets);
            totalUpload += Number(r.acctinputoctets);
            const key = r.nasipaddress || 'unknown';
            const existing = nasMap.get(key);
            if (existing) {
              existing.count++;
            } else {
              nasMap.set(key, { nasIdentifier: r.calledstationid || '', count: 1 });
            }
          }

          return NextResponse.json({
            success: true,
            data: {
              totalActive,
              peakToday: totalActive,
              perNas: Array.from(nasMap.entries()).map(([nasIp, info]) => ({
                nasIp,
                nasIdentifier: info.nasIdentifier,
                count: info.count,
              })),
              totalDownload,
              totalUpload,
            },
          });
        } catch (error) {
          console.error('[live-sessions-stats] Direct query error:', error);
          // Fallback to proxy
          const queryParams = new URLSearchParams();
          const propertyId = searchParams.get('propertyId');
          if (propertyId) queryParams.set('propertyId', propertyId);
          const data = await freeradiusRequest(`/api/live-sessions/stats?${queryParams.toString()}`);
          if (data.success && data.data) {
            data.data = {
              totalActive: data.data.totalActive || 0,
              peakToday: data.data.peakToday || data.data.totalActive || 0,
              peakTodayTime: data.data.peakTodayTime || null,
              perNas: (data.data.nasCounts || []).map((n: { nasIpAddress: string; nasIdentifier?: string; cnt: number }) => ({
                nasIp: n.nasIpAddress,
                nasIdentifier: n.nasIdentifier || '',
                count: n.cnt,
              })),
              totalDownload: data.data.totalDownloadBytes || 0,
              totalUpload: data.data.totalUploadBytes || 0,
            };
          }
          return NextResponse.json(data);
        }
      }

      // ─── Accsium Gap: CoA Audit ─────────────────────────────
      case 'coa-audit-list': {
        const queryParams = new URLSearchParams();
        const params = ['propertyId', 'status', 'limit', 'offset', 'startDate', 'endDate', 'username', 'coaType', 'result'];
        for (const p of params) {
          const v = searchParams.get(p);
          if (v) queryParams.set(p, v);
        }
        const data = await freeradiusRequest(`/api/coa-audit?${queryParams.toString()}`);
        return NextResponse.json(data);
      }

      case 'coa-audit-stats': {
        const queryParams = new URLSearchParams();
        const propertyId = searchParams.get('propertyId');
        if (propertyId) queryParams.set('propertyId', propertyId);
        const data = await freeradiusRequest(`/api/coa-audit/stats?${queryParams.toString()}`);
        return NextResponse.json(data);
      }

      // ─── Accsium Gap: FAP Policies ──────────────────────────
      case 'fap-policies-list': {
        const queryParams = new URLSearchParams();
        const params = ['propertyId', 'enabled', 'limit', 'offset'];
        for (const p of params) {
          const v = searchParams.get(p);
          if (v) queryParams.set(p, v);
        }
        const data = await freeradiusRequest(`/api/fap-policies?${queryParams.toString()}`);
        return NextResponse.json(data);
      }

      // ─── Accsium Gap: Web Categories ────────────────────────
      case 'web-categories-list': {
        const queryParams = new URLSearchParams();
        const params = ['propertyId', 'enabled', 'limit', 'offset'];
        for (const p of params) {
          const v = searchParams.get(p);
          if (v) queryParams.set(p, v);
        }
        const data = await freeradiusRequest(`/api/web-categories?${queryParams.toString()}`);
        return NextResponse.json(data);
      }

      case 'web-category-schedules-list': {
        const id = searchParams.get('id');
        if (!id) {
          return NextResponse.json({ success: false, error: 'Category ID is required' }, { status: 400 });
        }
        const data = await freeradiusRequest(`/api/web-categories/${encodeURIComponent(id)}/schedules`);
        return NextResponse.json(data);
      }

      // ─── Accsium Gap: User Status History ───────────────────
      case 'user-status-history-list': {
        const queryParams = new URLSearchParams();
        const params = ['propertyId', 'username', 'limit', 'offset', 'startDate', 'endDate'];
        for (const p of params) {
          const v = searchParams.get(p);
          if (v) queryParams.set(p, v);
        }
        const data = await freeradiusRequest(`/api/user-status-history?${queryParams.toString()}`);
        return NextResponse.json(data);
      }

      // ─── User Usage Summary: Query from v_user_usage view ────────
      // The view already aggregates per-user bandwidth, session counts, and time
      // from radacct, with enriched guest/room/property/plan data.
      case 'user-usage-summary': {
        try {
          const limitStr = searchParams.get('limit') || '20';
          const limit = Math.min(parseInt(limitStr, 10) || 20, 100);
          const sortBy = searchParams.get('sort') || 'download';
          const startDateStr = searchParams.get('startDate');
          const endDateStr = searchParams.get('endDate');

          // Build date filter on the view
          const conditions: string[] = [];
          const sqlParams: unknown[] = [];

          // Quick test: verify view is accessible
          const viewTest = await db.$queryRawUnsafe<{ c: number | bigint }[]>(
            'SELECT COUNT(*) as c FROM v_user_usage'
          );
          const viewCount = Number(viewTest[0]?.c ?? 0);
          if (viewCount === 0) {
            return NextResponse.json({ success: true, data: [], stats: { totalUsers: 0, totalBandwidth: 0, avgPerUser: 0, topUser: null }, _debug: 'view_empty' });
          }
          if (startDateStr) { conditions.push(`first_session_start >= $${sqlParams.length + 1}`); sqlParams.push(startDateStr); }
          if (endDateStr) { conditions.push(`first_session_start <= $${sqlParams.length + 1}`); sqlParams.push(`${endDateStr} 23:59:59`); }
          const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

          // Map sortBy to SQL column
          const orderByMap: Record<string, string> = {
            download: 'total_download_bytes DESC',
            upload: 'total_upload_bytes DESC',
            sessions: 'total_sessions DESC',
            sessionTime: 'total_session_time DESC',
          };
          const orderBy = orderByMap[sortBy] || orderByMap.download;

          // Get total user count for stats
          const totalUsersRow = await db.$queryRawUnsafe<{ c: number | bigint }[]>(
            `SELECT COUNT(*) as c FROM v_user_usage ${whereClause}`,
            ...sqlParams
          );
          const totalUsers = Number(totalUsersRow[0]?.c ?? 0);

          // Get paginated data
          sqlParams.push(limit);
          const usageRows = await db.$queryRawUnsafe<{
            username: string;
            total_sessions: number;
            active_sessions: number;
            total_download_bytes: number;
            total_upload_bytes: number;
            total_session_time: number;
            last_session_start: string | null;
            guest_first_name: string | null;
            guest_last_name: string | null;
            guest_email: string | null;
            room_number: string | null;
            property_name: string | null;
            plan_name: string | null;
            plan_download_speed: number | null;
            plan_upload_speed: number | null;
            plan_data_limit: number | null;
          }[]>(`
            SELECT username, total_sessions, active_sessions,
                   total_download_bytes, total_upload_bytes, total_session_time,
                   last_session_start,
                   guest_first_name, guest_last_name, guest_email,
                   room_number, property_name, plan_name,
                   plan_download_speed, plan_upload_speed, plan_data_limit
            FROM v_user_usage ${whereClause}
            ORDER BY ${orderBy}
            LIMIT $${sqlParams.length}
          `, ...sqlParams);

          // Map view columns to response format (camelCase) — BigInt-safe
          const sortedUsers = usageRows.map((r) => ({
            username: r.username,
            totalSessions: Number(r.total_sessions ?? 0),
            activeSessions: Number(r.active_sessions ?? 0),
            totalDownloadBytes: Number(r.total_download_bytes ?? 0),
            totalUploadBytes: Number(r.total_upload_bytes ?? 0),
            totalSessionTime: Number(r.total_session_time ?? 0),
            lastSeen: r.last_session_start || '',
            // Enriched fields from view
            guestName: [r.guest_first_name, r.guest_last_name].filter(Boolean).join(' ') || '',
            guestEmail: r.guest_email || '',
            roomNumber: r.room_number || '',
            propertyName: r.property_name || '',
            planName: r.plan_name || '',
            downloadSpeed: r.plan_download_speed,
            uploadSpeed: r.plan_upload_speed,
            dataLimit: r.plan_data_limit,
          }));

          // Overall stats
          const totalBandwidth = usageRows.reduce((sum, u) => sum + Number(u.total_download_bytes ?? 0) + Number(u.total_upload_bytes ?? 0), 0);
          const overallStats = {
            totalUsers,
            totalBandwidth,
            avgPerUser: totalUsers > 0 ? Math.round(totalBandwidth / totalUsers) : 0,
            topUser: sortedUsers.length > 0 ? sortedUsers[0].username : null,
          };

          return NextResponse.json({
            success: true,
            data: sortedUsers,
            stats: overallStats,
          });
        } catch (error) {
          console.error('[user-usage-summary] Direct query error:', error);
          const queryParams = new URLSearchParams();
          const params = ['limit', 'sort', 'startDate', 'endDate'];
          for (const p of params) {
            const v = searchParams.get(p);
            if (v) queryParams.set(p, v);
          }
          const data = await freeradiusRequest(`/api/user-usage/summary?${queryParams.toString()}`);
          return NextResponse.json(data);
        }
      }

      // ─── User Usage Detail: Query from v_session_history view ────
      case 'user-usage-detail': {
        try {
          const username = searchParams.get('username');
          if (!username) {
            return NextResponse.json({ success: false, error: 'Username is required' }, { status: 400 });
          }
          const startDateStr = searchParams.get('startDate');
          const endDateStr = searchParams.get('endDate');

          // Build SQL conditions on the view
          const conditions: string[] = [`username = $1`];
          const sqlParams: unknown[] = [username];
          if (startDateStr) { conditions.push(`acctstarttime >= $${sqlParams.length + 1}::timestamptz`); sqlParams.push(startDateStr); }
          if (endDateStr) { conditions.push(`acctstarttime <= $${sqlParams.length + 1}::timestamptz`); sqlParams.push(`${endDateStr} 23:59:59`); }
          const whereClause = `WHERE ${conditions.join(' AND ')}`;

          const userRecords = await db.$queryRawUnsafe<{
            radacctid: number;
            acctuniqueid: string;
            acctsessionid: string;
            username: string;
            nasipaddress: string | null;
            calledstationid: string | null;
            framedipaddress: string | null;
            callingstationid: string | null;
            acctstarttime: string | null;
            acctstoptime: string | null;
            acctsessiontime: number | null;
            acctinputoctets: number | null;
            acctoutputoctets: number | null;
            acctupdatetime: string | null;
            guest_first_name: string | null;
            guest_last_name: string | null;
            room_number: string | null;
            property_name: string | null;
            plan_name: string | null;
          }[]>(`
            SELECT radacctid, acctuniqueid, acctsessionid, username,
                   nasipaddress, calledstationid, framedipaddress, callingstationid,
                   acctstarttime, acctstoptime, acctsessiontime,
                   acctinputoctets, acctoutputoctets, acctupdatetime,
                   guest_first_name, guest_last_name, room_number,
                   property_name, plan_name
            FROM v_session_history ${whereClause}
            ORDER BY acctstarttime DESC
          `, ...sqlParams);

          // Build sessions list — BigInt-safe
          const sessions = userRecords.map((r) => ({
            id: r.acctuniqueid || r.acctsessionid,
            sessionId: r.acctsessionid,
            startedAt: r.acctstarttime || null,
            endedAt: r.acctstoptime || null,
            nasIp: r.nasipaddress,
            nasIdentifier: r.calledstationid || null,
            ipAddress: r.framedipaddress || '',
            macAddress: r.callingstationid || '',
            downloadBytes: Number(r.acctoutputoctets ?? 0),
            uploadBytes: Number(r.acctinputoctets ?? 0),
            sessionTime: Number(r.acctsessiontime ?? 0),
            isActive: !r.acctstoptime,
            // Enriched fields from view
            guestName: [r.guest_first_name, r.guest_last_name].filter(Boolean).join(' ') || '',
            roomNumber: r.room_number || '',
            propertyName: r.property_name || '',
            planName: r.plan_name || '',
          }));

          // Build daily usage breakdown
          const dailyMap = new Map<string, { downloadBytes: number; uploadBytes: number }>();
          for (const r of userRecords) {
            if (r.acctupdatetime) {
              const dateKey = r.acctupdatetime.split('T')[0];
              const existing = dailyMap.get(dateKey);
              if (existing) {
                existing.downloadBytes += Number(r.acctoutputoctets ?? 0);
                existing.uploadBytes += Number(r.acctinputoctets ?? 0);
              } else {
                dailyMap.set(dateKey, {
                  downloadBytes: Number(r.acctoutputoctets ?? 0),
                  uploadBytes: Number(r.acctinputoctets ?? 0),
                });
              }
            }
          }

          const dailyUsage = Array.from(dailyMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, bytes]) => ({
              date,
              dayLabel: (() => {
                try {
                  const dt = new Date(date);
                  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                } catch { return date; }
              })(),
              downloadBytes: bytes.downloadBytes,
              uploadBytes: bytes.uploadBytes,
              totalBytes: bytes.downloadBytes + bytes.uploadBytes,
            }));

          // Summary stats — BigInt-safe
          const totalDownloadBytes = userRecords.reduce((s, r) => s + Number(r.acctoutputoctets ?? 0), 0);
          const totalUploadBytes = userRecords.reduce((s, r) => s + Number(r.acctinputoctets ?? 0), 0);
          const totalSessionTime = userRecords.reduce((s, r) => s + Number(r.acctsessiontime ?? 0), 0);
          const activeSessions = userRecords.filter(r => !r.acctstoptime).length;

          const responseData = {
            success: true,
            data: {
              username,
              totalSessions: userRecords.length,
              activeSessions,
              totalDownloadBytes,
              totalUploadBytes,
              totalSessionTime,
              sessions,
              dailyUsage,
            },
          };

          return NextResponse.json(responseData);
        } catch (error) {
          console.error('[user-usage-detail] Direct query error:', error);
          const username = searchParams.get('username');
          if (!username) {
            return NextResponse.json({ success: false, error: 'Username is required' }, { status: 400 });
          }
          const detailParams = new URLSearchParams();
          const startDate = searchParams.get('startDate');
          const endDate = searchParams.get('endDate');
          if (startDate) detailParams.set('startDate', startDate);
          if (endDate) detailParams.set('endDate', endDate);
          const qs = detailParams.toString();
          const data = await freeradiusRequest(`/api/user-usage/${encodeURIComponent(username)}${qs ? '?' + qs : ''}`);
          if (data.success && data.data) {
            const backendData = data.data;
            if (Array.isArray(backendData.sessions)) {
              backendData.sessions = backendData.sessions.map((s: Record<string, unknown>) => ({
                id: s.acctuniqueid || s.acctsessionid || s.radacctid,
                sessionId: s.acctsessionid || '',
                startedAt: s.acctstarttime || null,
                endedAt: s.acctstoptime || null,
                nasIp: s.nasipaddress || '',
                nasIdentifier: null,
                ipAddress: s.framedipaddress || '',
                macAddress: s.callingstationid || '',
                downloadBytes: Number(s.acctoutputoctets) || 0,
                uploadBytes: Number(s.acctinputoctets) || 0,
                sessionTime: Number(s.acctsessiontime) || 0,
                isActive: s.status === 'active' || s.acctstoptime === null,
              }));
            }
            if (Array.isArray(backendData.dailyUsage)) {
              backendData.dailyUsage = backendData.dailyUsage.map((d: Record<string, unknown>) => ({
                date: d.date as string,
                dayLabel: d.date ? (() => {
                  try {
                    const dt = new Date(d.date as string);
                    return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                  } catch { return d.date as string; }
                })() : '',
                downloadBytes: Number(d.downloadBytes) || 0,
                uploadBytes: Number(d.uploadBytes) || 0,
                totalBytes: (Number(d.downloadBytes) || 0) + (Number(d.uploadBytes) || 0),
              }));
            }
            if (backendData.summary) {
              data.data = {
                username: backendData.username,
                totalSessions: backendData.summary.totalSessions || 0,
                activeSessions: backendData.summary.activeSessions || 0,
                totalDownloadBytes: backendData.summary.totalDownloadBytes || 0,
                totalUploadBytes: backendData.summary.totalUploadBytes || 0,
                totalSessionTime: backendData.summary.totalSessionTime || 0,
                sessions: backendData.sessions,
                dailyUsage: backendData.dailyUsage,
              };
            }
          }
          return NextResponse.json(data);
        }
      }

      // ─── Accsium Gap: NAS Health ────────────────────────────
      case 'nas-health-current': {
        const data = await freeradiusRequest('/api/nas-health/current');
        return NextResponse.json(data);
      }

      case 'nas-health-list': {
        const queryParams = new URLSearchParams();
        const params = ['propertyId', 'status', 'limit', 'offset'];
        for (const p of params) {
          const v = searchParams.get(p);
          if (v) queryParams.set(p, v);
        }
        const data = await freeradiusRequest(`/api/nas-health?${queryParams.toString()}`);
        return NextResponse.json(data);
      }

      case 'nas-health-stats': {
        const queryParams = new URLSearchParams();
        const propertyId = searchParams.get('propertyId');
        if (propertyId) queryParams.set('propertyId', propertyId);
        const data = await freeradiusRequest(`/api/nas-health/stats?${queryParams.toString()}`);
        return NextResponse.json(data);
      }

      // ─── Accsium Gap: BW Policy Details ─────────────────────
      case 'bw-policy-details-list': {
        const queryParams = new URLSearchParams();
        const params = ['bandwidthPolicyId', 'limit', 'offset'];
        for (const p of params) {
          const v = searchParams.get(p);
          if (v) queryParams.set(p, v);
        }
        const data = await freeradiusRequest(`/api/bw-policy-details?${queryParams.toString()}`);
        return NextResponse.json(data);
      }

      default: {
        // Default: return service status
        const data = await freeradiusRequest('/api/status');
        return NextResponse.json(data);
      }
    }
  } catch (error) {
    console.error('Error communicating with RADIUS service:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to communicate with RADIUS service',
        details: error instanceof Error ? error.message : 'Unknown error',
        hint: 'Make sure the RADIUS service is running on port 3010'
      },
      { status: 503 }
    );
  }
}

// POST /api/wifi/radius - Control RADIUS service or test connection
export async function POST(request: NextRequest) {
  const context = await requirePermission(request, 'wifi.manage');
  if (context instanceof NextResponse) return context;

  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'start': {
        const result = await freeradiusRequest('/api/service/start', { method: 'POST' });
        return NextResponse.json(result);
      }

      case 'stop': {
        const result = await freeradiusRequest('/api/service/stop', { method: 'POST' });
        return NextResponse.json(result);
      }

      case 'restart': {
        const result = await freeradiusRequest('/api/service/restart', { method: 'POST' });
        return NextResponse.json(result);
      }

      case 'test': {
        const result = await freeradiusRequest('/api/test', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'import': {
        const result = await freeradiusRequest('/api/config/import', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'generate-secret': {
        const result = await freeradiusRequest('/api/nas/generate-secret', { method: 'POST' });
        return NextResponse.json(result);
      }

      case 'sync': {
        const result = await freeradiusRequest('/api/sync', { method: 'POST' });
        return NextResponse.json(result);
      }

      case 'accounting-refresh': {
        const result = await freeradiusRequest('/api/accounting/refresh', { method: 'POST' });
        return NextResponse.json(result);
      }

      case 'sync-users': {
        const result = await freeradiusRequest('/api/sync/users', { method: 'POST' });
        return NextResponse.json(result);
      }

      case 'sync-clients': {
        const result = await freeradiusRequest('/api/sync/clients', { method: 'POST' });
        return NextResponse.json(result);
      }

      case 'coa-disconnect': {
        const result = await freeradiusRequest('/api/coa/disconnect', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'coa-bandwidth': {
        const result = await freeradiusRequest('/api/coa/bandwidth', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'coa-disconnect-all': {
        const result = await freeradiusRequest('/api/coa/disconnect-all', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'data-cap-enforce': {
        const result = await freeradiusRequest('/api/data-cap/enforce', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'data-cap-check-all': {
        const result = await freeradiusRequest('/api/data-cap/check-all', { method: 'POST' });
        return NextResponse.json(result);
      }

      case 'mac-auth-add':
      case 'create-mac-auth': {  // alias
        const result = await freeradiusRequest('/api/mac-auth', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'mac-auth-check':
      case 'check-mac': {  // alias
        const result = await freeradiusRequest('/api/mac-auth/check', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'event-users-bulk':
      case 'generate-event-users': {  // alias
        const result = await freeradiusRequest('/api/event-users/bulk', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'event-revoke':
      case 'revoke-event-user': {  // alias
        const eventUserId = data.id;
        if (!eventUserId) {
          return NextResponse.json({ success: false, error: 'Event user ID is required' }, { status: 400 });
        }
        const result = await freeradiusRequest(`/api/event-users/${encodeURIComponent(eventUserId)}/revoke`, { method: 'POST' });
        return NextResponse.json(result);
      }

      case 'portal-whitelist-add':
      case 'create-portal-whitelist': {  // alias
        const result = await freeradiusRequest('/api/portal-whitelist', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      // ─── MAC Auth: update, delete, import ────────────────────
      case 'update-mac-auth': {
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }
        const { id: _id, ...updateData } = data;
        const result = await freeradiusRequest(`/api/mac-auth/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: JSON.stringify(updateData),
        });
        return NextResponse.json(result);
      }

      case 'delete-mac-auth': {
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }
        const result = await freeradiusRequest(`/api/mac-auth/${encodeURIComponent(id)}`, { method: 'DELETE' });
        return NextResponse.json(result);
      }

      case 'import-mac-auth': {
        const result = await freeradiusRequest('/api/mac-auth/import', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      // ─── Event WiFi: create event ────────────────────────────
      case 'create-event': {
        const result = await freeradiusRequest('/api/event-users/event', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      // ─── Event WiFi: create single attendee ──────────────────
      case 'create-event-attendee': {
        const result = await freeradiusRequest('/api/event-users/attendee', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      // ─── Event WiFi: delete event ────────────────────────────
      case 'delete-event': {
        const eventId = data.eventId;
        if (!eventId) {
          return NextResponse.json({ success: false, error: 'eventId is required' }, { status: 400 });
        }
        const result = await freeradiusRequest(`/api/event-users/event/${encodeURIComponent(eventId)}`, { method: 'DELETE' });
        return NextResponse.json(result);
      }

      // ─── Portal Whitelist: update, delete, toggle ────────────
      case 'update-portal-whitelist': {
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }
        const { id: _id, ...updateData } = data;
        const result = await freeradiusRequest(`/api/portal-whitelist/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: JSON.stringify(updateData),
        });
        return NextResponse.json(result);
      }

      case 'delete-portal-whitelist': {
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }
        const result = await freeradiusRequest(`/api/portal-whitelist/${encodeURIComponent(id)}`, { method: 'DELETE' });
        return NextResponse.json(result);
      }

      case 'toggle-portal-whitelist': {
        const id = data.id;
        const enabled = data.enabled;
        if (!id) {
          return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }
        const result = await freeradiusRequest(`/api/portal-whitelist/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: JSON.stringify({ enabled }),
        });
        return NextResponse.json(result);
      }

      case 'auth-log-create': {
        const result = await freeradiusRequest('/api/auth-logs', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'create-user': {
        const result = await freeradiusRequest('/api/users', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'update-user': {
        const userId = data.id;
        if (!userId) {
          return NextResponse.json({ success: false, error: 'User id is required' }, { status: 400 });
        }
        const { id, ...updateData } = data;
        const result = await freeradiusRequest(`/api/users/${userId}`, {
          method: 'PUT',
          body: JSON.stringify(updateData),
        });
        return NextResponse.json(result);
      }

      case 'delete-user': {
        const userId = data.id;
        if (!userId) {
          return NextResponse.json({ success: false, error: 'User id is required' }, { status: 400 });
        }
        const result = await freeradiusRequest(`/api/users/${userId}`, { method: 'DELETE' });
        return NextResponse.json(result);
      }

      case 'provision': {
        const result = await freeradiusRequest('/api/provision', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'deprovision': {
        const username = data.username;
        if (!username) {
          return NextResponse.json({ success: false, error: 'Username is required' }, { status: 400 });
        }
        const result = await freeradiusRequest(`/api/provision/${encodeURIComponent(username)}`, { method: 'DELETE' });
        return NextResponse.json(result);
      }

      // ─── New POST endpoints ────────────────────────────────────
      case 'concurrent-sessions': {
        const groupName = data.groupName;
        const maxSessions = data.maxSessions;
        if (!groupName) {
          return NextResponse.json({ success: false, error: 'groupName is required' }, { status: 400 });
        }
        const result = await freeradiusRequest(`/api/concurrent-sessions?groupName=${encodeURIComponent(groupName)}&maxSessions=${maxSessions || 1}`, { method: 'POST' });
        return NextResponse.json(result);
      }

      case 'concurrent-sessions-bulk': {
        const result = await freeradiusRequest('/api/concurrent-sessions/bulk', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'content-filter-add':
      case 'create-content-filter': {  // alias
        const result = await freeradiusRequest('/api/content-filter', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'content-filter-update':
      case 'update-content-filter': {  // alias
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }
        const { id: _id, ...updateData } = data;
        const result = await freeradiusRequest(`/api/content-filter/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: JSON.stringify(updateData),
        });
        return NextResponse.json(result);
      }

      case 'content-filter-delete':
      case 'delete-content-filter': {  // alias
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }
        const result = await freeradiusRequest(`/api/content-filter/${encodeURIComponent(id)}`, { method: 'DELETE' });
        return NextResponse.json(result);
      }

      case 'toggle-content-filter': {
        const id = data.id;
        const enabled = data.enabled;
        if (!id) {
          return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }
        const result = await freeradiusRequest(`/api/content-filter/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: JSON.stringify({ enabled }),
        });
        return NextResponse.json(result);
      }

      case 'apply-content-filter-preset': {
        const { category, patterns, filterAction } = data;
        if (!category || !Array.isArray(patterns)) {
          return NextResponse.json({ success: false, error: 'category and patterns are required' }, { status: 400 });
        }
        // Bulk create content filter entries from preset
        const result = await freeradiusRequest('/api/content-filter/preset', {
          method: 'POST',
          body: JSON.stringify({ category, patterns, filterAction: filterAction || 'block' }),
        });
        return NextResponse.json(result);
      }



      case 'guest-wifi-link': {
        const result = await freeradiusRequest('/api/guest-wifi-link', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'guest-wifi-unlink': {
        const guestId = data.guestId;
        if (!guestId) {
          return NextResponse.json({ success: false, error: 'guestId is required' }, { status: 400 });
        }
        const result = await freeradiusRequest(`/api/guest-wifi-link/${encodeURIComponent(guestId)}`, { method: 'DELETE' });
        return NextResponse.json(result);
      }

      case 'bandwidth-schedules': {
        const result = await freeradiusRequest('/api/bandwidth-schedules', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'bandwidth-schedules-update': {
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }
        const { id: _id, ...updateData } = data;
        const result = await freeradiusRequest(`/api/bandwidth-schedules/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: JSON.stringify(updateData),
        });
        return NextResponse.json(result);
      }

      case 'bandwidth-schedules-delete': {
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }
        const result = await freeradiusRequest(`/api/bandwidth-schedules/${encodeURIComponent(id)}`, { method: 'DELETE' });
        return NextResponse.json(result);
      }

      case 'bandwidth-schedules-enforce': {
        const { action: _action, ...enforceData } = data;
        const result = await freeradiusRequest('/api/bandwidth-schedules/enforce', {
          method: 'POST',
          body: JSON.stringify(enforceData),
        });
        return NextResponse.json(result);
      }

      // ─── Accsium Gap: LiveSession POST/PUT/DELETE ───────────
      case 'live-sessions-create': {
        const result = await freeradiusRequest('/api/live-sessions', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'live-sessions-update': {
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }
        const { id: _id, ...updateData } = data;
        const result = await freeradiusRequest(`/api/live-sessions/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: JSON.stringify(updateData),
        });
        return NextResponse.json(result);
      }

      case 'live-sessions-delete': {
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }
        const result = await freeradiusRequest(`/api/live-sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
        return NextResponse.json(result);
      }

      case 'live-sessions-disconnect': {
        // Accept both sessionId (LiveSession id, may have ls_ prefix) and acctSessionId (bare)
        const { sessionId, acctSessionId, username, nasIp } = data;
        const effectiveSessionId = sessionId || acctSessionId;
        console.log('[live-sessions-disconnect] RAW data:', JSON.stringify({ sessionId, acctSessionId, username, nasIp }));

        if (!username && !effectiveSessionId) {
          return NextResponse.json({ success: false, error: 'Username or sessionId is required' }, { status: 400 });
        }

        // Strip ls_ prefix if present to get bare acctSessionId
        const bareSessionId = effectiveSessionId?.startsWith('ls_') ? effectiveSessionId.slice(3) : effectiveSessionId;
        const disconnectUsername = username || '';
        console.log('[live-sessions-disconnect] Resolved:', { bareSessionId, disconnectUsername, nasIp: nasIp || '' });
        const disconnectNasIp = nasIp || '';

        // 1. Try RADIUS CoA/Disconnect-Message to NAS (best-effort)
        let coaSuccess = false;
        let coaMessage = '';
        try {
          // Look up NAS secret from PostgreSQL
          // GUI may send nasIp with CIDR (e.g. 192.168.1.1/32) — strip it for NAS lookup
          let nasSecret = 'testing123'; // default fallback
          let coaPort = 3799;
          const cleanNasIp = disconnectNasIp.replace(/\/\d+$/, ''); // strip /32 CIDR suffix
          try {
            const nasRows = await db.$queryRawUnsafe<{ nasname: string; secret: string; ports: number | null }[]>(
              `SELECT nasname, secret, ports FROM nas WHERE nasname = $1 LIMIT 1`,
              cleanNasIp
            );
            if (nasRows.length > 0) {
              nasSecret = nasRows[0].secret;
              coaPort = nasRows[0].ports || 3799;
            }
          } catch { /* NAS lookup failed, use defaults */ }

          // Build radclient attributes — use clean IP (without CIDR) for radclient
          const radclientPath = '/home/z/freeradius-install/bin/radclient';
          const attrs = `User-Name="${disconnectUsername}"${bareSessionId ? `\nAcct-Session-Id="${bareSessionId}"` : ''}`;
          const tmpAttrsFile = `/tmp/radclient-disconnect-${Date.now()}.txt`;
          const { execSync } = await import('child_process');
          const fs = await import('fs');

          try {
            fs.writeFileSync(tmpAttrsFile, attrs + '\n');
            const cmd = `${radclientPath} -t 3 -r 1 ${cleanNasIp}:${coaPort} disconnect ${nasSecret} < ${tmpAttrsFile} 2>&1`;
            const output = execSync(cmd, { timeout: 5000 }).toString();
            coaMessage = output.trim();
            coaSuccess = output.includes('Disconnect-ACK') || output.includes('CoA-ACK') || output.includes('received');
          } catch (execErr: unknown) {
            coaMessage = execErr instanceof Error ? execErr.message : String(execErr);
            // radclient returns non-zero exit code even on timeout, but may have succeeded
            if (coaMessage.includes('Disconnect-ACK') || coaMessage.includes('CoA-ACK')) {
              coaSuccess = true;
            }
          } finally {
            try { fs.unlinkSync(tmpAttrsFile); } catch { /* ignore */ }
          }
        } catch (coaErr) {
          coaMessage = coaErr instanceof Error ? coaErr.message : String(coaErr);
        }

        // 2. ALWAYS end the session in PostgreSQL (the critical part)
        let localEnded = false;
        let localMessage = '';
        try {
          // Close the radacct record so it disappears from v_active_sessions view
          // Match by: username (exact), acctuniqueid (GUI sends this as acctSessionId), or nasipaddress
          // Note: GUI sends acctuniqueid as acctSessionId (not acctsessionid which can be empty)
          // Note: nasipaddress is inet type — use host() to strip CIDR suffix (e.g. 192.168.1.1/32 → 192.168.1.1)
          const updateResult = await db.$executeRawUnsafe(`
            UPDATE radacct
            SET acctstoptime = NOW(),
                acctterminatecause = 'Admin-Reset',
                acctsessiontime = COALESCE(
                  EXTRACT(EPOCH FROM (NOW() - acctstarttime))::bigint,
                  acctsessiontime
                ),
                acctupdatetime = NOW()
            WHERE acctstoptime IS NULL
              AND ($1::text = '' OR username = $1)
              AND ($2::text = '' OR acctuniqueid = $2 OR acctsessionid = $2)
              AND ($3::text = '' OR host(nasipaddress) = host($3::inet))
          `, disconnectUsername, bareSessionId || '', disconnectNasIp);
          console.log('[live-sessions-disconnect] DB update done, checking result...');

          // Check if any row was updated
          const checkRows = await db.$queryRawUnsafe<{ cnt: bigint }[]>(
            `SELECT COUNT(*) as cnt FROM radacct WHERE acctterminatecause = 'Admin-Reset' AND acctstoptime > NOW() - INTERVAL '5 seconds'`
          );
          localEnded = Number(checkRows[0]?.cnt || 0) > 0;
          localMessage = localEnded ? `Closed ${checkRows[0]?.cnt} session(s) in radacct` : 'No matching active session found';
          console.log('[live-sessions-disconnect] localEnded:', localEnded, 'message:', localMessage);

          // Also mark LiveSession as ended if it exists
          // Note: acctSessionId is UUID type — cast parameter to uuid
          try {
            await db.$executeRawUnsafe(`
              UPDATE "LiveSession"
              SET status = 'ended', "updatedAt" = NOW()
              WHERE status = 'active'
                AND ($1::text = '' OR "acctSessionId" = $1::uuid)
                AND ($2::text = '' OR username = $2)
            `, bareSessionId || '', disconnectUsername);
          } catch {
            // LiveSession table may not have matching record — that's OK
          }

          // WiFiSession doesn't have acctSessionId column, match by username only
          try {
            await db.$executeRawUnsafe(`
              UPDATE "WiFiSession"
              SET status = 'completed', "endTime" = NOW(), "updatedAt" = NOW()
              WHERE status = 'active'
                AND ($1::text = '' OR "id" = $1::uuid)
                AND ($2::text = '' OR "macAddress" = $2)
            `, bareSessionId || '', disconnectUsername);
          } catch {
            // WiFiSession table may not have matching record — that's OK
          }
        } catch (dbErr) {
          localMessage = dbErr instanceof Error ? dbErr.message : String(dbErr);
        }

        if (coaSuccess) {
          return NextResponse.json({
            success: true,
            message: 'Session disconnected via RADIUS CoA and closed locally',
            coa: true,
            coaMessage,
            local: localEnded,
            localMessage,
          });
        } else if (localEnded) {
          return NextResponse.json({
            success: true,
            message: 'RADIUS CoA unavailable — session closed in database',
            coa: false,
            coaMessage,
            local: true,
            localMessage,
          });
        } else {
          return NextResponse.json({
            success: false,
            message: `Failed to disconnect session: ${localMessage}`,
            coa: false,
            coaMessage,
            local: false,
            localMessage,
          });
        }
      }

      case 'live-sessions-end-fallback': {
        // Fallback: end the session in PostgreSQL directly (not via SQLite freeradius-service)
        const { sessionId, acctSessionId } = data;
        const effectiveId = sessionId || acctSessionId;
        if (!effectiveId) {
          return NextResponse.json({ success: false, error: 'sessionId is required' }, { status: 400 });
        }
        const bareId = effectiveId.startsWith('ls_') ? effectiveId.slice(3) : effectiveId;
        try {
          // Match by acctuniqueid OR acctsessionid (GUI sends acctuniqueid as acctSessionId)
          await db.$executeRawUnsafe(`
            UPDATE radacct
            SET acctstoptime = NOW(),
                acctterminatecause = 'Admin-Reset',
                acctsessiontime = COALESCE(
                  EXTRACT(EPOCH FROM (NOW() - acctstarttime))::bigint,
                  acctsessiontime
                ),
                acctupdatetime = NOW()
            WHERE acctstoptime IS NULL
              AND ($1::text = '' OR acctuniqueid = $1 OR acctsessionid = $1)
          `, bareId || '');
          // Also update LiveSession (acctSessionId is UUID type)
          try {
            await db.$executeRawUnsafe(`UPDATE "LiveSession" SET status = 'ended', "updatedAt" = NOW() WHERE status = 'active' AND ($1::text = '' OR "acctSessionId" = $1::uuid)`, bareId || '');
          } catch { /* ok */ }
          return NextResponse.json({ success: true, message: 'Session ended locally' });
        } catch (error) {
          return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
        }
      }

      case 'nas-health-check': {
        const { nasIp, nasIpAddress, all } = data;
        const ip = nasIp || nasIpAddress;
        if (all) {
          const result = await freeradiusRequest('/api/nas-health/check-all', { method: 'POST' });
          return NextResponse.json(result);
        }
        if (!ip) {
          return NextResponse.json({ success: false, error: 'nasIpAddress is required' }, { status: 400 });
        }
        const result = await freeradiusRequest('/api/nas-health/check', {
          method: 'POST',
          body: JSON.stringify({ nasIpAddress: ip, ...data }),
        });
        return NextResponse.json(result);
      }

      // ─── Accsium Gap: CoA Audit POST/PUT ────────────────────
      case 'coa-audit-create': {
        const result = await freeradiusRequest('/api/coa-audit', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'coa-audit-update': {
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }
        const { id: _id, ...updateData } = data;
        const result = await freeradiusRequest(`/api/coa-audit/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: JSON.stringify(updateData),
        });
        return NextResponse.json(result);
      }

      // ─── Accsium Gap: FAP Policies POST/PUT/DELETE ──────────
      case 'fap-policies-create': {
        const result = await freeradiusRequest('/api/fap-policies', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'fap-policies-update': {
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }
        const { id: _id, ...updateData } = data;
        const result = await freeradiusRequest(`/api/fap-policies/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: JSON.stringify(updateData),
        });
        return NextResponse.json(result);
      }

      case 'fap-policies-delete': {
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }
        const result = await freeradiusRequest(`/api/fap-policies/${encodeURIComponent(id)}`, { method: 'DELETE' });
        return NextResponse.json(result);
      }

      case 'fap-policies-check': {
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }
        const result = await freeradiusRequest(`/api/fap-policies/${encodeURIComponent(id)}/check`, { method: 'POST' });
        return NextResponse.json(result);
      }

      case 'fap-policies-enforce': {
        const result = await freeradiusRequest('/api/fap-policies/enforce-all', { method: 'POST' });
        return NextResponse.json(result);
      }

      // ─── Accsium Gap: Web Categories POST/PUT/DELETE ────────
      case 'web-categories-create': {
        const result = await freeradiusRequest('/api/web-categories', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'web-categories-update': {
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }
        const { id: _id, ...updateData } = data;
        const result = await freeradiusRequest(`/api/web-categories/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: JSON.stringify(updateData),
        });
        return NextResponse.json(result);
      }

      case 'web-categories-delete': {
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }
        const result = await freeradiusRequest(`/api/web-categories/${encodeURIComponent(id)}`, { method: 'DELETE' });
        return NextResponse.json(result);
      }

      case 'web-category-schedules-create': {
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'Category ID is required' }, { status: 400 });
        }
        const { id: _id, ...createData } = data;
        const result = await freeradiusRequest(`/api/web-categories/${encodeURIComponent(id)}/schedules`, {
          method: 'POST',
          body: JSON.stringify(createData),
        });
        return NextResponse.json(result);
      }

      case 'web-category-schedules-update': {
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'Schedule ID is required' }, { status: 400 });
        }
        const { id: _id, ...updateData } = data;
        const result = await freeradiusRequest(`/api/web-categories/schedules/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: JSON.stringify(updateData),
        });
        return NextResponse.json(result);
      }

      case 'web-category-schedules-delete': {
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'Schedule ID is required' }, { status: 400 });
        }
        const result = await freeradiusRequest(`/api/web-categories/schedules/${encodeURIComponent(id)}`, { method: 'DELETE' });
        return NextResponse.json(result);
      }

      // ─── Accsium Gap: NAS Health POST ───────────────────────
      case 'nas-health-check': {
        const result = await freeradiusRequest('/api/nas-health/check', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      // ─── Accsium Gap: BW Policy Details POST/PUT/DELETE ─────
      case 'bw-policy-details-create': {
        const result = await freeradiusRequest('/api/bw-policy-details', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        return NextResponse.json(result);
      }

      case 'bw-policy-details-update': {
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }
        const { id: _id, ...updateData } = data;
        const result = await freeradiusRequest(`/api/bw-policy-details/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: JSON.stringify(updateData),
        });
        return NextResponse.json(result);
      }

      case 'bw-policy-details-delete': {
        const id = data.id;
        if (!id) {
          return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }
        const result = await freeradiusRequest(`/api/bw-policy-details/${encodeURIComponent(id)}`, { method: 'DELETE' });
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Supported: start, stop, restart, test, import, generate-secret, sync, sync-users, sync-clients, create-user, update-user, delete-user, provision, deprovision, coa-disconnect, coa-bandwidth, coa-disconnect-all, data-cap-enforce, data-cap-check-all, mac-auth-add, mac-auth-check, event-users-bulk, event-revoke, portal-whitelist-add, auth-log-create' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in RADIUS operation:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to perform RADIUS operation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
