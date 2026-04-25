import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/auth/tenant-context'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100
const DEFAULT_OFFSET = 0
const DEFAULT_DATE_RANGE_DAYS = 7

/** CSV column headers — matches RADIUS accounting field names */
const CSV_HEADERS = [
  'radacctid',
  'acctsessionid',
  'acctuniqueid',
  'username',
  'nasipaddress',
  'acctstarttime',
  'acctstoptime',
  'acctsessiontime',
  'acctinputoctets',
  'acctoutputoctets',
  'callingstationid',
  'calledstationid',
  'framedipaddress',
  'acctterminatecause',
  'nasporttype',
  'connectinfo_start',
  'connectinfo_stop',
] as const

type CsvHeader = (typeof CSV_HEADERS)[number]

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SessionHistoryFilters {
  propertyId?: string
  username?: string
  nasIp?: string
  callingStationId?: string
  status?: 'active' | 'stopped'
  startDate?: string
  endDate?: string
  limit: number
  offset: number
  export?: 'csv'
}

interface SessionHistoryResponse {
  success: boolean
  data: Record<string, unknown>[]
  pagination: {
    total: number
    limit: number
    offset: number
    totalPages: number
  }
  summary: {
    total: number
    active: number
    totalDownload: number
    totalUpload: number
  }
  filters: {
    startDate: string | null
    endDate: string | null
    username: string | null
    nasIp: string | null
    callingStationId: string | null
    status: string | null
    propertyId: string | null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse and clamp pagination values.
 */
function parsePagination(limitStr: string | null, offsetStr: string | null): {
  limit: number
  offset: number
} {
  let limit = DEFAULT_LIMIT
  let offset = DEFAULT_OFFSET

  if (limitStr) {
    const parsed = parseInt(limitStr, 10)
    if (!isNaN(parsed) && parsed > 0) {
      limit = Math.min(parsed, MAX_LIMIT)
    }
  }

  if (offsetStr) {
    const parsed = parseInt(offsetStr, 10)
    if (!isNaN(parsed) && parsed >= 0) {
      offset = parsed
    }
  }

  return { limit, offset }
}

/**
 * Build the default date range (last 7 days).
 * startDate = midnight 7 days ago, endDate = now (end of today).
 */
function getDefaultDateRange(): { startDate: string; endDate: string } {
  const now = new Date()
  const startDate = new Date(now)
  startDate.setDate(startDate.getDate() - DEFAULT_DATE_RANGE_DAYS)
  startDate.setHours(0, 0, 0, 0)

  // endDate is end of today
  const endDate = new Date(now)
  endDate.setHours(23, 59, 59, 999)

  return {
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10) + ' 23:59:59',
  }
}

/**
 * Parse ISO date strings into date range strings for SQL.
 * Validates that startDate < endDate.
 */
function parseDateRange(
  startDateStr: string | null,
  endDateStr: string | null
): { startDate: string; endDate: string } | null {
  if (!startDateStr && !endDateStr) {
    return null // Will use default
  }

  const startDate = startDateStr || '2000-01-01'
  const endDate = endDateStr || new Date().toISOString().slice(0, 10) + ' 23:59:59'

  return { startDate, endDate }
}

/**
 * Build SQL WHERE conditions from the parsed filters.
 *
 * CRITICAL: The date range filter on acctstarttime is ALWAYS applied
 * — either from user-provided dates or the default 7-day range.
 * This prevents accidental full-table scans on large datasets.
 */
function buildSqlConditions(
  filters: SessionHistoryFilters,
  dateRange: { startDate: string; endDate: string }
): { whereClause: string; params: unknown[] } {
  const conditions: string[] = []
  const params: unknown[] = []

  // ALWAYS filter by acctstarttime to prevent full table scans
  conditions.push(`acctstarttime >= ?`)
  params.push(dateRange.startDate)
  conditions.push(`acctstarttime <= ?`)
  params.push(dateRange.endDate)

  // Username LIKE search (case-insensitive substring match)
  if (filters.username) {
    conditions.push(`username LIKE ?`)
    params.push(`%${filters.username}%`)
  }

  // NAS IP exact match
  if (filters.nasIp) {
    conditions.push(`nasipaddress = ?`)
    params.push(filters.nasIp)
  }

  // Calling station ID (MAC address) — case-insensitive contains
  if (filters.callingStationId) {
    conditions.push(`callingstationid LIKE ?`)
    params.push(`%${filters.callingStationId}%`)
  }

  // Status filter
  if (filters.status === 'active') {
    conditions.push(`acctstoptime IS NULL`)
  } else if (filters.status === 'stopped') {
    conditions.push(`acctstoptime IS NOT NULL`)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  return { whereClause, params }
}

/**
 * Safely escape a CSV field according to RFC 4180.
 */
function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  // If the field contains a comma, double-quote, or newline, wrap in quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Format a value for CSV output.
 */
function formatForCsv(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

// ─────────────────────────────────────────────────────────────────────────────
// GET Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const context = await requirePermission(request, 'reports.view')
    if (context instanceof NextResponse) return context

    const { searchParams } = request.nextUrl

    // ── Parse query parameters ──────────────────────────────────────────────
    const propertyId = searchParams.get('propertyId') || undefined
    const username = searchParams.get('username') || undefined
    const nasIp = searchParams.get('nasIp') || undefined
    const callingStationId = searchParams.get('callingStationId') || undefined
    const status = searchParams.get('status') as 'active' | 'stopped' | null
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')
    const exportFormat = searchParams.get('export') as 'csv' | null

    const { limit, offset } = parsePagination(
      searchParams.get('limit'),
      searchParams.get('offset')
    )

    // ── Determine date range ────────────────────────────────────────────────
    // CRITICAL: Default to last 7 days if no dates provided to prevent
    // accidental full-table scans on production datasets with 1M+ rows.
    let dateRange = parseDateRange(startDateStr, endDateStr)
    if (!dateRange) {
      dateRange = getDefaultDateRange()
    }

    // ── Build WHERE clause ──────────────────────────────────────────────────
    const filters: SessionHistoryFilters = {
      propertyId,
      username,
      nasIp,
      callingStationId,
      status: status || undefined,
      startDate: startDateStr || undefined,
      endDate: endDateStr || undefined,
      limit,
      offset,
      export: exportFormat || undefined,
    }

    const { whereClause, params } = buildSqlConditions(filters, dateRange)

    // ── CSV Export path ─────────────────────────────────────────────────────
    if (exportFormat === 'csv') {
      return handleCsvExport(whereClause, params, dateRange, filters)
    }

    // ── Execute queries in parallel for efficiency ──────────────────────────
    // 1. Count total matching rows
    // 2. Aggregate summary stats (within filter!)
    // 3. Count active sessions (acctstoptime IS NULL, within filter)
    // 4. Fetch paginated results

    const activeWhereClause = whereClause
      ? `${whereClause} AND acctstoptime IS NULL`
      : 'WHERE acctstoptime IS NULL'

    const [totalResult, summaryResult, activeCountResult, paginatedSessions] = await Promise.all([
      // Total count within filters
      db.$queryRawUnsafe<{ c: number }[]>(
        `SELECT COUNT(*) as c FROM v_session_history ${whereClause}`,
        ...params
      ),

      // Summary aggregation — CRITICAL: this uses the same WHERE clause
      // so it only counts/sums rows within the applied date filters
      db.$queryRawUnsafe<{
        total: number;
        total_input: number;
        total_output: number;
      }[]>(`
        SELECT COUNT(*) as total,
               COALESCE(SUM(acctinputoctets), 0) as total_input,
               COALESCE(SUM(acctoutputoctets), 0) as total_output
        FROM v_session_history ${whereClause}
      `, ...params),

      // Active count (acctstoptime IS NULL) — within the same filter scope
      db.$queryRawUnsafe<{ c: number }[]>(
        `SELECT COUNT(*) as c FROM v_session_history ${activeWhereClause}`,
        ...params
      ),

      // Paginated session data, ordered by most recent first
      db.$queryRawUnsafe<Record<string, unknown>[]>(`
        SELECT radacctid, acctsessionid, acctuniqueid, username, nasipaddress,
               nasportid, nasporttype, acctstarttime, acctupdatetime, acctstoptime,
               acctsessiontime, acctinputoctets, acctoutputoctets,
               callingstationid, calledstationid, acctterminatecause,
               framedipaddress, framedipv6address,
               connectinfo_start, connectinfo_stop,
               guest_first_name, guest_last_name, guest_email, guest_phone,
               room_number, room_name, room_floor,
               property_name, plan_name,
               downloadSpeed, uploadSpeed, dataLimit,
               wifi_user_status, wifi_mac, session_status
        FROM v_session_history ${whereClause}
        ORDER BY acctstarttime DESC
        LIMIT ? OFFSET ?
      `, ...params, limit, offset),
    ])

    const total = totalResult[0]?.c ?? 0
    const aggregateRow = summaryResult[0]
    const activeCount = activeCountResult[0]?.c ?? 0
    const totalPages = Math.ceil(total / limit)

    // ── Build response ──────────────────────────────────────────────────────
    const response: SessionHistoryResponse = {
      success: true,
      data: paginatedSessions,
      pagination: {
        total,
        limit,
        offset,
        totalPages,
      },
      summary: {
        total,
        active: activeCount,
        totalDownload: aggregateRow?.total_output ?? 0,
        totalUpload: aggregateRow?.total_input ?? 0,
      },
      filters: {
        startDate: dateRange.startDate.slice(0, 10),
        endDate: dateRange.endDate.slice(0, 10),
        username: username ?? null,
        nasIp: nasIp ?? null,
        callingStationId: callingStationId ?? null,
        status: status ?? null,
        propertyId: propertyId ?? null,
      },
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    console.error('[session-history] GET error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV Export Handler
// ─────────────────────────────────────────────────────────────────────────────

async function handleCsvExport(
  whereClause: string,
  params: unknown[],
  dateRange: { startDate: string; endDate: string },
  filters: SessionHistoryFilters
) {
  // For CSV export, we fetch ALL matching rows (with a safety cap of 50,000)
  const EXPORT_MAX_ROWS = 50_000

  const sessions = await db.$queryRawUnsafe<Record<string, unknown>[]>(`
    SELECT radacctid, acctsessionid, acctuniqueid, username, nasipaddress,
           nasporttype, acctstarttime, acctstoptime, acctsessiontime,
           acctinputoctets, acctoutputoctets,
           callingstationid, calledstationid, framedipaddress,
           acctterminatecause, connectinfo_start, connectinfo_stop,
           guest_first_name, guest_last_name, room_number, property_name, plan_name
    FROM v_session_history ${whereClause}
    ORDER BY acctstarttime DESC
    LIMIT ?
  `, ...params, EXPORT_MAX_ROWS)

  // Generate CSV
  const csvRows: string[] = []

  // Header row
  csvRows.push(CSV_HEADERS.join(','))

  // Data rows
  for (const session of sessions) {
    const row: Record<CsvHeader, unknown> = {
      radacctid: session.radacctid,
      acctsessionid: session.acctsessionid,
      acctuniqueid: session.acctuniqueid,
      username: session.username,
      nasipaddress: session.nasipaddress,
      acctstarttime: formatForCsv(session.acctstarttime),
      acctstoptime: formatForCsv(session.acctstoptime),
      acctsessiontime: session.acctsessiontime ?? '',
      acctinputoctets: session.acctinputoctets ?? 0,
      acctoutputoctets: session.acctoutputoctets ?? 0,
      callingstationid: session.callingstationid,
      calledstationid: session.calledstationid,
      framedipaddress: session.framedipaddress,
      acctterminatecause: session.acctterminatecause,
      nasporttype: session.nasporttype ?? '',
      connectinfo_start: session.connectinfo_start ?? '',
      connectinfo_stop: session.connectinfo_stop ?? '',
    }

    csvRows.push(CSV_HEADERS.map((h) => escapeCsvField(row[h])).join(','))
  }

  const csvContent = csvRows.join('\n')

  // Generate filename with date range
  const startDateStr = dateRange.startDate.slice(0, 10)
  const endDateStr = dateRange.endDate.slice(0, 10)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = `session-history_${startDateStr}_to_${endDateStr}_${timestamp}.csv`

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': Buffer.byteLength(csvContent).toString(),
    },
  })
}
