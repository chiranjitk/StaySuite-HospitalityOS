import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'dashboard.view');
  if (user instanceof NextResponse) return user;

  try {
    const tenantId = user.tenantId;
    const properties = await db.property.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true },
    });
    const propertyIds = properties.map(p => p.id);

    if (propertyIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          overallScore: 0,
          totalReviews: 0,
          trend: '—',
          categories: {
            cleanliness: { score: 0, trend: '—' },
            service: { score: 0, trend: '—' },
            food: { score: 0, trend: '—' },
            amenities: { score: 0, trend: '—' },
            value: { score: 0, trend: '—' },
          },
          recentReviews: [],
          hasData: false,
        },
      });
    }

    // Get real review data from DB
    const reviews = await db.guestReview.findMany({
      where: {
        propertyId: { in: propertyIds },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        guest: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    if (reviews.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          overallScore: 0,
          totalReviews: 0,
          trend: '—',
          categories: {
            cleanliness: { score: 0, trend: '—' },
            service: { score: 0, trend: '—' },
            food: { score: 0, trend: '—' },
            amenities: { score: 0, trend: '—' },
            value: { score: 0, trend: '—' },
          },
          recentReviews: [],
          hasData: false,
        },
      });
    }

    // Calculate overall score from actual reviews
    const overallScore = Math.round(
      (reviews.reduce((sum, r) => sum + r.overallRating, 0) / reviews.length) * 10
    ) / 10;

    // Get previous period reviews for trend comparison
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentReviewsList = reviews.filter(r => new Date(r.createdAt) >= thirtyDaysAgo);
    const olderReviews = reviews.filter(r => new Date(r.createdAt) < thirtyDaysAgo);

    let trend: string = '—';
    if (olderReviews.length > 0 && recentReviewsList.length > 0) {
      const recentAvg = recentReviewsList.reduce((sum, r) => sum + r.overallRating, 0) / recentReviewsList.length;
      const olderAvg = olderReviews.reduce((sum, r) => sum + r.overallRating, 0) / olderReviews.length;
      const diff = Math.round((recentAvg - olderAvg) * 10) / 10;
      trend = diff >= 0 ? `+${diff}` : `${diff}`;
    } else {
      trend = '—';
    }

    // Calculate category averages from real review ratings
    // GuestReview has: overallRating, cleanlinessRating, serviceRating, locationRating, valueRating
    // No foodRating or amenitiesRating — fall back to overallRating for those
    const categories = {
      cleanliness: {
        score: reviews.length > 0 ? Math.round(reviews.reduce((s, r) => s + (r.cleanlinessRating || r.overallRating), 0) / reviews.length * 10) / 10 : 0,
        trend: '—' as string
      },
      service: {
        score: reviews.length > 0 ? Math.round(reviews.reduce((s, r) => s + (r.serviceRating || r.overallRating), 0) / reviews.length * 10) / 10 : 0,
        trend: '—' as string
      },
      food: {
        score: reviews.length > 0 ? Math.round(reviews.reduce((s, r) => s + r.overallRating, 0) / reviews.length * 10) / 10 : 0,
        trend: '—' as string
      },
      amenities: {
        score: reviews.length > 0 ? Math.round(reviews.reduce((s, r) => s + (r.locationRating || r.overallRating), 0) / reviews.length * 10) / 10 : 0,
        trend: '—' as string
      },
      value: {
        score: reviews.length > 0 ? Math.round(reviews.reduce((s, r) => s + (r.valueRating || r.overallRating), 0) / reviews.length * 10) / 10 : 0,
        trend: '—' as string
      },
    };

    // Recent reviews for display
    const recentReviewData = reviews.slice(0, 5).map(r => ({
      guest: r.guest ? `${r.guest.firstName} ${r.guest.lastName}` : 'Anonymous',
      rating: r.overallRating,
      date: r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : '',
      excerpt: r.comment || '',
    }));

    return NextResponse.json({
      success: true,
      data: {
        overallScore,
        totalReviews: reviews.length,
        trend,
        categories,
        recentReviews: recentReviewData,
        hasData: true,
      },
    });
  } catch (error) {
    console.error('[Guest Satisfaction API] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch guest satisfaction data' } },
      { status: 500 }
    );
  }
}
