import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers'
import { auditLogService } from '@/lib/services/audit-service'
import { nanoid } from 'nanoid'

// GET /api/accounting/bank-transactions - List bank transactions with filtering
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    if (!hasAnyPermission(user, ['accounting.view', 'accounting.transactions', 'admin.accounting', '*'])) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const tenantId = user.tenantId
    const { searchParams } = new URL(request.url)
    const bankAccountId = searchParams.get('bankAccountId')
    const transactionType = searchParams.get('transactionType')
    const isReconciled = searchParams.get('isReconciled')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const minAmount = searchParams.get('minAmount')
    const maxAmount = searchParams.get('maxAmount')
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const importBatchId = searchParams.get('importBatchId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const skip = (page - 1) * limit

    const where: any = {
      tenantId,
      deletedAt: null
    }

    if (bankAccountId) where.bankAccountId = bankAccountId
    if (transactionType) where.transactionType = transactionType
    if (isReconciled !== null) where.isReconciled = isReconciled === 'true'
    if (category) where.category = category
    if (importBatchId) where.importBatchId = importBatchId
    if (minAmount || maxAmount) {
      where.amount = {}
      if (minAmount) where.amount.gte = parseFloat(minAmount)
      if (maxAmount) where.amount.lte = parseFloat(maxAmount)
    }
    if (startDate || endDate) {
      where.transactionDate = {}
      if (startDate) where.transactionDate.gte = new Date(startDate)
      if (endDate) where.transactionDate.lte = new Date(endDate)
    }
    if (search) {
      where.OR = [
        { description: { contains: search } },
        { reference: { contains: search } },
        { payeeName: { contains: search } },
        { chequeNumber: { contains: search } }
      ]
    }

    const [transactions, total] = await Promise.all([
      db.bankTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { transactionDate: 'desc' },
        include: {
          bankAccount: {
            select: {
              id: true,
              accountName: true,
              bankName: true,
              accountNumber: true
            }
          },
          reconciliations: {
            select: {
              id: true,
              status: true,
              reconciledAmount: true,
              paymentId: true
            }
          }
        }
      }),
      db.bankTransaction.count({ where })
    ])

    // Calculate summary stats
    const stats = await db.bankTransaction.aggregate({
      where,
      _sum: {
        amount: true
      },
      _count: {
        id: true
      }
    })

    // Stats by type
    const credits = await db.bankTransaction.aggregate({
      where: { ...where, transactionType: 'credit' },
      _sum: { amount: true },
      _count: { id: true }
    })

    const debits = await db.bankTransaction.aggregate({
      where: { ...where, transactionType: 'debit' },
      _sum: { amount: true },
      _count: { id: true }
    })

    // Unreconciled count
    const unreconciledCount = await db.bankTransaction.count({
      where: { ...where, isReconciled: false }
    })

    return NextResponse.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      stats: {
        totalTransactions: stats._count.id,
        totalAmount: stats._sum.amount || 0,
        totalCredits: credits._sum.amount || 0,
        creditCount: credits._count.id,
        totalDebits: debits._sum.amount || 0,
        debitCount: debits._count.id,
        unreconciledCount
      }
    })
  } catch (error: any) {
    console.error('Error fetching bank transactions:', error)
    return NextResponse.json(
      { error: 'Failed to process bank transaction request' },
      { status: 500 }
    )
  }
}

// POST /api/accounting/bank-transactions - Import bank statement (CSV/manual entry)
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions - creating requires manage permission
    if (!hasAnyPermission(user, ['accounting.manage', 'accounting.transactions', 'admin.accounting', '*'])) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const tenantId = user.tenantId
    const body = await request.json()
    const { transactions, bankAccountId, importSource = 'manual' } = body

    // Single transaction entry
    if (!transactions && body.transactionDate) {
      const {
        valueDate,
        transactionType,
        amount,
        currency = 'USD',
        balance,
        description,
        reference,
        chequeNumber,
        payeeName,
        payeeAccount,
        category,
        subCategory,
        notes
      } = body

      // Validation
      if (!bankAccountId || !body.transactionDate || !transactionType || amount === undefined) {
        return NextResponse.json(
          { error: 'Bank account, transaction date, type, and amount are required' },
          { status: 400 }
        )
      }

      // Validate transaction type
      if (!['credit', 'debit'].includes(transactionType)) {
        return NextResponse.json(
          { error: 'Transaction type must be credit or debit' },
          { status: 400 }
        )
      }

      // Validate amount is positive
      if (parseFloat(amount) < 0) {
        return NextResponse.json(
          { error: 'Amount cannot be negative' },
          { status: 400 }
        )
      }

      // Verify bank account exists
      const bankAccount = await db.bankAccount.findFirst({
        where: { id: bankAccountId, tenantId, deletedAt: null }
      })

      if (!bankAccount) {
        return NextResponse.json({ error: 'Bank account not found' }, { status: 404 })
      }

      const transaction = await db.bankTransaction.create({
        data: {
          tenantId,
          bankAccountId,
          transactionDate: new Date(body.transactionDate),
          valueDate: valueDate ? new Date(valueDate) : null,
          transactionType,
          amount: parseFloat(amount),
          currency,
          balance: balance ? parseFloat(balance) : null,
          description,
          reference,
          chequeNumber,
          payeeName,
          payeeAccount,
          category,
          subCategory,
          notes,
          importSource
        }
      })

      // Update bank account balance
      const balanceChange = transactionType === 'credit' ? parseFloat(amount) : -parseFloat(amount)
      await db.bankAccount.update({
        where: { id: bankAccountId },
        data: {
          currentBalance: { increment: balanceChange }
        }
      })

      // Audit log
      await auditLogService.log({
        tenantId,
        userId: user.id,
        module: 'billing',
        action: 'create',
        entityType: 'bank_transaction',
        entityId: transaction.id,
        newValue: {
          bankAccountId,
          transactionType,
          amount: parseFloat(amount),
          description,
          transactionDate: body.transactionDate
        }
      })

      return NextResponse.json(transaction, { status: 201 })
    }

    // Bulk import (CSV)
    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json(
        { error: 'Transactions array is required for bulk import' },
        { status: 400 }
      )
    }

    // Cap bulk import size
    if (transactions.length > 1000) {
      return NextResponse.json(
        { error: 'Maximum 1000 transactions allowed per bulk import' },
        { status: 400 }
      )
    }

    // Verify bank account exists
    const bankAccount = await db.bankAccount.findFirst({
      where: { id: bankAccountId, tenantId, deletedAt: null }
    })

    if (!bankAccount) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 })
    }

    // Generate batch ID for this import
    const importBatchId = `BATCH-${nanoid(10)}-${Date.now()}`

    // Prepare transactions for insertion
    const transactionsToCreate = transactions.map((tx: any) => ({
      tenantId,
      bankAccountId,
      transactionDate: new Date(tx.transactionDate || tx.date),
      valueDate: tx.valueDate ? new Date(tx.valueDate) : null,
      transactionType: tx.transactionType || tx.type || 'credit',
      amount: parseFloat(tx.amount) || 0,
      currency: tx.currency || bankAccount.currency,
      balance: tx.balance ? parseFloat(tx.balance) : null,
      description: tx.description || tx.narration || tx.particulars,
      reference: tx.reference || tx.refNumber,
      chequeNumber: tx.chequeNumber || tx.chequeNo,
      payeeName: tx.payeeName || tx.beneficiary,
      payeeAccount: tx.payeeAccount,
      category: tx.category,
      subCategory: tx.subCategory,
      notes: tx.notes,
      importSource: 'csv',
      importBatchId,
      rawLine: tx.rawLine || JSON.stringify(tx)
    }))

    // Create all transactions
    const createdTransactions = await db.bankTransaction.createMany({
      data: transactionsToCreate,
    })

    // Calculate total balance change
    const totalCredits = transactionsToCreate
      .filter(tx => tx.transactionType === 'credit')
      .reduce((sum, tx) => sum + tx.amount, 0)
    const totalDebits = transactionsToCreate
      .filter(tx => tx.transactionType === 'debit')
      .reduce((sum, tx) => sum + tx.amount, 0)
    const netChange = totalCredits - totalDebits

    // Update bank account balance
    await db.bankAccount.update({
      where: { id: bankAccountId },
      data: {
        currentBalance: { increment: netChange },
        lastStatementDate: new Date()
      }
    })

    // Audit log for bulk import
    await auditLogService.log({
      tenantId,
      userId: user.id,
      module: 'billing',
      action: 'import',
      entityType: 'bank_transaction',
      newValue: {
        bankAccountId,
        importBatchId,
        count: createdTransactions.count,
        totalCredits,
        totalDebits,
        netChange
      }
    })

    return NextResponse.json({
      success: true,
      importBatchId,
      importedCount: createdTransactions.count,
      totalCredits,
      totalDebits,
      netChange
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating bank transaction:', error)
    return NextResponse.json(
      { error: 'Failed to process bank transaction request' },
      { status: 500 }
    )
  }
}

// PUT /api/accounting/bank-transactions - Update transaction
export async function PUT(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions - updating requires manage permission
    if (!hasAnyPermission(user, ['accounting.manage', 'accounting.transactions', 'admin.accounting', '*'])) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const tenantId = user.tenantId
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 })
    }

    // Check if transaction exists and belongs to tenant
    const existing = await db.bankTransaction.findFirst({
      where: { id, tenantId, deletedAt: null }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Cannot modify reconciled transactions
    if (existing.isReconciled) {
      return NextResponse.json(
        { error: 'Cannot modify reconciled transaction. Unreconcile first.' },
        { status: 400 }
      )
    }

    // Validate transaction type if being updated
    if (updateData.transactionType && !['credit', 'debit'].includes(updateData.transactionType)) {
      return NextResponse.json(
        { error: 'Transaction type must be credit or debit' },
        { status: 400 }
      )
    }

    // Validate amount if being updated
    if (updateData.amount !== undefined && parseFloat(updateData.amount) < 0) {
      return NextResponse.json(
        { error: 'Amount cannot be negative' },
        { status: 400 }
      )
    }

    // Prepare update data
    const dataToUpdate: any = {}

    if (updateData.transactionDate) dataToUpdate.transactionDate = new Date(updateData.transactionDate)
    if (updateData.valueDate !== undefined) dataToUpdate.valueDate = updateData.valueDate ? new Date(updateData.valueDate) : null
    if (updateData.transactionType) dataToUpdate.transactionType = updateData.transactionType
    if (updateData.amount !== undefined) dataToUpdate.amount = parseFloat(updateData.amount)
    if (updateData.currency) dataToUpdate.currency = updateData.currency
    if (updateData.balance !== undefined) dataToUpdate.balance = updateData.balance ? parseFloat(updateData.balance) : null
    if (updateData.description !== undefined) dataToUpdate.description = updateData.description
    if (updateData.reference !== undefined) dataToUpdate.reference = updateData.reference
    if (updateData.chequeNumber !== undefined) dataToUpdate.chequeNumber = updateData.chequeNumber
    if (updateData.payeeName !== undefined) dataToUpdate.payeeName = updateData.payeeName
    if (updateData.payeeAccount !== undefined) dataToUpdate.payeeAccount = updateData.payeeAccount
    if (updateData.category !== undefined) dataToUpdate.category = updateData.category
    if (updateData.subCategory !== undefined) dataToUpdate.subCategory = updateData.subCategory
    if (updateData.notes !== undefined) dataToUpdate.notes = updateData.notes

    // Handle amount changes - update bank balance
    if (updateData.amount !== undefined && updateData.amount !== existing.amount) {
      const oldAmountChange = existing.transactionType === 'credit' ? existing.amount : -existing.amount
      const newAmountChange = (updateData.transactionType || existing.transactionType) === 'credit'
        ? parseFloat(updateData.amount)
        : -parseFloat(updateData.amount)

      const balanceAdjustment = newAmountChange - oldAmountChange

      await db.bankAccount.update({
        where: { id: existing.bankAccountId },
        data: { currentBalance: { increment: balanceAdjustment } }
      })
    }

    const transaction = await db.bankTransaction.update({
      where: { id },
      data: dataToUpdate
    })

    // Audit log
    await auditLogService.log({
      tenantId,
      userId: user.id,
      module: 'billing',
      action: 'update',
      entityType: 'bank_transaction',
      entityId: id,
      oldValue: { amount: existing.amount, description: existing.description },
      newValue: dataToUpdate
    })

    return NextResponse.json(transaction)
  } catch (error: any) {
    console.error('Error updating bank transaction:', error)
    return NextResponse.json(
      { error: 'Failed to process bank transaction request' },
      { status: 500 }
    )
  }
}

// DELETE /api/accounting/bank-transactions - Remove transaction
export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions - deleting requires manage permission
    if (!hasAnyPermission(user, ['accounting.manage', 'accounting.transactions', 'admin.accounting', '*'])) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const tenantId = user.tenantId
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const batchId = searchParams.get('batchId')

    if (!id && !batchId) {
      return NextResponse.json({ error: 'Transaction ID or Batch ID is required' }, { status: 400 })
    }

    // Delete by batch ID
    if (batchId) {
      // Check for reconciled transactions in batch
      const reconciledCount = await db.bankTransaction.count({
        where: { tenantId, importBatchId: batchId, isReconciled: true, deletedAt: null }
      })

      if (reconciledCount > 0) {
        return NextResponse.json({
          error: 'Cannot delete batch with reconciled transactions',
          reconciledCount
        }, { status: 400 })
      }

      // Get transactions for balance adjustment
      const transactions = await db.bankTransaction.findMany({
        where: { tenantId, importBatchId: batchId, deletedAt: null }
      })

      // Calculate net balance impact to reverse
      const netChange = transactions.reduce((sum, tx) => {
        return sum + (tx.transactionType === 'credit' ? -tx.amount : tx.amount)
      }, 0)

      // Update bank account balance
      if (transactions.length > 0) {
        await db.bankAccount.update({
          where: { id: transactions[0].bankAccountId },
          data: { currentBalance: { increment: netChange } }
        })
      }

      // Soft delete all transactions in batch
      await db.bankTransaction.updateMany({
        where: { tenantId, importBatchId: batchId },
        data: { deletedAt: new Date() }
      })

      // Audit log
      await auditLogService.log({
        tenantId,
        userId: user.id,
        module: 'billing',
        action: 'delete',
        entityType: 'bank_transaction',
        newValue: { importBatchId: batchId, deletedCount: transactions.length }
      })

      return NextResponse.json({
        success: true,
        message: 'Batch deleted successfully',
        deletedCount: transactions.length
      })
    }

    // Delete single transaction
    const existing = await db.bankTransaction.findFirst({
      where: { id: id!, tenantId, deletedAt: null }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    if (existing.isReconciled) {
      return NextResponse.json(
        { error: 'Cannot delete reconciled transaction. Unreconcile first.' },
        { status: 400 }
      )
    }

    // Reverse balance impact
    const balanceChange = existing.transactionType === 'credit' ? -existing.amount : existing.amount
    await db.bankAccount.update({
      where: { id: existing.bankAccountId },
      data: { currentBalance: { increment: balanceChange } }
    })

    // Soft delete
    await db.bankTransaction.update({
      where: { id: id! },
      data: { deletedAt: new Date() }
    })

    // Audit log
    await auditLogService.log({
      tenantId,
      userId: user.id,
      module: 'billing',
      action: 'delete',
      entityType: 'bank_transaction',
      entityId: id ?? undefined,
      oldValue: { amount: existing.amount, description: existing.description }
    })

    return NextResponse.json({ success: true, message: 'Transaction deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting bank transaction:', error)
    return NextResponse.json(
      { error: 'Failed to process bank transaction request' },
      { status: 500 }
    )
  }
}
