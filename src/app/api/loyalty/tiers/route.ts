import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// Default tiers to seed if none exist
const DEFAULT_TIERS = [
  {
    name: 'bronze',
    displayName: 'Bronze Member',
    minPoints: 0,
    maxPoints: 999,
    pointsMultiplier: 1.0,
    benefits: ['Basic WiFi', 'Early check-in request', 'Member-only rates'],
    color: '#cd7f32',
    sortOrder: 1,
  },
  {
    name: 'silver',
    displayName: 'Silver Elite',
    minPoints: 1000,
    maxPoints: 4999,
    pointsMultiplier: 1.25,
    benefits: ['Priority WiFi', 'Room upgrade when available', 'Late checkout', 'Welcome drink'],
    color: '#c0c0c0',
    sortOrder: 2,
  },
  {
    name: 'gold',
    displayName: 'Gold Elite',
    minPoints: 5000,
    maxPoints: 14999,
    pointsMultiplier: 1.5,
    benefits: ['Premium WiFi', 'Guaranteed room upgrade', 'Late checkout', 'Welcome amenity', 'Free breakfast', 'Priority service'],
    color: '#ffd700',
    sortOrder: 3,
  },
  {
    name: 'platinum',
    displayName: 'Platinum Elite',
    minPoints: 15000,
    maxPoints: null,
    pointsMultiplier: 2.0,
    benefits: ['VIP WiFi', 'Suite upgrades', '24/7 concierge', 'Free breakfast', 'Airport transfer', 'Exclusive events', 'Personalized service'],
    color: '#e5e4e2',
    sortOrder: 4,
  },
];

// GET /api/loyalty/tiers - List tier configurations
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
    const includeStats = searchParams.get('includeStats') === 'true';

    let tiers = await db.loyaltyTier.findMany({
      where: { tenantId },
      orderBy: { sortOrder: 'asc' },
    });

    // Seed default tiers if none exist
    if (tiers.length === 0) {
      await db.loyaltyTier.createMany({
        data: DEFAULT_TIERS.map(tier => ({
          ...tier,
          tenantId,
          benefits: JSON.stringify(tier.benefits),
        })),
      });

      tiers = await db.loyaltyTier.findMany({
        where: { tenantId },
        orderBy: { sortOrder: 'asc' },
      });
    }

    // Parse benefits JSON
    const parsedTiers = tiers.map(tier => ({
      ...tier,
      benefits: typeof tier.benefits === 'string' ? JSON.parse(tier.benefits) : tier.benefits,
    }));

    let tierStats: Record<string, { count: number; totalPoints: number }> = {};

    // Get guest distribution by tier if stats requested
    if (includeStats) {
      const guestStats = await db.guest.groupBy({
        by: ['loyaltyTier'],
        where: { tenantId, deletedAt: null },
        _count: { id: true },
        _sum: { loyaltyPoints: true },
      });

      tierStats = guestStats.reduce((acc, stat) => {
        acc[stat.loyaltyTier] = {
          count: stat._count.id,
          totalPoints: stat._sum.loyaltyPoints || 0,
        };
        return acc;
      }, {} as Record<string, { count: number; totalPoints: number }>);
    }

    return NextResponse.json({
      success: true,
      data: parsedTiers,
      stats: tierStats,
      summary: {
        totalTiers: parsedTiers.length,
        activeTiers: parsedTiers.filter(t => t.isActive).length,
      },
    });
  } catch (error) {
    console.error('Error fetching tiers:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch tiers' } },
      { status: 500 }
    );
  }
}

// PUT /api/loyalty/tiers - Update tier thresholds and benefits
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
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Tier ID is required' } },
        { status: 400 }
      );
    }

    const existing = await db.loyaltyTier.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Tier not found' } },
        { status: 404 }
      );
    }

    // Verify tier belongs to user's tenant
    if (existing.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Validate numeric fields
    if (updateData.minPoints !== undefined && updateData.minPoints < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'minPoints cannot be negative' } },
        { status: 400 }
      );
    }
    if (updateData.maxPoints !== undefined && updateData.maxPoints !== null && updateData.maxPoints < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'maxPoints cannot be negative' } },
        { status: 400 }
      );
    }
    if (updateData.pointsMultiplier !== undefined && updateData.pointsMultiplier < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'pointsMultiplier cannot be negative' } },
        { status: 400 }
      );
    }

    // Prepare update data
    const data: Record<string, unknown> = {};
    const allowedFields = [
      'displayName', 'minPoints', 'maxPoints', 'pointsMultiplier',
      'benefits', 'color', 'icon', 'sortOrder', 'isActive',
    ];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        if (field === 'benefits') {
          // Convert benefits array to JSON string
          data[field] = typeof updateData[field] === 'string'
            ? updateData[field]
            : JSON.stringify(updateData[field]);
        } else {
          data[field] = updateData[field];
        }
      }
    }

    const updated = await db.loyaltyTier.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        benefits: typeof updated.benefits === 'string' ? JSON.parse(updated.benefits) : updated.benefits,
      },
    });
  } catch (error) {
    console.error('Error updating tier:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update tier' } },
      { status: 500 }
    );
  }
}

// POST /api/loyalty/tiers - Calculate tier for guest based on points
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
    const { guestId, points } = body;

    // If guestId is provided, get guest's current points
    let currentPoints = points;
     
    let guest: any = null;

    if (guestId) {
      guest = await db.guest.findUnique({
        where: { id: guestId, deletedAt: null },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          loyaltyPoints: true,
          loyaltyTier: true,
          totalStays: true,
          totalSpent: true,
          tenantId: true,
        },
      });

      if (!guest) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Guest not found' } },
          { status: 404 }
        );
      }

      // Verify guest belongs to user's tenant
      if (guest.tenantId !== tenantId) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
          { status: 403 }
        );
      }

      currentPoints = guest.loyaltyPoints;
    }

    if (currentPoints === undefined) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Either guestId or points is required' } },
        { status: 400 }
      );
    }

    // Get all tiers
    const tiers = await db.loyaltyTier.findMany({
      where: { tenantId, isActive: true },
      orderBy: { minPoints: 'desc' },
    });

    // Find the appropriate tier
     
    let calculatedTier: any = null;
    for (const tier of tiers) {
      if (currentPoints >= tier.minPoints) {
        if (tier.maxPoints === null || currentPoints <= tier.maxPoints) {
          calculatedTier = tier;
          break;
        }
      }
    }

    // Fallback to lowest tier if none matched
    if (!calculatedTier && tiers.length > 0) {
      const sortedByMinPoints = [...tiers].sort((a, b) => a.minPoints - b.minPoints);
      calculatedTier = sortedByMinPoints[0];
    }

    // If guest provided and tier changed, update guest
    if (guest && calculatedTier && guest.loyaltyTier !== calculatedTier.name) {
      await db.guest.update({
        where: { id: guestId },
        data: { loyaltyTier: calculatedTier.name },
      });
    }

    // Calculate progress to next tier
     
    let nextTier: any = null;
    let pointsToNextTier = 0;
    let progressPercent = 100;

    const sortedTiers = [...tiers].sort((a, b) => a.minPoints - b.minPoints);
    const currentTierIndex = sortedTiers.findIndex(t => t.name === calculatedTier?.name);

    if (currentTierIndex >= 0 && currentTierIndex < sortedTiers.length - 1) {
      nextTier = sortedTiers[currentTierIndex + 1];
      pointsToNextTier = nextTier.minPoints - currentPoints;
      progressPercent = ((currentPoints - (calculatedTier?.minPoints || 0)) /
        ((nextTier.minPoints - (calculatedTier?.minPoints || 0)) || 1)) * 100;
    }

    return NextResponse.json({
      success: true,
      data: {
        guest: guest ? {
          ...(guest as Record<string, unknown>),
          loyaltyTier: calculatedTier?.name || guest.loyaltyTier,
        } : null,
        calculatedTier: calculatedTier ? {
          ...(calculatedTier as Record<string, unknown>),
          benefits: typeof calculatedTier.benefits === 'string'
            ? JSON.parse(calculatedTier.benefits)
            : calculatedTier.benefits,
        } : null,
        nextTier: nextTier ? {
          ...(nextTier as Record<string, unknown>),
          benefits: typeof nextTier.benefits === 'string'
            ? JSON.parse(nextTier.benefits)
            : nextTier.benefits,
        } : null,
        currentPoints,
        pointsToNextTier,
        progressPercent: Math.min(100, Math.max(0, progressPercent)),
        tierChanged: guest && calculatedTier && guest.loyaltyTier !== calculatedTier.name,
      },
    });
  } catch (error) {
    console.error('Error calculating tier:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to calculate tier' } },
      { status: 500 }
    );
  }
}

// DELETE /api/loyalty/tiers - Remove a tier (only if no guests have it)
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
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Tier ID is required' } },
        { status: 400 }
      );
    }

    const tier = await db.loyaltyTier.findUnique({ where: { id } });
    if (!tier) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Tier not found' } },
        { status: 404 }
      );
    }

    // Verify tier belongs to user's tenant
    if (tier.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Check if any guests have this tier
    const guestsWithTier = await db.guest.count({
      where: { loyaltyTier: tier.name, tenantId: user.tenantId, deletedAt: null },
    });

    if (guestsWithTier > 0) {
      // Deactivate instead of delete
      await db.loyaltyTier.update({
        where: { id },
        data: { isActive: false },
      });

      return NextResponse.json({
        success: true,
        message: 'Tier has associated guests and was deactivated instead of deleted',
      });
    }

    await db.loyaltyTier.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Tier deleted successfully' });
  } catch (error) {
    console.error('Error deleting tier:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete tier' } },
      { status: 500 }
    );
  }
}
