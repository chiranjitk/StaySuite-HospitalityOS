import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth/tenant-context';

// GET /api/guests/analytics - Get guest analytics
export async function GET(request: NextRequest) {
    const tenantId = await getTenantIdFromSession(request);
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }


  try {
    const searchParams = request.nextUrl.searchParams;
    const dateRange = parseInt(searchParams.get('dateRange') || '30', 10);

    // Calculate date threshold
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - dateRange);

    // Get total guests
    const totalGuests = await db.guest.count({
      where: { tenantId, deletedAt: null },
    });

    // Get new guests in period
    const newGuests = await db.guest.count({
      where: {
        tenantId,
        deletedAt: null,
        createdAt: { gte: startDate },
      },
    });

    // Get returning guests (guests with more than 1 booking)
    const guestsWithBookings = await db.guest.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        _count: {
          select: { bookings: true },
        },
      },
    });

    const returningGuests = guestsWithBookings.filter(g => g._count.bookings > 1).length;
    const vipGuests = await db.guest.count({
      where: { tenantId, deletedAt: null, isVip: true },
    });

    // Loyalty distribution
    const loyaltyDistribution = await db.guest.groupBy({
      by: ['loyaltyTier'],
      where: { tenantId, deletedAt: null },
      _count: { id: true },
    });

    // Source distribution
    const sourceDistribution = await db.guest.groupBy({
      by: ['source'],
      where: { tenantId, deletedAt: null },
      _count: { id: true },
    });

    // Top nationalities
    const nationalityDistribution = await db.guest.groupBy({
      by: ['nationality'],
      where: { tenantId, deletedAt: null, nationality: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    // Calculate average stay length
    const bookings = await db.booking.findMany({
      where: {
        tenantId,
        checkIn: { gte: startDate },
        status: { notIn: ['cancelled', 'no_show'] },
      },
      select: {
        checkIn: true,
        checkOut: true,
      },
    });

    const totalNights = bookings.reduce((sum, b) => {
      const nights = Math.ceil((new Date(b.checkOut).getTime() - new Date(b.checkIn).getTime()) / (1000 * 60 * 60 * 24));
      return sum + nights;
    }, 0);
    const avgStayLength = bookings.length > 0 ? totalNights / bookings.length : 0;

    // Get top guests by total spend
    const topGuests = await db.guest.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        bookings: {
          where: { status: { notIn: ['cancelled', 'no_show'] } },
          select: { totalAmount: true },
        },
        _count: {
          select: { bookings: true },
        },
      },
      take: 5,
    });

    const guestsWithSpend = topGuests.map(g => ({
      id: g.id,
      name: `${g.firstName} ${g.lastName}`,
      email: g.email,
      loyaltyTier: g.loyaltyTier,
      totalStays: g._count.bookings,
      totalSpent: g.bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0),
    })).sort((a, b) => b.totalSpent - a.totalSpent);

    return NextResponse.json({
      success: true,
      data: {
        totalGuests,
        newGuests,
        returningGuests,
        vipGuests,
        avgStayLength: Math.round(avgStayLength * 10) / 10,
        loyaltyDistribution: loyaltyDistribution.map(l => ({
          tier: l.loyaltyTier,
          count: l._count.id,
        })),
        sourceDistribution: sourceDistribution.map(s => ({
          source: s.source || 'unknown',
          count: s._count.id,
        })),
        topNationalities: nationalityDistribution.map(n => ({
          country: n.nationality || 'Unknown',
          count: n._count.id,
        })),
        // Estimated distribution based on hospitality industry averages
        ageDistribution: [
          { range: '18-25', count: Math.floor(totalGuests * 0.1), estimated: true },
          { range: '26-35', count: Math.floor(totalGuests * 0.28), estimated: true },
          { range: '36-45', count: Math.floor(totalGuests * 0.24), estimated: true },
          { range: '46-55', count: Math.floor(totalGuests * 0.21), estimated: true },
          { range: '56+', count: Math.floor(totalGuests * 0.17), estimated: true },
        ],
        recentGuests: guestsWithSpend,
      },
    });
  } catch (error) {
    console.error('Error fetching guest analytics:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch guest analytics' } },
      { status: 500 }
    );
  }
}
