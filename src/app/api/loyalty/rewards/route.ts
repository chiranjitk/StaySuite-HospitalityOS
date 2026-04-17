import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

const MAX_LIMIT = 100;

// GET /api/loyalty/rewards - List available rewards
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
    const category = searchParams.get('category');
    const isAvailable = searchParams.get('isAvailable');
    const minTier = searchParams.get('minTier');

    const where: Record<string, unknown> = { tenantId };

    if (category) {
      where.category = category;
    }

    if (isAvailable !== null) {
      where.isAvailable = isAvailable === 'true';
    }

    if (minTier) {
      where.minTierRequired = minTier;
    }

    const rewards = await db.loyaltyReward.findMany({
      where,
      include: {
        _count: {
          select: { redemptions: true },
        },
      },
      orderBy: [
        { sortOrder: 'asc' },
        { pointsCost: 'asc' },
      ],
      take: MAX_LIMIT,
    });

    // Filter by current availability
    const now = new Date();
    const availableRewards = rewards.filter(reward => {
      if (!reward.isAvailable) return false;
      if (reward.availableFrom && new Date(reward.availableFrom) > now) return false;
      if (reward.availableUntil && new Date(reward.availableUntil) < now) return false;
      if (reward.maxRedemptions && reward.currentRedemptions >= reward.maxRedemptions) return false;
      return true;
    });

    return NextResponse.json({
      success: true,
      data: rewards,
      available: availableRewards,
      summary: {
        total: rewards.length,
        available: availableRewards.length,
        byCategory: rewards.reduce((acc, r) => {
          acc[r.category] = (acc[r.category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      },
    });
  } catch (error) {
    console.error('Error fetching rewards:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch rewards' } },
      { status: 500 }
    );
  }
}

// POST /api/loyalty/rewards - Create new reward
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

    // Check permission
    if (!hasPermission(user, 'loyalty.manage') && !hasPermission(user, 'settings.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const {
      name,
      description,
      category = 'general',
      pointsCost,
      monetaryValue = 0,
      currency = 'USD',
      imageUrl,
      isAvailable = true,
      availableFrom,
      availableUntil,
      maxRedemptions,
      minTierRequired,
      termsConditions,
      sortOrder = 0,
    } = body;

    if (!name || pointsCost === undefined) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Name and pointsCost are required' } },
        { status: 400 }
      );
    }

    // Validate numeric fields
    if (pointsCost < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'pointsCost cannot be negative' } },
        { status: 400 }
      );
    }
    if (monetaryValue < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'monetaryValue cannot be negative' } },
        { status: 400 }
      );
    }
    if (maxRedemptions !== undefined && maxRedemptions !== null && maxRedemptions < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'maxRedemptions cannot be negative' } },
        { status: 400 }
      );
    }

    const reward = await db.loyaltyReward.create({
      data: {
        tenantId,
        name,
        description,
        category,
        pointsCost,
        monetaryValue,
        currency,
        imageUrl,
        isAvailable,
        availableFrom: availableFrom ? new Date(availableFrom) : null,
        availableUntil: availableUntil ? new Date(availableUntil) : null,
        maxRedemptions,
        minTierRequired,
        termsConditions,
        sortOrder,
      },
    });

    return NextResponse.json({ success: true, data: reward }, { status: 201 });
  } catch (error) {
    console.error('Error creating reward:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create reward' } },
      { status: 500 }
    );
  }
}

// PUT /api/loyalty/rewards - Update reward
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
    if (!hasPermission(user, 'loyalty.manage') && !hasPermission(user, 'settings.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Reward ID is required' } },
        { status: 400 }
      );
    }

    // Check if reward exists
    const existing = await db.loyaltyReward.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Reward not found' } },
        { status: 404 }
      );
    }

    // Verify reward belongs to user's tenant
    if (existing.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Validate numeric fields if provided
    if (updateData.pointsCost !== undefined && updateData.pointsCost < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'pointsCost cannot be negative' } },
        { status: 400 }
      );
    }
    if (updateData.monetaryValue !== undefined && updateData.monetaryValue < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'monetaryValue cannot be negative' } },
        { status: 400 }
      );
    }
    if (updateData.maxRedemptions !== undefined && updateData.maxRedemptions !== null && updateData.maxRedemptions < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'maxRedemptions cannot be negative' } },
        { status: 400 }
      );
    }

    // Prepare update data
    const data: Record<string, unknown> = {};
    const allowedFields = [
      'name', 'description', 'category', 'pointsCost', 'monetaryValue', 'currency',
      'imageUrl', 'isAvailable', 'availableFrom', 'availableUntil', 'maxRedemptions',
      'minTierRequired', 'termsConditions', 'sortOrder',
    ];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        if (field === 'availableFrom' || field === 'availableUntil') {
          data[field] = updateData[field] ? new Date(updateData[field]) : null;
        } else {
          data[field] = updateData[field];
        }
      }
    }

    const updated = await db.loyaltyReward.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating reward:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update reward' } },
      { status: 500 }
    );
  }
}

// DELETE /api/loyalty/rewards - Remove reward
export async function DELETE(request: NextRequest) {
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
    if (!hasPermission(user, 'loyalty.manage') && !hasPermission(user, 'settings.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Reward ID is required' } },
        { status: 400 }
      );
    }

    // Check if reward exists and belongs to tenant
    const existing = await db.loyaltyReward.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Reward not found' } },
        { status: 404 }
      );
    }

    if (existing.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Check if reward has redemptions
    const redemptionsCount = await db.loyaltyRedemption.count({
      where: { rewardId: id },
    });

    if (redemptionsCount > 0) {
      // Instead of deleting, mark as unavailable
      await db.loyaltyReward.update({
        where: { id },
        data: { isAvailable: false },
      });
      return NextResponse.json({
        success: true,
        message: 'Reward has redemptions and was marked as unavailable instead of deleted',
      });
    }

    await db.loyaltyReward.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Reward deleted successfully' });
  } catch (error) {
    console.error('Error deleting reward:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete reward' } },
      { status: 500 }
    );
  }
}
