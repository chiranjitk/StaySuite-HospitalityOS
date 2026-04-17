import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { requirePermission } from '@/lib/auth/tenant-context';// GET /api/crm/reviews - List all reviews
export async function GET(request: NextRequest) {    const user = await requirePermission(request, 'crm.view');
    if (user instanceof NextResponse) return user;

      try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = user.tenantId;
    const propertyId = searchParams.get('propertyId');
    const source = searchParams.get('source');
    const minRating = searchParams.get('minRating');
    const maxRating = searchParams.get('maxRating');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause - need to filter through guest's tenant
    const where: Prisma.GuestReviewWhereInput = {
      guest: { tenantId },
      ...(propertyId && { propertyId }),
      ...(source && { source }),
      ...(minRating && { overallRating: { gte: parseInt(minRating) } }),
      ...(maxRating && { overallRating: { lte: parseInt(maxRating) } }),
    };

    const [reviews, total] = await Promise.all([
      db.guestReview.findMany({
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
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.guestReview.count({ where }),
    ]);

    // Calculate stats
    const allReviews = await db.guestReview.findMany({
      where: { guest: { tenantId } },
      select: {
        overallRating: true,
        source: true,
        sentimentScore: true,
        responseText: true,
        createdAt: true,
      },
    });

    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    allReviews.forEach(r => {
      ratingDistribution[r.overallRating] = (ratingDistribution[r.overallRating] || 0) + 1;
    });

    const avgRating = allReviews.length > 0
      ? allReviews.reduce((acc, r) => acc + r.overallRating, 0) / allReviews.length
      : 0;

    const respondedCount = allReviews.filter(r => r.responseText).length;

    const stats = {
      totalReviews: allReviews.length,
      averageRating: Math.round(avgRating * 10) / 10,
      ratingDistribution,
      responseRate: allReviews.length > 0 
        ? Math.round((respondedCount / allReviews.length) * 100) 
        : 0,
      sentimentBreakdown: {
        positive: allReviews.filter(r => (r.sentimentScore || 0) > 0.6).length,
        neutral: allReviews.filter(r => (r.sentimentScore || 0) >= 0.4 && (r.sentimentScore || 0) <= 0.6).length,
        negative: allReviews.filter(r => (r.sentimentScore || 0) < 0.4).length,
      },
      bySource: {
        internal: allReviews.filter(r => r.source === 'internal').length,
        google: allReviews.filter(r => r.source === 'google').length,
        booking_com: allReviews.filter(r => r.source === 'booking_com').length,
        tripadvisor: allReviews.filter(r => r.source === 'tripadvisor').length,
      },
    };

    return NextResponse.json({
      success: true,
      data: {
        reviews,
        total,
        stats,
      },
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch reviews' } },
      { status: 500 }
    );
  }
}

// POST /api/crm/reviews - Create a new review
export async function POST(request: NextRequest) {    const user = await requirePermission(request, 'crm.manage');
    if (user instanceof NextResponse) return user;

      try {
    const body = await request.json();
    const {
      guestId,
      propertyId,
      overallRating,
      cleanlinessRating,
      serviceRating,
      locationRating,
      valueRating,
      title,
      comment,
      source = 'internal',
    } = body;

    if (!guestId || !propertyId || !overallRating) {
      return NextResponse.json(
        { success: false, error: { message: 'Guest ID, property ID, and rating are required' } },
        { status: 400 }
      );
    }

    // Verify guest belongs to current tenant
    const guestExists = await db.guest.findFirst({
      where: { id: guestId, tenantId: user.tenantId },
    });
    if (!guestExists) {
      return NextResponse.json(
        { success: false, error: { message: 'Guest not found or access denied' } },
        { status: 403 }
      );
    }

    // Calculate sentiment score (simple implementation)
    const sentimentScore = overallRating >= 4 ? 0.8 : overallRating >= 3 ? 0.5 : 0.2;
    const sentimentLabel = sentimentScore > 0.6 ? 'positive' : sentimentScore >= 0.4 ? 'neutral' : 'negative';

    const review = await db.guestReview.create({
      data: {
        guestId,
        propertyId,
        overallRating,
        cleanlinessRating,
        serviceRating,
        locationRating,
        valueRating,
        title,
        comment,
        source,
        sentimentScore,
        sentimentLabel,
      },
      include: {
        guest: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: review,
    });
  } catch (error) {
    console.error('Error creating review:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to create review' } },
      { status: 500 }
    );
  }
}

// PUT /api/crm/reviews - Update review (add response)
export async function PUT(request: NextRequest) {    const user = await requirePermission(request, 'crm.manage');
    if (user instanceof NextResponse) return user;

      try {
    const body = await request.json();
    const { id, responseText, respondedBy } = body;

    if (!id || !responseText) {
      return NextResponse.json(
        { success: false, error: { message: 'Review ID and response text are required' } },
        { status: 400 }
      );
    }

    // Verify review belongs to user's tenant
    const existingReview = await db.guestReview.findUnique({
      where: { id },
      include: { guest: { select: { tenantId: true } } },
    });
    if (!existingReview || existingReview.guest?.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { message: 'Review not found or access denied' } },
        { status: 404 }
      );
    }

    const review = await db.guestReview.update({
      where: { id },
      data: {
        responseText,
        respondedBy,
        respondedAt: new Date(),
      },
      include: {
        guest: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: review,
    });
  } catch (error) {
    console.error('Error updating review:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to update review' } },
      { status: 500 }
    );
  }
}

// DELETE /api/crm/reviews - Soft delete a review
export async function DELETE(request: NextRequest) {
  const user = await requirePermission(request, 'crm.manage');
    if (user instanceof NextResponse) return user;

      try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { message: 'Review ID is required' } },
        { status: 400 }
      );
    }

    // Verify the review belongs to a guest in the user's tenant
    const review = await db.guestReview.findUnique({
      where: { id },
      include: {
        guest: {
          select: { tenantId: true },
        },
      },
    });

    if (!review) {
      return NextResponse.json(
        { success: false, error: { message: 'Review not found' } },
        { status: 404 }
      );
    }

    if (review.guest.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { message: 'Cannot delete review from another tenant' } },
        { status: 403 }
      );
    }

    await db.guestReview.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Review deleted successfully' },
    });
  } catch (error) {
    console.error('Error deleting review:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to delete review' } },
      { status: 500 }
    );
  }
}
