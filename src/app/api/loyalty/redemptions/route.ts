import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import crypto from 'crypto';

const MAX_LIMIT = 100;

// GET /api/loyalty/redemptions - List redemption history for guest
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const tenantId = user.tenantId;
    const { searchParams } = new URL(request.url);
    const guestId = searchParams.get('guestId');
    const status = searchParams.get('status');
    const rewardId = searchParams.get('rewardId');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };

    if (guestId) {
      where.guestId = guestId;
    }

    if (status) {
      where.status = status;
    }

    if (rewardId) {
      where.rewardId = rewardId;
    }

    const [redemptions, total] = await Promise.all([
      db.loyaltyRedemption.findMany({
        where,
        include: {
          guest: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              loyaltyTier: true,
            },
          },
          reward: {
            select: {
              id: true,
              name: true,
              category: true,
              pointsCost: true,
              imageUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.loyaltyRedemption.count({ where }),
    ]);

    // Summary stats
    const stats = await db.loyaltyRedemption.aggregate({
      where: { tenantId },
      _count: { id: true },
      _sum: { pointsSpent: true },
    });

    const statusBreakdown = await db.loyaltyRedemption.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { id: true },
    });

    return NextResponse.json({
      success: true,
      data: redemptions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        totalRedemptions: stats._count.id,
        totalPointsSpent: stats._sum.pointsSpent || 0,
        byStatus: statusBreakdown.reduce((acc, s) => {
          acc[s.status] = s._count.id;
          return acc;
        }, {} as Record<string, number>),
      },
    });
  } catch (error) {
    console.error('Error fetching redemptions:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch redemptions' } },
      { status: 500 }
    );
  }
}

// POST /api/loyalty/redemptions - Redeem points for reward
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const {
      guestId,
      rewardId,
      notes,
    } = body;

    if (!guestId || !rewardId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Guest ID and Reward ID are required' } },
        { status: 400 }
      );
    }

    // Use transaction to ensure data consistency
    const result = await db.$transaction(async (tx) => {
      // Get guest with current points
      const guest = await tx.guest.findUnique({
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
        throw new Error('GUEST_NOT_FOUND');
      }

      // Verify tenant matches
      if (guest.tenantId !== tenantId) {
        throw new Error('TENANT_MISMATCH');
      }

      // Get reward details
      const reward = await tx.loyaltyReward.findUnique({
        where: { id: rewardId },
      });

      if (!reward) {
        throw new Error('REWARD_NOT_FOUND');
      }

      // Verify reward belongs to same tenant
      if (reward.tenantId !== tenantId) {
        throw new Error('REWARD_TENANT_MISMATCH');
      }

      // Check reward availability
      if (!reward.isAvailable) {
        throw new Error('REWARD_NOT_AVAILABLE');
      }

      const now = new Date();
      if (reward.availableFrom && new Date(reward.availableFrom) > now) {
        throw new Error('REWARD_NOT_YET_AVAILABLE');
      }

      if (reward.availableUntil && new Date(reward.availableUntil) < now) {
        throw new Error('REWARD_EXPIRED');
      }

      if (reward.maxRedemptions && reward.currentRedemptions >= reward.maxRedemptions) {
        throw new Error('REWARD_LIMIT_REACHED');
      }

      // Check tier requirement
      if (reward.minTierRequired) {
        const tiers = await tx.loyaltyTier.findMany({
          where: { tenantId },
          orderBy: { minPoints: 'asc' },
        });
        const tierOrder = tiers.map(t => t.name);
        const guestTierIndex = tierOrder.indexOf(guest.loyaltyTier);
        const requiredTierIndex = tierOrder.indexOf(reward.minTierRequired);

        if (guestTierIndex < requiredTierIndex) {
          throw new Error('INSUFFICIENT_TIER');
        }
      }

      // Validate point balance
      if (guest.loyaltyPoints < reward.pointsCost) {
        throw new Error('INSUFFICIENT_POINTS');
      }

      // Generate redemption code
      const redemptionCode = `RDM-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

      // Create redemption record
      const redemption = await tx.loyaltyRedemption.create({
        data: {
          tenantId,
          guestId,
          rewardId,
          pointsSpent: reward.pointsCost,
          status: 'completed',
          redemptionCode,
          redeemedAt: now,
          expiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000), // 1 year expiry
          notes,
        },
      });

      // Update guest points
      const newPoints = guest.loyaltyPoints - reward.pointsCost;
      await tx.guest.update({
        where: { id: guestId },
        data: { loyaltyPoints: newPoints },
      });

      // Create point transaction record
      await tx.loyaltyPointTransaction.create({
        data: {
          tenantId,
          guestId,
          points: -reward.pointsCost,
          balance: newPoints,
          type: 'redeem',
          source: 'redemption',
          referenceId: redemption.id,
          referenceType: 'LoyaltyRedemption',
          description: `Redeemed: ${reward.name}`,
        },
      });

      // Update reward redemption count
      await tx.loyaltyReward.update({
        where: { id: rewardId },
        data: { currentRedemptions: { increment: 1 } },
      });

      return { redemption, newPoints };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });

    return NextResponse.json({
      success: true,
      data: {
        redemption: result.redemption,
        newPointsBalance: result.newPoints,
      },
      message: 'Reward redeemed successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Error processing redemption:', error);

    // Handle specific errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorMap: Record<string, { code: string; message: string; status: number }> = {
      'GUEST_NOT_FOUND': { code: 'NOT_FOUND', message: 'Guest not found', status: 404 },
      'TENANT_MISMATCH': { code: 'FORBIDDEN', message: 'Guest does not belong to tenant', status: 403 },
      'REWARD_NOT_FOUND': { code: 'NOT_FOUND', message: 'Reward not found', status: 404 },
      'REWARD_TENANT_MISMATCH': { code: 'FORBIDDEN', message: 'Reward does not belong to tenant', status: 403 },
      'REWARD_NOT_AVAILABLE': { code: 'VALIDATION_ERROR', message: 'Reward is not available', status: 400 },
      'REWARD_NOT_YET_AVAILABLE': { code: 'VALIDATION_ERROR', message: 'Reward is not yet available', status: 400 },
      'REWARD_EXPIRED': { code: 'VALIDATION_ERROR', message: 'Reward availability has expired', status: 400 },
      'REWARD_LIMIT_REACHED': { code: 'VALIDATION_ERROR', message: 'Maximum redemptions reached for this reward', status: 400 },
      'INSUFFICIENT_TIER': { code: 'VALIDATION_ERROR', message: 'Guest tier is insufficient for this reward', status: 400 },
      'INSUFFICIENT_POINTS': { code: 'VALIDATION_ERROR', message: 'Insufficient points balance', status: 400 },
    };

    const mappedError = errorMap[errorMessage] || { code: 'INTERNAL_ERROR', message: 'Failed to process redemption', status: 500 };

    return NextResponse.json(
      { success: false, error: { code: mappedError.code, message: mappedError.message } },
      { status: mappedError.status }
    );
  }
}

// PUT /api/loyalty/redemptions - Cancel or update redemption
export async function PUT(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Check permission
    if (!hasPermission(user, 'loyalty.manage') && !hasPermission(user, 'guests.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, status, cancelledReason } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Redemption ID is required' } },
        { status: 400 }
      );
    }

    const existing = await db.loyaltyRedemption.findUnique({
      where: { id },
      include: { reward: true, guest: true },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Redemption not found' } },
        { status: 404 }
      );
    }

    // Verify redemption belongs to user's tenant
    if (existing.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Validate status transitions
    const validStatuses = ['completed', 'cancelled', 'expired', 'used'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid status' } },
        { status: 400 }
      );
    }

    if (status === 'cancelled') {
      // Check if already cancelled
      if (existing.status === 'cancelled') {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Redemption is already cancelled' } },
          { status: 400 }
        );
      }

      // Use transaction for cancellation with point refund
      const result = await db.$transaction(async (tx) => {
        // Update redemption status
        const updated = await tx.loyaltyRedemption.update({
          where: { id },
          data: {
            status: 'cancelled',
            cancelledAt: new Date(),
            cancelledReason,
          },
        });

        // Refund points to guest
        const newPoints = existing.guest.loyaltyPoints + existing.pointsSpent;
        await tx.guest.update({
          where: { id: existing.guestId },
          data: { loyaltyPoints: newPoints },
        });

        // Create refund transaction
        await tx.loyaltyPointTransaction.create({
          data: {
            tenantId: existing.tenantId,
            guestId: existing.guestId,
            points: existing.pointsSpent,
            balance: newPoints,
            type: 'adjust',
            source: 'cancellation',
            referenceId: id,
            referenceType: 'LoyaltyRedemption',
            description: `Refund from cancelled redemption: ${existing.reward.name}`,
          },
        });

        // Decrease reward redemption count
        await tx.loyaltyReward.update({
          where: { id: existing.rewardId },
          data: { currentRedemptions: { decrement: 1 } },
        });

        return { updated, newPoints };
      });

      return NextResponse.json({
        success: true,
        data: result.updated,
        refundedPoints: existing.pointsSpent,
        newPointsBalance: result.newPoints,
      });
    }

    // Simple status update for other statuses
    const updated = await db.loyaltyRedemption.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating redemption:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update redemption' } },
      { status: 500 }
    );
  }
}
