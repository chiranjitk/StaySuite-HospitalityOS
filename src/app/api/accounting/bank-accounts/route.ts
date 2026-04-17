import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers'
import { auditLogService } from '@/lib/services/audit-service'

// GET /api/accounting/bank-accounts - List bank accounts
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    if (!hasAnyPermission(user, ['accounting.view', 'accounting.bank_accounts', 'admin.accounting', '*'])) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const tenantId = user.tenantId
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const bankName = searchParams.get('bankName')
    const propertyId = searchParams.get('propertyId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const skip = (page - 1) * limit

    const where: any = {
      tenantId,
      deletedAt: null
    }

    if (status) where.status = status
    if (bankName) where.bankName = { contains: bankName }
    if (propertyId) where.propertyId = propertyId

    const [accounts, total] = await Promise.all([
      db.bankAccount.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { transactions: true, reconciliations: true }
          }
        }
      }),
      db.bankAccount.count({ where })
    ])

    // Calculate summary stats
    const stats = await db.bankAccount.aggregate({
      where,
      _sum: {
        currentBalance: true,
        openingBalance: true
      },
      _count: {
        id: true
      }
    })

    // Get active accounts count
    const activeCount = await db.bankAccount.count({
      where: { ...where, status: 'active' }
    })

    return NextResponse.json({
      accounts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      stats: {
        totalAccounts: stats._count.id,
        activeAccounts: activeCount,
        totalBalance: stats._sum.currentBalance || 0,
        totalOpeningBalance: stats._sum.openingBalance || 0
      }
    })
  } catch (error: any) {
    console.error('Error fetching bank accounts:', error)
    return NextResponse.json(
      { error: 'Failed to process bank account request' },
      { status: 500 }
    )
  }
}

// POST /api/accounting/bank-accounts - Create bank account
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions - creating requires manage permission
    if (!hasAnyPermission(user, ['accounting.manage', 'accounting.bank_accounts', 'admin.accounting', '*'])) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const tenantId = user.tenantId
    const body = await request.json()
    const {
      propertyId,
      accountName,
      accountNumber,
      bankName,
      bankCode,
      accountType = 'checking',
      currency = 'USD',
      openingBalance = 0,
      isDefault = false,
      notes
    } = body

    // Validation
    if (!accountName || !accountNumber || !bankName) {
      return NextResponse.json(
        { error: 'Account name, account number, and bank name are required' },
        { status: 400 }
      )
    }

    // Validate account number format (basic check)
    if (accountNumber.length < 4) {
      return NextResponse.json(
        { error: 'Account number must be at least 4 characters' },
        { status: 400 }
      )
    }

    // If this is set as default, unset other defaults
    if (isDefault) {
      await db.bankAccount.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false }
      })
    }

    // Mask account number for security (show last 4 digits)
    const maskedNumber = accountNumber.length > 4
      ? '****' + accountNumber.slice(-4)
      : accountNumber

    const account = await db.bankAccount.create({
      data: {
        tenantId,
        propertyId,
        accountName,
        accountNumber: maskedNumber,
        bankName,
        bankCode,
        accountType,
        currency,
        openingBalance,
        currentBalance: openingBalance,
        isDefault,
        notes,
        status: 'active'
      }
    })

    // Audit log
    await auditLogService.log({
      tenantId,
      userId: user.id,
      module: 'billing',
      action: 'create',
      entityType: 'bank_account',
      entityId: account.id,
      newValue: {
        accountName,
        bankName,
        accountType,
        currency,
        openingBalance,
        isDefault
      }
    })

    return NextResponse.json(account, { status: 201 })
  } catch (error: any) {
    console.error('Error creating bank account:', error)
    return NextResponse.json(
      { error: 'Failed to process bank account request' },
      { status: 500 }
    )
  }
}

// PUT /api/accounting/bank-accounts - Update bank account
export async function PUT(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions - updating requires manage permission
    if (!hasAnyPermission(user, ['accounting.manage', 'accounting.bank_accounts', 'admin.accounting', '*'])) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const tenantId = user.tenantId
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 })
    }

    // Check if account exists and belongs to tenant
    const existing = await db.bankAccount.findFirst({
      where: { id, tenantId, deletedAt: null }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 })
    }

    // If setting as default, unset other defaults
    if (updateData.isDefault) {
      await db.bankAccount.updateMany({
        where: { tenantId, isDefault: true, id: { not: id } },
        data: { isDefault: false }
      })
    }

    // Mask account number if being updated
    if (updateData.accountNumber && updateData.accountNumber.length > 4) {
      updateData.accountNumber = '****' + updateData.accountNumber.slice(-4)
    }

    // Remove fields that shouldn't be updated directly
    delete updateData.tenantId
    delete updateData.currentBalance
    delete updateData.lastReconciledAt
    delete updateData.lastStatementDate

    const account = await db.bankAccount.update({
      where: { id },
      data: updateData
    })

    // Audit log
    await auditLogService.log({
      tenantId,
      userId: user.id,
      module: 'billing',
      action: 'update',
      entityType: 'bank_account',
      entityId: id,
      oldValue: { accountName: existing.accountName, bankName: existing.bankName },
      newValue: updateData
    })

    return NextResponse.json(account)
  } catch (error: any) {
    console.error('Error updating bank account:', error)
    return NextResponse.json(
      { error: 'Failed to process bank account request' },
      { status: 500 }
    )
  }
}

// DELETE /api/accounting/bank-accounts - Soft delete bank account
export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions - deleting requires manage permission
    if (!hasAnyPermission(user, ['accounting.manage', 'accounting.bank_accounts', 'admin.accounting', '*'])) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const tenantId = user.tenantId
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 })
    }

    // Check if account exists and belongs to tenant
    const existing = await db.bankAccount.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        _count: {
          select: { transactions: true }
        }
      }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 })
    }

    // Check for unreconciled transactions
    const unreconciledTransactions = await db.bankTransaction.count({
      where: {
        bankAccountId: id,
        isReconciled: false,
        deletedAt: null
      }
    })

    if (unreconciledTransactions > 0) {
      return NextResponse.json({
        error: 'Cannot delete account with unreconciled transactions',
        unreconciledCount: unreconciledTransactions
      }, { status: 400 })
    }

    // Soft delete
    await db.bankAccount.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'closed' }
    })

    // Audit log
    await auditLogService.log({
      tenantId,
      userId: user.id,
      module: 'billing',
      action: 'delete',
      entityType: 'bank_account',
      entityId: id,
      oldValue: { accountName: existing.accountName, bankName: existing.bankName }
    })

    return NextResponse.json({ success: true, message: 'Bank account deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting bank account:', error)
    return NextResponse.json(
      { error: 'Failed to process bank account request' },
      { status: 500 }
    )
  }
}
