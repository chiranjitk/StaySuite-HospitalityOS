import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/guests/[id]/loyalty - Get guest loyalty info
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    const user = await requirePermission(request, 'guests.view');
    if (user instanceof NextResponse) return user;


  try {
    const { id } = await params;
    const tenantId = user.tenantId;
    
    const guest = await db.guest.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        loyaltyTier: true,
        loyaltyPoints: true,
        totalStays: true,
        totalSpent: true,
        isVip: true,
        vipLevel: true,
        createdAt: true,
      },
    });
    
    if (!guest) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Guest not found' } },
        { status: 404 }
      );
    }
    
    // Get point transactions (from payments with folio relations)
    const payments = await db.payment.findMany({
      where: { 
        guestId: id,
        status: 'completed',
      },
      include: {
        folio: {
          include: {
            booking: {
              select: {
                confirmationCode: true,
                propertyId: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    
    // Get property names for the bookings
    const propertyIds = [...new Set(payments.map(p => p.folio?.booking?.propertyId).filter(Boolean))];
    const properties = await db.property.findMany({
      where: { id: { in: propertyIds as string[] } },
      select: { id: true, name: true },
    });
    const propertyMap = new Map(properties.map(p => [p.id, p.name]));
    
    // Calculate points earned from payments
    const pointsHistory = payments.map(payment => ({
      id: payment.id,
      date: payment.createdAt,
      type: 'earned',
      points: Math.floor(payment.amount * 10), // 10 points per dollar
      description: `Stay at ${propertyMap.get(payment.folio?.booking?.propertyId || '') || 'Property'}`,
      reference: payment.folio?.booking?.confirmationCode,
    }));
    
    // Tier benefits
    const tierBenefits = {
      bronze: { multiplier: 1, benefits: ['Basic WiFi', 'Early check-in request'] },
      silver: { multiplier: 1.25, benefits: ['Priority WiFi', 'Room upgrade when available', 'Late checkout'] },
      gold: { multiplier: 1.5, benefits: ['Premium WiFi', 'Guaranteed room upgrade', 'Late checkout', 'Welcome amenity'] },
      platinum: { multiplier: 2, benefits: ['VIP WiFi', 'Suite upgrades', '24/7 concierge', 'Free breakfast', 'Airport transfer'] },
    };
    
    const currentTier = guest.loyaltyTier as keyof typeof tierBenefits;
    const benefits = tierBenefits[currentTier] || tierBenefits.bronze;
    
    // Tier thresholds
    const tierThresholds = {
      bronze: 0,
      silver: 1000,
      gold: 5000,
      platinum: 15000,
    };
    
    // Calculate next tier progress
    let nextTier: string | null = null;
    let pointsToNextTier = 0;
    const currentPoints = guest.loyaltyPoints;
    
    if (currentPoints < tierThresholds.silver) {
      nextTier = 'silver';
      pointsToNextTier = tierThresholds.silver - currentPoints;
    } else if (currentPoints < tierThresholds.gold) {
      nextTier = 'gold';
      pointsToNextTier = tierThresholds.gold - currentPoints;
    } else if (currentPoints < tierThresholds.platinum) {
      nextTier = 'platinum';
      pointsToNextTier = tierThresholds.platinum - currentPoints;
    }
    
    return NextResponse.json({
      success: true,
      data: {
        guest,
        loyalty: {
          tier: guest.loyaltyTier,
          points: guest.loyaltyPoints,
          totalStays: guest.totalStays,
          totalSpent: guest.totalSpent,
          isVip: guest.isVip,
          vipLevel: guest.vipLevel,
          benefits,
          nextTier,
          pointsToNextTier,
          tierThresholds,
        },
        pointsHistory,
      },
    });
  } catch (error) {
    console.error('Error fetching loyalty:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch loyalty data' } },
      { status: 500 }
    );
  }
}

// PUT /api/guests/[id]/loyalty - Update loyalty points
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    const user = await requirePermission(request, 'guests.edit');
    if (user instanceof NextResponse) return user;


  try {
    const { id } = await params;
    const tenantId = user.tenantId;
    const body = await request.json();
    const { points, operation = 'add', tier } = body;
    
    const guest = await db.guest.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    
    if (!guest) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Guest not found' } },
        { status: 404 }
      );
    }
    
    const updateData: Record<string, unknown> = {};
    
    if (points !== undefined) {
      const currentPoints = guest.loyaltyPoints;
      let newPoints: number;
      
      if (operation === 'add') {
        newPoints = currentPoints + points;
      } else if (operation === 'subtract') {
        newPoints = Math.max(0, currentPoints - points);
      } else {
        newPoints = points; // set
      }
      
      updateData.loyaltyPoints = newPoints;
      
      // Auto-update tier based on points
      if (newPoints >= 15000) {
        updateData.loyaltyTier = 'platinum';
      } else if (newPoints >= 5000) {
        updateData.loyaltyTier = 'gold';
      } else if (newPoints >= 1000) {
        updateData.loyaltyTier = 'silver';
      } else {
        updateData.loyaltyTier = 'bronze';
      }
    }
    
    if (tier) {
      updateData.loyaltyTier = tier;
    }
    
    const updatedGuest = await db.guest.update({
      where: { id },
      data: updateData,
    });
    
    return NextResponse.json({ 
      success: true, 
      data: {
        loyaltyPoints: updatedGuest.loyaltyPoints,
        loyaltyTier: updatedGuest.loyaltyTier,
      }
    });
  } catch (error) {
    console.error('Error updating loyalty:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update loyalty' } },
      { status: 500 }
    );
  }
}
