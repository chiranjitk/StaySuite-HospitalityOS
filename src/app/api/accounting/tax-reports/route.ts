import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers'
import { auditLogService } from '@/lib/services/audit-service'
import { nanoid } from 'nanoid'

// Tax configuration for different jurisdictions
const TAX_CONFIGS: Record<string, {
  name: string
  reportTypes: string[]
  filingFrequency: string[]
  defaultDueDays: number
}> = {
  india: {
    name: 'India GST',
    reportTypes: ['gst', 'service_tax', 'luxury_tax'],
    filingFrequency: ['monthly', 'quarterly', 'annual'],
    defaultDueDays: 20 // 20th of following month
  },
  us: {
    name: 'US Sales Tax',
    reportTypes: ['sales_tax', 'occupancy_tax', 'tourism_tax'],
    filingFrequency: ['monthly', 'quarterly', 'annual'],
    defaultDueDays: 20
  },
  eu: {
    name: 'EU VAT',
    reportTypes: ['vat', 'tourism_tax'],
    filingFrequency: ['monthly', 'quarterly', 'annual'],
    defaultDueDays: 15
  },
  uk: {
    name: 'UK VAT',
    reportTypes: ['vat', 'business_rates'],
    filingFrequency: ['monthly', 'quarterly', 'annual'],
    defaultDueDays: 30
  },
  canada: {
    name: 'Canada GST/HST',
    reportTypes: ['gst', 'hst', 'pst', 'occupancy_tax'],
    filingFrequency: ['monthly', 'quarterly', 'annual'],
    defaultDueDays: 30
  },
  australia: {
    name: 'Australia GST',
    reportTypes: ['gst', 'luxury_car_tax'],
    filingFrequency: ['monthly', 'quarterly', 'annual'],
    defaultDueDays: 21
  },
  uae: {
    name: 'UAE VAT',
    reportTypes: ['vat'],
    filingFrequency: ['quarterly', 'annual'],
    defaultDueDays: 28
  },
  singapore: {
    name: 'Singapore GST',
    reportTypes: ['gst'],
    filingFrequency: ['quarterly', 'annual'],
    defaultDueDays: 30
  }
}

// Generate report number
function generateReportNumber(reportType: string, jurisdiction: string): string {
  const prefix = reportType.toUpperCase().replace('_', '')
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const unique = nanoid(6).toUpperCase()
  return `${prefix}-${jurisdiction.toUpperCase()}-${date}-${unique}`
}

// Calculate tax report data from payments and folios
async function calculateTaxReportData(
  tenantId: string,
  propertyId: string | null,
  periodStart: Date,
  periodEnd: Date,
  jurisdiction: string,
  reportType: string
) {
  // Get all completed payments in the period
  const payments = await db.payment.findMany({
    where: {
      tenantId,
      status: 'completed',
      processedAt: {
        gte: periodStart,
        lte: periodEnd
      },
      ...(propertyId ? { folio: { booking: { propertyId } } } : {})
    },
    include: {
      folio: {
        include: {
          lineItems: true,
          booking: {
            include: {
              primaryGuest: true
            }
          }
        }
      }
    }
  })

  // Get all folios for the period
  const folios = await db.folio.findMany({
    where: {
      tenantId,
      createdAt: {
        gte: periodStart,
        lte: periodEnd
      },
      ...(propertyId ? { booking: { propertyId } } : {})
    },
    include: {
      lineItems: true,
      booking: {
        include: {
          primaryGuest: true
        }
      }
    }
  })

  // Calculate totals
  let grossRevenue = 0
  let taxableRevenue = 0
  let taxCollected = 0
  let cgstAmount = 0
  let sgstAmount = 0
  let igstAmount = 0
  let cessAmount = 0
  let stateTaxAmount = 0
  let localTaxAmount = 0
  let vatOutput = 0
  let transactionCount = 0
  let exemptTransactions = 0
  let exportTransactions = 0

  for (const folio of folios) {
    grossRevenue += folio.subtotal
    taxCollected += folio.taxes
    transactionCount += folio.lineItems.length

    // Calculate based on jurisdiction
    for (const item of folio.lineItems) {
      if (item.taxRate > 0) {
        taxableRevenue += item.totalAmount

        // For Indian GST - split based on tax type
        if (jurisdiction === 'india' && reportType === 'gst') {
          // Assuming taxRate is total, split equally for CGST/SGST
          // In production, this would come from proper tax configuration
          const taxAmount = item.taxAmount
          if (folio.booking?.primaryGuest?.country === 'IN' || !folio.booking?.primaryGuest?.country) {
            // Same state - CGST + SGST
            cgstAmount += taxAmount / 2
            sgstAmount += taxAmount / 2
          } else {
            // Different state/country - IGST
            igstAmount += taxAmount
          }
        }

        // For VAT jurisdictions
        if (['eu', 'uk', 'uae', 'singapore'].includes(jurisdiction)) {
          vatOutput += item.taxAmount
        }

        // For US Sales Tax
        if (jurisdiction === 'us') {
          stateTaxAmount += item.taxAmount * 0.6 // Approximate split
          localTaxAmount += item.taxAmount * 0.4
        }
      } else {
        exemptTransactions++
      }
    }

    // Check for exports (foreign guests)
    if (folio.booking?.primaryGuest?.country &&
        folio.booking.primaryGuest.country !== 'IN' &&
        jurisdiction === 'india') {
      exportTransactions++
    }
  }

  // For Canada GST/HST
  if (jurisdiction === 'canada') {
    // Simplified - in production would need proper provincial rates
    cgstAmount = taxCollected * 0.5 // GST portion
    sgstAmount = taxCollected * 0.5 // HST/PST portion
  }

  return {
    grossRevenue,
    taxableRevenue,
    taxCollected,
    cgstAmount,
    sgstAmount,
    igstAmount,
    cessAmount,
    stateTaxAmount,
    localTaxAmount,
    vatOutput,
    vatInput: 0, // Would need purchase/invoice data
    transactionCount,
    exemptTransactions,
    exportTransactions
  }
}

// GET /api/accounting/tax-reports - Generate/list tax reports
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    if (!hasAnyPermission(user, ['accounting.view', 'accounting.tax_reports', 'admin.accounting', '*'])) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const tenantId = user.tenantId
    const { searchParams } = new URL(request.url)
    const reportType = searchParams.get('reportType')
    const jurisdiction = searchParams.get('jurisdiction')
    const status = searchParams.get('status')
    const propertyId = searchParams.get('propertyId')
    const periodStart = searchParams.get('periodStart')
    const periodEnd = searchParams.get('periodEnd')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const skip = (page - 1) * limit
    const generate = searchParams.get('generate') === 'true'

    // Generate mode - calculate tax report data
    if (generate && periodStart && periodEnd && jurisdiction && reportType) {
      const startDate = new Date(periodStart)
      const endDate = new Date(periodEnd)

      // Get tenant's default currency
      const tenant = await db.tenant.findUnique({
        where: { id: tenantId },
        select: { currency: true, country: true }
      })

      const reportData = await calculateTaxReportData(
        tenantId,
        propertyId,
        startDate,
        endDate,
        jurisdiction,
        reportType
      )

      // Calculate filing due date based on jurisdiction
      const config = TAX_CONFIGS[jurisdiction] || TAX_CONFIGS.india
      const filingDueDate = new Date(endDate)
      filingDueDate.setDate(filingDueDate.getDate() + config.defaultDueDays)

      return NextResponse.json({
        generated: true,
        reportData,
        jurisdiction: {
          code: jurisdiction,
          name: config.name,
          availableReportTypes: config.reportTypes,
          filingFrequencies: config.filingFrequency
        },
        filingDueDate,
        currency: tenant?.currency || 'USD'
      })
    }

    // List existing reports
    const where: any = { tenantId }

    if (reportType) where.reportType = reportType
    if (jurisdiction) where.jurisdiction = jurisdiction
    if (status) where.status = status
    if (propertyId) where.propertyId = propertyId
    if (periodStart && periodEnd) {
      where.periodStart = { gte: new Date(periodStart) }
      where.periodEnd = { lte: new Date(periodEnd) }
    }

    const [reports, total] = await Promise.all([
      db.taxReport.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      db.taxReport.count({ where })
    ])

    // Get summary stats
    const stats = await db.taxReport.aggregate({
      where,
      _sum: {
        taxCollected: true,
        taxPaid: true,
        taxDue: true
      },
      _count: {
        id: true
      }
    })

    // Count by status
    const draftCount = await db.taxReport.count({ where: { ...where, status: 'draft' } })
    const submittedCount = await db.taxReport.count({ where: { ...where, status: 'submitted' } })
    const filedCount = await db.taxReport.count({ where: { ...where, status: 'filed' } })

    // Get upcoming due dates
    const upcomingDue = await db.taxReport.findMany({
      where: {
        tenantId,
        status: { in: ['draft', 'submitted'] },
        filingDueDate: { gte: new Date() }
      },
      orderBy: { filingDueDate: 'asc' },
      take: 5
    })

    return NextResponse.json({
      reports,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      stats: {
        totalReports: stats._count.id,
        totalTaxCollected: stats._sum.taxCollected || 0,
        totalTaxPaid: stats._sum.taxPaid || 0,
        totalTaxDue: stats._sum.taxDue || 0,
        draftCount,
        submittedCount,
        filedCount
      },
      upcomingDue,
      jurisdictions: Object.entries(TAX_CONFIGS).map(([code, config]) => ({
        code,
        name: config.name,
        reportTypes: config.reportTypes
      }))
    })
  } catch (error: any) {
    console.error('Error fetching tax reports:', error)
    return NextResponse.json(
      { error: 'Failed to process tax report request' },
      { status: 500 }
    )
  }
}

// POST /api/accounting/tax-reports - Create tax report
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions - creating requires manage permission
    if (!hasAnyPermission(user, ['accounting.manage', 'accounting.tax_reports', 'admin.accounting', '*'])) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const tenantId = user.tenantId
    const body = await request.json()
    const {
      propertyId,
      reportType,
      jurisdiction = 'india',
      periodStart,
      periodEnd,
      filingDueDate,
      notes
    } = body

    // Validation
    if (!reportType || !periodStart || !periodEnd) {
      return NextResponse.json(
        { error: 'Report type, period start, and period end are required' },
        { status: 400 }
      )
    }

    // Validate jurisdiction and report type
    const config = TAX_CONFIGS[jurisdiction]
    if (!config) {
      return NextResponse.json(
        { error: `Invalid jurisdiction: ${jurisdiction}` },
        { status: 400 }
      )
    }

    if (!config.reportTypes.includes(reportType)) {
      return NextResponse.json(
        { error: `Report type ${reportType} not supported for ${config.name}` },
        { status: 400 }
      )
    }

    const startDate = new Date(periodStart)
    const endDate = new Date(periodEnd)

    // Calculate report data
    const reportData = await calculateTaxReportData(
      tenantId,
      propertyId,
      startDate,
      endDate,
      jurisdiction,
      reportType
    )

    // Generate report number
    const reportNumber = generateReportNumber(reportType, jurisdiction)

    // Calculate due date if not provided
    const dueDate = filingDueDate
      ? new Date(filingDueDate)
      : new Date(endDate.getTime() + config.defaultDueDays * 24 * 60 * 60 * 1000)

    const report = await db.taxReport.create({
      data: {
        tenantId,
        propertyId,
        reportNumber,
        reportType,
        jurisdiction,
        periodStart: startDate,
        periodEnd: endDate,
        filingDueDate: dueDate,
        grossRevenue: reportData.grossRevenue,
        taxableRevenue: reportData.taxableRevenue,
        taxCollected: reportData.taxCollected,
        cgstAmount: reportData.cgstAmount,
        sgstAmount: reportData.sgstAmount,
        igstAmount: reportData.igstAmount,
        cessAmount: reportData.cessAmount,
        stateTaxAmount: reportData.stateTaxAmount,
        localTaxAmount: reportData.localTaxAmount,
        vatOutput: reportData.vatOutput,
        vatInput: reportData.vatInput,
        taxDue: reportData.taxCollected - reportData.vatInput,
        transactionCount: reportData.transactionCount,
        exemptTransactions: reportData.exemptTransactions,
        exportTransactions: reportData.exportTransactions,
        notes,
        status: 'draft'
      }
    })

    // Audit log
    await auditLogService.log({
      tenantId,
      userId: user.id,
      module: 'billing',
      action: 'create',
      entityType: 'tax_report',
      entityId: report.id,
      newValue: {
        reportNumber,
        reportType,
        jurisdiction,
        periodStart: startDate,
        periodEnd: endDate,
        taxCollected: reportData.taxCollected
      }
    })

    return NextResponse.json(report, { status: 201 })
  } catch (error: any) {
    console.error('Error creating tax report:', error)
    return NextResponse.json(
      { error: 'Failed to process tax report request' },
      { status: 500 }
    )
  }
}

// PUT /api/accounting/tax-reports - Update tax report
export async function PUT(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    if (!hasAnyPermission(user, ['accounting.manage', 'accounting.tax_reports', 'admin.accounting', '*'])) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const tenantId = user.tenantId
    const body = await request.json()
    const { id, action, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'Report ID is required' }, { status: 400 })
    }

    // Check if report exists
    const existing = await db.taxReport.findFirst({
      where: { id, tenantId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Tax report not found' }, { status: 404 })
    }

    // Handle specific actions
    if (action === 'submit') {
      if (existing.status !== 'draft') {
        return NextResponse.json(
          { error: 'Only draft reports can be submitted' },
          { status: 400 }
        )
      }

      const report = await db.taxReport.update({
        where: { id },
        data: { status: 'submitted' }
      })
      return NextResponse.json(report)
    }

    if (action === 'file') {
      const { filingReference, filedBy } = body
      if (existing.status !== 'submitted') {
        return NextResponse.json(
          { error: 'Report must be submitted before filing' },
          { status: 400 }
        )
      }

      const report = await db.taxReport.update({
        where: { id },
        data: {
          status: 'filed',
          filedAt: new Date(),
          filedBy,
          filingReference
        }
      })
      return NextResponse.json(report)
    }

    if (action === 'mark_paid') {
      const { paymentReference } = body
      if (existing.status !== 'filed') {
        return NextResponse.json(
          { error: 'Report must be filed before marking as paid' },
          { status: 400 }
        )
      }

      const report = await db.taxReport.update({
        where: { id },
        data: {
          status: 'paid',
          paidAt: new Date(),
          paymentReference,
          taxPaid: existing.taxDue
        }
      })
      return NextResponse.json(report)
    }

    if (action === 'recalculate') {
      if (existing.status === 'filed' || existing.status === 'paid') {
        return NextResponse.json(
          { error: 'Cannot recalculate filed or paid reports' },
          { status: 400 }
        )
      }

      const reportData = await calculateTaxReportData(
        tenantId,
        existing.propertyId,
        existing.periodStart,
        existing.periodEnd,
        existing.jurisdiction,
        existing.reportType
      )

      const report = await db.taxReport.update({
        where: { id },
        data: {
          grossRevenue: reportData.grossRevenue,
          taxableRevenue: reportData.taxableRevenue,
          taxCollected: reportData.taxCollected,
          cgstAmount: reportData.cgstAmount,
          sgstAmount: reportData.sgstAmount,
          igstAmount: reportData.igstAmount,
          cessAmount: reportData.cessAmount,
          stateTaxAmount: reportData.stateTaxAmount,
          localTaxAmount: reportData.localTaxAmount,
          vatOutput: reportData.vatOutput,
          vatInput: reportData.vatInput,
          taxDue: reportData.taxCollected - reportData.vatInput,
          transactionCount: reportData.transactionCount,
          exemptTransactions: reportData.exemptTransactions,
          exportTransactions: reportData.exportTransactions
        }
      })
      return NextResponse.json(report)
    }

    // Generic update for draft reports only
    if (existing.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft reports can be edited' },
        { status: 400 }
      )
    }

    const dataToUpdate: any = {}
    if (updateData.adjustments !== undefined) {
      dataToUpdate.adjustments = parseFloat(updateData.adjustments)
      dataToUpdate.taxDue = existing.taxCollected + parseFloat(updateData.adjustments) - existing.vatInput
    }
    if (updateData.adjustmentReason !== undefined) dataToUpdate.adjustmentReason = updateData.adjustmentReason
    if (updateData.filingDueDate !== undefined) dataToUpdate.filingDueDate = new Date(updateData.filingDueDate)
    if (updateData.notes !== undefined) dataToUpdate.notes = updateData.notes
    if (updateData.internalNotes !== undefined) dataToUpdate.internalNotes = updateData.internalNotes

    const report = await db.taxReport.update({
      where: { id },
      data: dataToUpdate
    })

    return NextResponse.json(report)
  } catch (error: any) {
    console.error('Error updating tax report:', error)
    return NextResponse.json(
      { error: 'Failed to process tax report request' },
      { status: 500 }
    )
  }
}

// DELETE /api/accounting/tax-reports - Delete tax report
export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    if (!hasAnyPermission(user, ['accounting.manage', 'accounting.tax_reports', 'admin.accounting', '*'])) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const tenantId = user.tenantId
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Report ID is required' }, { status: 400 })
    }

    // Check if report exists
    const existing = await db.taxReport.findFirst({
      where: { id, tenantId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Tax report not found' }, { status: 404 })
    }

    // Only allow deleting draft reports
    if (existing.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft reports can be deleted' },
        { status: 400 }
      )
    }

    await db.taxReport.delete({
      where: { id }
    })

    // Audit log
    await auditLogService.log({
      tenantId,
      userId: user.id,
      module: 'billing',
      action: 'delete',
      entityType: 'tax_report',
      entityId: id,
      oldValue: {
        reportNumber: existing.reportNumber,
        reportType: existing.reportType,
        jurisdiction: existing.jurisdiction
      }
    })

    return NextResponse.json({ success: true, message: 'Tax report deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting tax report:', error)
    return NextResponse.json(
      { error: 'Failed to process tax report request' },
      { status: 500 }
    )
  }
}
