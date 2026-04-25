import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';// POST /api/loyalty/programs/[id]/earn - Auto-earn loyalty points
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const user = await requirePermission(request, 'crm.loyalty'); if (user instanceof NextResponse) return user;
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const tenantId = user.tenantId;
    const { id: programId } = await params;
    const body = await request.json();
    const { guestId, points, source, description } = body;

    // Validate required fields
    if (!guestId || points === undefined || points <= 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'guestId and a positive points value are required' } },
        { status: 400 }
      );
    }

    // Verify program (tier) exists and belongs to tenant
    const program = await db.loyaltyTier.findUnique({
      where: { id: programId },
    });

    if (!program || program.tenantId !== tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Loyalty program not found' } },
        { status: 404 }
      );
    }

    // Find the guest and verify they belong to the tenant
    const guest = await db.guest.findUnique({
      where: { id: guestId, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        loyaltyPoints: true,
        loyaltyTier: true,
        tenantId: true,
      },
    });

    if (!guest) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Guest not found' } },
        { status: 404 }
      );
    }

    if (guest.tenantId !== tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Guest does not belong to this tenant' } },
        { status: 403 }
      );
    }

    // Use atomic increment inside a transaction to prevent TOCTOU race condition.
    // Concurrent earn calls no longer lose points due to stale reads.
    const previousBalance = guest.loyaltyPoints;
    const result = await db.$transaction(async (tx) => {
      // Atomic increment — the database handles concurrency safely
      const updatedGuest = await tx.guest.update({
        where: { id: guestId },
        data: { loyaltyPoints: { increment: points } },
      });

      const transaction = await tx.loyaltyPointTransaction.create({
        data: {
          tenantId,
          guestId,
          points,
          balance: updatedGuest.loyaltyPoints,
          type: 'earn',
          source: source || 'manual',
          description: description || `Earned ${points} points`,
        },
      });

      return { transaction, newBalance: updatedGuest.loyaltyPoints };
    });

    return NextResponse.json({
      success: true,
      data: {
        transaction: result.transaction,
        guestId,
        previousBalance,
        newBalance: result.newBalance,
        pointsEarned: points,
      },
      message: `${points} points earned successfully`,
    }, { status: 201 });
  } catch (error) {
    console.error('Error earning loyalty points:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to earn loyalty points' } },
      { status: 500 }
    );
  }
}
