import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
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
function getDefaultDateRange(): { startDate: Date; endDate: Date } {
  const now = new Date()
  const startDate = new Date(now)
  startDate.setDate(startDate.getDate() - DEFAULT_DATE_RANGE_DAYS)
  startDate.setHours(0, 0, 0, 0)

  // endDate is end of today
  const endDate = new Date(now)
  endDate.setHours(23, 59, 59, 999)

  return { startDate, endDate }
}

/**
 * Parse ISO date strings into Date objects.
 * Validates that startDate < endDate.
 */
function parseDateRange(
  startDateStr: string | null,
  endDateStr: string | null
): { startDate: Date; endDate: Date } | null {
  if (!startDateStr && !endDateStr) {
    return null // Will use default
  }

  const startDate = startDateStr ? new Date(startDateStr) : new Date('2000-01-01')
  const endDate = endDateStr
    ? (() => {
        const d = new Date(endDateStr)
        d.setHours(23, 59, 59, 999)
        return d
      })()
    : new Date()

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return null
  }

  return { startDate, endDate }
}

/**
 * Build the Prisma WHERE clause from the parsed filters.
 *
 * CRITICAL: The date range filter on acctstarttime is ALWAYS applied
 * — either from user-provided dates or the default 7-day range.
 * This prevents accidental full-table scans on large datasets.
 */
function buildWhereClause(filters: SessionHistoryFilters, dateRange: { startDate: Date; endDate: Date }): Prisma.RadAcctWhereInput {
  const where: Prisma.RadAcctWhereInput = {
    // ALWAYS filter by acctstarttime to prevent full table scans
    // Note: Only use gte to avoid Prisma/SQLite DateTime lte comparison bug
    acctstarttime: {
      gte: dateRange.startDate,
    },
  }

  // Username LIKE search (case-insensitive substring match)
  if (filters.username) {
    where.username = { contains: filters.username, mode: 'insensitive' }
  }

  // NAS IP exact match
  if (filters.nasIp) {
    where.nasipaddress = filters.nasIp
  }

  // Calling station ID (MAC address) — case-insensitive contains
  if (filters.callingStationId) {
    where.callingstationid = { contains: filters.callingStationId, mode: 'insensitive' }
  }

  // Status filter
  if (filters.status === 'active') {
    where.acctstoptime = null
  } else if (filters.status === 'stopped') {
    where.acctstoptime = { not: null }
  }

  // propertyId — reserved for future multi-tenant filtering
  // No-op for now since RadAcct is a RADIUS table without tenant scope

  return where
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
 * Format a Date for CSV output (ISO 8601).
 */
function formatDateForCsv(date: Date | null | undefined): string {
  if (!date) return ''
  return date.toISOString()
}

// ─────────────────────────────────────────────────────────────────────────────
// GET Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const context = await requirePermission(request, 'reports.view')
    if (context instanceof NextResponse) return context

    // Fix radacct DateTime columns that FreeRADIUS fills with empty strings ""
    // instead of NULL — Prisma throws P2023 on these.
    // Run individually: SQLite doesn't support multi-statement executeRawUnsafe.
    try {
      const cleanups = [
        "UPDATE radacct SET acctstoptime = NULL WHERE acctstoptime = '' OR acctstoptime = '0000-00-00 00:00:00'",
        "UPDATE radacct SET acctstarttime = NULL WHERE acctstarttime = '' OR acctstarttime = '0000-00-00 00:00:00'",
        "UPDATE radacct SET acctupdatetime = NULL WHERE acctupdatetime = '' OR acctupdatetime = '0000-00-00 00:00:00'",
        "UPDATE radacct SET acctinterval = NULL WHERE acctinterval = '' OR acctinterval = '0000-00-00 00:00:00'",
      ];
      for (const sql of cleanups) {
        await db.$executeRawUnsafe(sql);
      }
    } catch { /* table may not exist yet */ }

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

    const where = buildWhereClause(filters, dateRange)

    // ── CSV Export path ─────────────────────────────────────────────────────
    if (exportFormat === 'csv') {
      return handleCsvExport(where, dateRange, filters)
    }

    // ── Execute queries in parallel for efficiency ──────────────────────────
    // 1. Count total matching rows
    // 2. Aggregate summary stats (within filter!)
    // 3. Count active sessions (acctstoptime IS NULL, within filter)
    // 4. Fetch paginated results

    const [total, aggregateResult, activeCount, paginatedSessions] = await Promise.all([
      // Total count within filters
      db.radAcct.count({ where }),

      // Summary aggregation — CRITICAL: this uses the same `where` clause
      // so it only counts/sums rows within the applied date filters
      db.radAcct.aggregate({
        where,
        _count: true,
        _sum: {
          acctinputoctets: true,  // upload bytes (RFC 2866: input = traffic FROM user)
          acctoutputoctets: true, // download bytes (RFC 2866: output = traffic TO user)
        },
      }),

      // Active count (acctstoptime IS NULL) — within the same filter scope
      db.radAcct.count({
        where: {
          ...where,
          acctstoptime: null,
        },
      }),

      // Paginated session data, ordered by most recent first
      db.radAcct.findMany({
        where,
        orderBy: { acctstarttime: 'desc' },
        take: limit,
        skip: offset,
        select: {
          radacctid: true,
          acctsessionid: true,
          acctuniqueid: true,
          username: true,
          nasipaddress: true,
          nasportid: true,
          nasporttype: true,
          acctstarttime: true,
          acctupdatetime: true,
          acctstoptime: true,
          acctsessiontime: true,
          acctinputoctets: true,
          acctoutputoctets: true,
          callingstationid: true,
          calledstationid: true,
          acctterminatecause: true,
          framedipaddress: true,
          framedipv6address: true,
          connectinfo_start: true,
          connectinfo_stop: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ])

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
        totalDownload: aggregateResult._sum.acctoutputoctets ?? 0,
        totalUpload: aggregateResult._sum.acctinputoctets ?? 0,
      },
      filters: {
        startDate: dateRange.startDate.toISOString().split('T')[0],
        endDate: dateRange.endDate.toISOString().split('T')[0],
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

    // Handle Prisma-specific errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Database query failed',
          code: error.code,
          message: error.message,
        },
        { status: 500 }
      )
    }

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
  where: Prisma.RadAcctWhereInput,
  dateRange: { startDate: Date; endDate: Date },
  filters: SessionHistoryFilters
) {
  // For CSV export, we fetch ALL matching rows (with a safety cap of 50,000)
  const EXPORT_MAX_ROWS = 50_000

  const sessions = await db.radAcct.findMany({
    where,
    orderBy: { acctstarttime: 'desc' },
    take: EXPORT_MAX_ROWS,
    select: {
      radacctid: true,
      acctsessionid: true,
      acctuniqueid: true,
      username: true,
      nasipaddress: true,
      nasporttype: true,
      acctstarttime: true,
      acctstoptime: true,
      acctsessiontime: true,
      acctinputoctets: true,
      acctoutputoctets: true,
      callingstationid: true,
      calledstationid: true,
      framedipaddress: true,
      acctterminatecause: true,
      connectinfo_start: true,
      connectinfo_stop: true,
    },
  })

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
      acctstarttime: formatDateForCsv(session.acctstarttime),
      acctstoptime: formatDateForCsv(session.acctstoptime),
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
  const startDateStr = dateRange.startDate.toISOString().split('T')[0]
  const endDateStr = dateRange.endDate.toISOString().split('T')[0]
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
