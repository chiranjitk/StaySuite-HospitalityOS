import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'dashboard.view');
  if (user instanceof NextResponse) return user;

  try {
    const tenantId = user.tenantId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Fetch properties
    const properties = await db.property.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, totalRooms: true },
    });
    const propertyIds = properties.map(p => p.id);
    const totalRooms = properties.reduce((sum, p) => sum + p.totalRooms, 0);

    // Today's check-ins
    const checkInsToday = await db.booking.count({
      where: {
        propertyId: { in: propertyIds },
        checkIn: { gte: today, lt: tomorrow },
        status: { in: ['confirmed', 'checked_in'] },
        deletedAt: null,
      },
    });

    // Today's check-outs
    const checkOutsToday = await db.booking.count({
      where: {
        propertyId: { in: propertyIds },
        checkOut: { gte: today, lt: tomorrow },
        status: { in: ['checked_in', 'checked_out'] },
        deletedAt: null,
      },
    });

    // Available rooms
    const occupiedRoomIds = await db.booking.findMany({
      where: {
        propertyId: { in: propertyIds },
        status: { in: ['checked_in', 'confirmed'] },
        checkIn: { lt: tomorrow },
        checkOut: { gt: today },
        deletedAt: null,
        roomId: { not: null },
      },
      select: { roomId: true },
    });
    const occupiedSet = new Set(occupiedRoomIds.map(b => b.roomId).filter(Boolean));

    const outOfOrderCount = await db.room.count({
      where: {
        propertyId: { in: propertyIds },
        status: { in: ['outOfOrder', 'maintenance'] },
        deletedAt: null,
      },
    });

    const availableRooms = Math.max(0, totalRooms - occupiedSet.size - outOfOrderCount);

    // Revenue today from payments
    const todayFolios = await db.folio.findMany({
      where: { propertyId: { in: propertyIds } },
      select: { id: true },
    });
    const folioIds = todayFolios.map(f => f.id);

    const todayPayments = await db.payment.aggregate({
      where: {
        folioId: { in: folioIds },
        status: 'completed',
        createdAt: { gte: today, lt: tomorrow },
      },
      _sum: { amount: true },
    });
    const revenueToday = todayPayments._sum.amount || 0;

    // Yesterday revenue for change calculation
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayPayments = await db.payment.aggregate({
      where: {
        folioId: { in: folioIds },
        status: 'completed',
        createdAt: { gte: yesterday, lt: today },
      },
      _sum: { amount: true },
    });
    const yesterdayRevenue = yesterdayPayments._sum.amount || 0;
    const revenueChange = yesterdayRevenue > 0
      ? Math.round(((revenueToday - yesterdayRevenue) / yesterdayRevenue) * 100)
      : (revenueToday > 0 ? 100 : 0);

    // Average rating from guest reviews
    const reviewStats = await db.guestReview.aggregate({
      where: { propertyId: { in: propertyIds } },
      _avg: { overallRating: true },
      _count: true,
    });
    const avgRating = reviewStats._avg.overallRating
      ? Math.round(reviewStats._avg.overallRating * 10) / 10
      : null; // No data — return null instead of fake value
    const ratingChange = null; // No fake trend

    return NextResponse.json({
      success: true,
      data: {
        checkInsToday,
        checkOutsToday,
        availableRooms,
        totalRooms,
        revenueToday,
        revenueChange,
        avgRating,
        ratingChange,
      },
    });
  } catch (error) {
    console.error('[Quick Stats API] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch quick stats' } },
      { status: 500 }
    );
  }
}
