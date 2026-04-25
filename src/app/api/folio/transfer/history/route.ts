import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET /api/folio/transfer/history?folioId=xxx - Get transfer history for a folio
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['billing.manage', 'billing.view', 'admin.billing', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }
    const tenantId = user.tenantId;

    const searchParams = request.nextUrl.searchParams;
    const folioId = searchParams.get('folioId');

    if (!folioId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: folioId' } },
        { status: 400 }
      );
    }

    // Verify folio belongs to tenant
    const folio = await db.folio.findFirst({
      where: { id: folioId, tenantId },
      select: { id: true },
    });

    if (!folio) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Folio not found' } }, { status: 404 });
    }

    const transfers = await db.folioTransfer.findMany({
      where: {
        tenantId,
        OR: [
          { fromFolioId: folioId },
          { toFolioId: folioId },
        ],
      },
      include: {
        fromFolio: {
          select: {
            id: true,
            folioNumber: true,
            booking: {
              select: {
                id: true,
                confirmationCode: true,
                primaryGuest: { select: { id: true, firstName: true, lastName: true } },
              },
            },
          },
        },
        toFolio: {
          select: {
            id: true,
            folioNumber: true,
            booking: {
              select: {
                id: true,
                confirmationCode: true,
                primaryGuest: { select: { id: true, firstName: true, lastName: true } },
              },
            },
          },
        },
        transferredByUser: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: transfers });
  } catch (error) {
    console.error('Error fetching transfer history:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch transfer history' } },
      { status: 500 }
    );
  }
}
