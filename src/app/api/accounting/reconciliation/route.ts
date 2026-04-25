import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers'
import { auditLogService } from '@/lib/services/audit-service'

// Auto-matching algorithm for bank transactions to payments
async function findMatchingPayments(
  tenantId: string,
  bankTransaction: {
    id: string
    amount: number
    transactionDate: Date
    transactionType: string
    description?: string | null
    reference?: string | null
    payeeName?: string | null
  }
) {
  const matches: Array<{
    payment: any
    confidence: number
    matchCriteria: Record<string, boolean>
  }> = []

  // Only match credits (deposits) to payments
  if (bankTransaction.transactionType !== 'credit') {
    return matches
  }

  // Find payments that could match
  // Look for payments within a reasonable date range (±7 days) and amount match
  const dateRange = 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
  const startDate = new Date(bankTransaction.transactionDate.getTime() - dateRange)
  const endDate = new Date(bankTransaction.transactionDate.getTime() + dateRange)

  const potentialPayments = await db.payment.findMany({
    where: {
      tenantId,
      status: 'completed',
      processedAt: {
        gte: startDate,
        lte: endDate
      },
      // Amount should be close (within 1% or exact)
      amount: {
        gte: bankTransaction.amount * 0.99,
        lte: bankTransaction.amount * 1.01
      }
    },
    include: {
      folio: {
        include: {
          booking: {
            include: {
              primaryGuest: true
            }
          }
        }
      },
      guest: true
    }
  })

  for (const payment of potentialPayments) {
    let confidence = 0
    const matchCriteria: Record<string, boolean> = {}

    // Exact amount match
    if (Math.abs(payment.amount - bankTransaction.amount) < 0.01) {
      confidence += 40
      matchCriteria.exactAmount = true
    } else {
      confidence += 20
      matchCriteria.amountMatch = true
    }

    // Date proximity
    const daysDiff = Math.abs(
      (new Date(payment.processedAt!).getTime() - new Date(bankTransaction.transactionDate).getTime()) / (1000 * 60 * 60 * 24)
    )
    if (daysDiff <= 1) {
      confidence += 30
      matchCriteria.dateMatch = true
    } else if (daysDiff <= 3) {
      confidence += 20
      matchCriteria.dateClose = true
    } else {
      confidence += 10
      matchCriteria.dateNear = true
    }

    // Reference match
    if (bankTransaction.reference && payment.transactionId) {
      if (bankTransaction.reference.toLowerCase().includes(payment.transactionId.toLowerCase()) ||
          payment.transactionId.toLowerCase().includes(bankTransaction.reference.toLowerCase())) {
        confidence += 20
        matchCriteria.referenceMatch = true
      }
    }

    // Guest name match in description
    if (bankTransaction.description && payment.guest) {
      const guestName = `${payment.guest.firstName} ${payment.guest.lastName}`.toLowerCase()
      if (bankTransaction.description.toLowerCase().includes(guestName)) {
        confidence += 15
        matchCriteria.guestNameMatch = true
      }
    }

    // Payee name match
    if (bankTransaction.payeeName && payment.guest) {
      const guestName = `${payment.guest.firstName} ${payment.guest.lastName}`.toLowerCase()
      if (bankTransaction.payeeName.toLowerCase().includes(guestName)) {
        confidence += 10
        matchCriteria.payeeNameMatch = true
      }
    }

    // Payment method correlation
    if (payment.method === 'bank_transfer' || payment.method === 'wire') {
      confidence += 5
      matchCriteria.methodMatch = true
    }

    matches.push({
      payment,
      confidence: confidence / 100, // Normalize to 0-1
      matchCriteria
    })
  }

  // Sort by confidence descending
  matches.sort((a, b) => b.confidence - a.confidence)

  return matches
}

// GET /api/accounting/reconciliation - List reconciliation records
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    if (!hasAnyPermission(user, ['accounting.view', 'accounting.reconciliation', 'admin.accounting', '*'])) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const tenantId = user.tenantId
    const { searchParams } = new URL(request.url)
    const bankAccountId = searchParams.get('bankAccountId')
    const status = searchParams.get('status')
    const matchType = searchParams.get('matchType')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const skip = (page - 1) * limit

    const where: any = { tenantId }

    if (bankAccountId) where.bankAccountId = bankAccountId
    if (status) where.status = status
    if (matchType) where.matchType = matchType
    if (startDate || endDate) {
      where.reconciledAt = {}
      if (startDate) where.reconciledAt.gte = new Date(startDate)
      if (endDate) where.reconciledAt.lte = new Date(endDate)
    }

    const [reconciliations, total] = await Promise.all([
      db.reconciliation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { reconciledAt: 'desc' },
        include: {
          bankAccount: {
            select: {
              id: true,
              accountName: true,
              bankName: true
            }
          },
          bankTransaction: {
            select: {
              id: true,
              transactionDate: true,
              amount: true,
              description: true,
              reference: true,
              transactionType: true
            }
          }
        }
      }),
      db.reconciliation.count({ where })
    ])

    // Get summary stats
    const stats = await db.reconciliation.aggregate({
      where,
      _sum: {
        reconciledAmount: true,
        adjustmentAmount: true
      },
      _count: {
        id: true
      }
    })

    // Stats by status
    const matchedCount = await db.reconciliation.count({
      where: { ...where, status: 'matched' }
    })
    const disputedCount = await db.reconciliation.count({
      where: { ...where, status: 'disputed' }
    })
    const adjustedCount = await db.reconciliation.count({
      where: { ...where, status: 'adjusted' }
    })

    // Get unreconciled transactions count
    const unreconciledCount = await db.bankTransaction.count({
      where: {
        tenantId,
        isReconciled: false,
        deletedAt: null,
        transactionType: 'credit'
      }
    })

    return NextResponse.json({
      reconciliations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      stats: {
        totalReconciliations: stats._count.id,
        totalReconciledAmount: stats._sum.reconciledAmount || 0,
        totalAdjustments: stats._sum.adjustmentAmount || 0,
        matchedCount,
        disputedCount,
        adjustedCount,
        unreconciledCount
      }
    })
  } catch (error: any) {
    console.error('Error fetching reconciliations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reconciliations' },
      { status: 500 }
    )
  }
}

// POST /api/accounting/reconciliation - Create reconciliation (match bank tx to payment)
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions - reconciliation requires manage permission
    if (!hasAnyPermission(user, ['accounting.manage', 'accounting.reconciliation', 'admin.accounting', '*'])) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const tenantId = user.tenantId
    const body = await request.json()
    const {
      bankAccountId,
      bankTransactionId,
      paymentId,
      folioId,
      matchType = 'manual',
      matchConfidence,
      matchCriteria,
      status = 'matched',
      reconciledAmount,
      adjustmentAmount = 0,
      adjustmentReason,
      reconciledBy,
      notes,
      autoMatch = false
    } = body

    // Auto-match mode
    if (autoMatch) {
      const bankAccountIdParam = bankAccountId
      if (!bankAccountIdParam) {
        return NextResponse.json(
          { error: 'Bank account ID is required for auto-matching' },
          { status: 400 }
        )
      }

      // Get unreconciled credit transactions
      const unreconciledTransactions = await db.bankTransaction.findMany({
        where: {
          tenantId,
          bankAccountId: bankAccountIdParam,
          isReconciled: false,
          deletedAt: null,
          transactionType: 'credit'
        },
        take: 100 // Process in batches
      })

      const results = {
        matched: 0,
        reviewed: 0,
        total: unreconciledTransactions.length,
        matches: [] as any[]
      }

      for (const tx of unreconciledTransactions) {
        const matches = await findMatchingPayments(tenantId, tx)

        if (matches.length > 0 && matches[0].confidence >= 0.7) {
          // Auto-match if confidence is high
          const bestMatch = matches[0]

          // Check if payment is already reconciled
          const existingReconciliation = await db.reconciliation.findFirst({
            where: { paymentId: bestMatch.payment.id, tenantId }
          })

          if (!existingReconciliation) {
            await db.$transaction(async (prismaTx) => {
              // Create reconciliation
              await prismaTx.reconciliation.create({
                data: {
                  tenantId,
                  bankAccountId: bankAccountIdParam,
                  bankTransactionId: tx.id,
                  paymentId: bestMatch.payment.id,
                  folioId: bestMatch.payment.folioId,
                  matchType: 'auto',
                  matchConfidence: bestMatch.confidence,
                  matchCriteria: JSON.stringify(bestMatch.matchCriteria),
                  status: 'matched',
                  reconciledAmount: tx.amount,
                  reconciledBy: 'system'
                }
              })

              // Mark transaction as reconciled
              await prismaTx.bankTransaction.update({
                where: { id: tx.id },
                data: { isReconciled: true, reconciledAt: new Date() }
              })
            })

            results.matched++
            results.matches.push({
              transactionId: tx.id,
              paymentId: bestMatch.payment.id,
              confidence: bestMatch.confidence
            })
          }
        } else if (matches.length > 0) {
          results.reviewed++
          results.matches.push({
            transactionId: tx.id,
            potentialMatches: matches.slice(0, 3).map(m => ({
              paymentId: m.payment.id,
              confidence: m.confidence,
              criteria: m.matchCriteria
            })),
            needsReview: true
          })
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Auto-matching completed',
        results
      })
    }

    // Manual reconciliation
    if (!bankAccountId || !bankTransactionId || !paymentId) {
      return NextResponse.json(
        { error: 'Bank account, transaction, and payment IDs are required' },
        { status: 400 }
      )
    }

    // Verify transaction exists and is not already reconciled
    const bankTransaction = await db.bankTransaction.findFirst({
      where: { id: bankTransactionId, tenantId, deletedAt: null }
    })

    if (!bankTransaction) {
      return NextResponse.json({ error: 'Bank transaction not found' }, { status: 404 })
    }

    if (bankTransaction.isReconciled) {
      return NextResponse.json(
        { error: 'Transaction is already reconciled' },
        { status: 400 }
      )
    }

    // Verify payment exists
    const payment = await db.payment.findFirst({
      where: { id: paymentId, tenantId }
    })

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    // Check if payment is already reconciled
    const existingReconciliation = await db.reconciliation.findFirst({
      where: { paymentId, tenantId }
    })

    if (existingReconciliation) {
      return NextResponse.json(
        { error: 'Payment is already reconciled with another transaction' },
        { status: 400 }
      )
    }

    // Create reconciliation in transaction
    const reconciliation = await db.$transaction(async (prisma) => {
      const rec = await prisma.reconciliation.create({
        data: {
          tenantId,
          bankAccountId,
          bankTransactionId,
          paymentId,
          folioId,
          matchType,
          matchConfidence,
          matchCriteria: JSON.stringify(matchCriteria || {}),
          status,
          reconciledAmount: reconciledAmount || bankTransaction.amount,
          adjustmentAmount,
          adjustmentReason,
          reconciledBy: user.id,
          notes
        }
      })

      // Mark transaction as reconciled
      await prisma.bankTransaction.update({
        where: { id: bankTransactionId },
        data: {
          isReconciled: true,
          reconciledAt: new Date()
        }
      })

      // Update bank account last reconciled date
      await prisma.bankAccount.update({
        where: { id: bankAccountId },
        data: { lastReconciledAt: new Date() }
      })

      return rec
    })

    // Audit log
    await auditLogService.log({
      tenantId,
      userId: user.id,
      module: 'billing',
      action: 'create',
      entityType: 'reconciliation',
      entityId: reconciliation.id,
      newValue: {
        bankAccountId,
        bankTransactionId,
        paymentId,
        matchType,
        reconciledAmount: reconciledAmount || bankTransaction.amount
      }
    })

    return NextResponse.json(reconciliation, { status: 201 })
  } catch (error: any) {
    console.error('Error creating reconciliation:', error)
    return NextResponse.json(
      { error: 'Failed to create reconciliation' },
      { status: 500 }
    )
  }
}

// PUT /api/accounting/reconciliation - Update reconciliation status
export async function PUT(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    if (!hasAnyPermission(user, ['accounting.manage', 'accounting.reconciliation', 'admin.accounting', '*'])) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const tenantId = user.tenantId
    const body = await request.json()
    const { id, action, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'Reconciliation ID is required' }, { status: 400 })
    }

    // Check if reconciliation exists
    const existing = await db.reconciliation.findFirst({
      where: { id, tenantId },
      include: { bankTransaction: true }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Reconciliation not found' }, { status: 404 })
    }

    // Handle specific actions
    if (action === 'unreconcile') {
      // Unreconcile - remove matching and mark transaction as unreconciled
      await db.$transaction(async (prisma) => {
        await prisma.bankTransaction.update({
          where: { id: existing.bankTransactionId },
          data: { isReconciled: false, reconciledAt: null }
        })

        await prisma.reconciliation.delete({
          where: { id }
        })
      })

      return NextResponse.json({ success: true, message: 'Reconciliation removed successfully' })
    }

    if (action === 'dispute') {
      const { disputeReason } = body
      const reconciliation = await db.reconciliation.update({
        where: { id },
        data: {
          status: 'disputed',
          notes: disputeReason || existing.notes
        }
      })
      return NextResponse.json(reconciliation)
    }

    if (action === 'adjust') {
      const { adjustmentAmount, adjustmentReason } = body
      if (adjustmentAmount === undefined) {
        return NextResponse.json(
          { error: 'Adjustment amount is required' },
          { status: 400 }
        )
      }

      const reconciliation = await db.reconciliation.update({
        where: { id },
        data: {
          status: 'adjusted',
          adjustmentAmount: parseFloat(adjustmentAmount),
          adjustmentReason,
          reconciledAmount: existing.reconciledAmount + parseFloat(adjustmentAmount)
        }
      })
      return NextResponse.json(reconciliation)
    }

    // Generic update
    const dataToUpdate: any = {}
    if (updateData.status) dataToUpdate.status = updateData.status
    if (updateData.notes !== undefined) dataToUpdate.notes = updateData.notes
    if (updateData.adjustmentAmount !== undefined) dataToUpdate.adjustmentAmount = parseFloat(updateData.adjustmentAmount)
    if (updateData.adjustmentReason !== undefined) dataToUpdate.adjustmentReason = updateData.adjustmentReason

    const reconciliation = await db.reconciliation.update({
      where: { id },
      data: dataToUpdate
    })

    return NextResponse.json(reconciliation)
  } catch (error: any) {
    console.error('Error updating reconciliation:', error)
    return NextResponse.json(
      { error: 'Failed to update reconciliation' },
      { status: 500 }
    )
  }
}

// DELETE /api/accounting/reconciliation - Remove reconciliation
export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    if (!hasAnyPermission(user, ['accounting.manage', 'accounting.reconciliation', 'admin.accounting', '*'])) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const tenantId = user.tenantId
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Reconciliation ID is required' }, { status: 400 })
    }

    // Check if reconciliation exists
    const existing = await db.reconciliation.findFirst({
      where: { id, tenantId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Reconciliation not found' }, { status: 404 })
    }

    // Delete reconciliation and mark transaction as unreconciled
    await db.$transaction(async (prisma) => {
      await prisma.bankTransaction.update({
        where: { id: existing.bankTransactionId },
        data: { isReconciled: false, reconciledAt: null }
      })

      await prisma.reconciliation.delete({
        where: { id }
      })
    })

    // Audit log
    await auditLogService.log({
      tenantId,
      userId: user.id,
      module: 'billing',
      action: 'delete',
      entityType: 'reconciliation',
      entityId: id
    })

    return NextResponse.json({ success: true, message: 'Reconciliation deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting reconciliation:', error)
    return NextResponse.json(
      { error: 'Failed to delete reconciliation' },
      { status: 500 }
    )
  }
}
