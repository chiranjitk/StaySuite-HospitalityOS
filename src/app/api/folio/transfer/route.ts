import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// POST /api/folio/transfer - Transfer charges between folios
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['billing.manage', 'admin.billing', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }
    const tenantId = user.tenantId;

    const body = await request.json();
    const {
      fromFolioId,
      toFolioId,
      folioLineItemIds,
      amount,
      reason,
      description,
      bookingId,
    } = body;

    if (!fromFolioId || !toFolioId || !reason) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: fromFolioId, toFolioId, reason' } },
        { status: 400 }
      );
    }

    if (fromFolioId === toFolioId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Source and target folio cannot be the same' } },
        { status: 400 }
      );
    }

    if (!folioLineItemIds?.length && (!amount || amount <= 0)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Provide either folioLineItemIds or a positive amount' } },
        { status: 400 }
      );
    }

    const validReasons = ['split_bill', 'room_move', 'correction', 'group_transfer'];
    if (!validReasons.includes(reason)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid reason. Must be one of: ${validReasons.join(', ')}` } },
        { status: 400 }
      );
    }

    // Validate both folios exist and belong to tenant
    const [fromFolio, toFolio] = await Promise.all([
      db.folio.findFirst({ where: { id: fromFolioId, tenantId } }),
      db.folio.findFirst({ where: { id: toFolioId, tenantId } }),
    ]);

    if (!fromFolio) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Source folio not found' } }, { status: 404 });
    }
    if (!toFolio) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Target folio not found' } }, { status: 404 });
    }

    if (fromFolio.status === 'closed' || toFolio.status === 'closed') {
      return NextResponse.json(
        { success: false, error: { code: 'FOLIO_CLOSED', message: 'Cannot transfer to/from a closed folio' } },
        { status: 400 }
      );
    }

    const result = await db.$transaction(async (tx) => {
      const transfers: Record<string, unknown>[] = [];
      let totalTransferred = 0;

      if (folioLineItemIds && folioLineItemIds.length > 0) {
        // Transfer specific line items
        const lineItems = await tx.folioLineItem.findMany({
          where: { id: { in: folioLineItemIds }, folioId: fromFolioId },
        });

        if (lineItems.length !== folioLineItemIds.length) {
          throw new Error('Some line items not found in source folio');
        }

        for (const item of lineItems) {
          const transferAmount = item.totalAmount + item.taxAmount;

          // Create credit on source folio
          await tx.folioLineItem.create({
            data: {
              folioId: fromFolioId,
              description: `Transfer credit: ${item.description}`,
              category: 'other',
              quantity: 1,
              unitPrice: -transferAmount,
              totalAmount: -transferAmount,
              taxRate: 0,
              taxAmount: 0,
              serviceDate: new Date(),
              postedBy: user.id,
            },
          });

          // Create debit on target folio
          await tx.folioLineItem.create({
            data: {
              folioId: toFolioId,
              description: `Transfer from folio ${fromFolio.folioNumber}: ${item.description}`,
              category: item.category,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalAmount: item.totalAmount,
              taxRate: item.taxRate,
              taxAmount: item.taxAmount,
              serviceDate: item.serviceDate,
              postedBy: user.id,
            },
          });

          // Create FolioTransfer record for each item
          const transfer = await tx.folioTransfer.create({
            data: {
              tenantId,
              propertyId: fromFolio.propertyId,
              fromFolioId,
              toFolioId,
              folioLineItemId: item.id,
              bookingId: bookingId || null,
              amount: transferAmount,
              currency: fromFolio.currency,
              reason,
              description: description || `Transfer: ${item.description}`,
              status: 'completed',
              transferredBy: user.id,
            },
          });

          transfers.push(transfer);
          totalTransferred += transferAmount;
        }

        // Delete original line items from source
        await tx.folioLineItem.deleteMany({
          where: { id: { in: folioLineItemIds }, folioId: fromFolioId },
        });
      } else {
        // Transfer a flat amount
        const transferAmount = parseFloat(amount);

        // Create credit on source folio
        await tx.folioLineItem.create({
          data: {
            folioId: fromFolioId,
            description: `Transfer credit to folio ${toFolio.folioNumber}`,
            category: 'other',
            quantity: 1,
            unitPrice: -transferAmount,
            totalAmount: -transferAmount,
            taxRate: 0,
            taxAmount: 0,
            serviceDate: new Date(),
            postedBy: user.id,
          },
        });

        // Create debit on target folio
        await tx.folioLineItem.create({
          data: {
            folioId: toFolioId,
            description: `Transfer from folio ${fromFolio.folioNumber}`,
            category: 'other',
            quantity: 1,
            unitPrice: transferAmount,
            totalAmount: transferAmount,
            taxRate: 0,
            taxAmount: 0,
            serviceDate: new Date(),
            postedBy: user.id,
          },
        });

        const transfer = await tx.folioTransfer.create({
          data: {
            tenantId,
            propertyId: fromFolio.propertyId,
            fromFolioId,
            toFolioId,
            bookingId: bookingId || null,
            amount: transferAmount,
            currency: fromFolio.currency,
            reason,
            description: description || `Transfer of ${transferAmount} ${fromFolio.currency}`,
            status: 'completed',
            transferredBy: user.id,
          },
        });

        transfers.push(transfer);
        totalTransferred = transferAmount;
      }

      // Recalculate from folio balance
      const fromLineItems = await tx.folioLineItem.findMany({
        where: { folioId: fromFolioId },
      });
      const fromSubtotal = fromLineItems.reduce((sum, item) => sum + item.totalAmount, 0);
      const fromTaxes = fromLineItems.reduce((sum, item) => sum + item.taxAmount, 0);
      const fromTotal = fromSubtotal + fromTaxes;

      const fromPayments = await tx.payment.findMany({
        where: { folioId: fromFolioId, status: 'completed' },
      });
      const fromPaid = fromPayments.reduce((sum, p) => sum + p.amount, 0);

      const updatedFromFolio = await tx.folio.update({
        where: { id: fromFolioId },
        data: {
          subtotal: fromSubtotal,
          taxes: fromTaxes,
          totalAmount: fromTotal,
          balance: Math.max(0, fromTotal - fromPaid),
          paidAmount: fromPaid,
        },
      });

      // Recalculate to folio balance
      const toLineItems = await tx.folioLineItem.findMany({
        where: { folioId: toFolioId },
      });
      const toSubtotal = toLineItems.reduce((sum, item) => sum + item.totalAmount, 0);
      const toTaxes = toLineItems.reduce((sum, item) => sum + item.taxAmount, 0);
      const toTotal = toSubtotal + toTaxes;

      const toPayments = await tx.payment.findMany({
        where: { folioId: toFolioId, status: 'completed' },
      });
      const toPaid = toPayments.reduce((sum, p) => sum + p.amount, 0);

      const updatedToFolio = await tx.folio.update({
        where: { id: toFolioId },
        data: {
          subtotal: toSubtotal,
          taxes: toTaxes,
          totalAmount: toTotal,
          balance: Math.max(0, toTotal - toPaid),
          paidAmount: toPaid,
        },
      });

      return {
        transfers,
        totalTransferred,
        fromFolio: updatedFromFolio,
        toFolio: updatedToFolio,
      };
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    console.error('Error processing folio transfer:', error);
    const message = error instanceof Error ? error.message : 'Failed to process folio transfer';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}
