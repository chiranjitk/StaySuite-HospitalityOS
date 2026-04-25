import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

const MAX_LIMIT = 100;

// GET - Aggregate reviews from multiple sources
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
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const source = searchParams.get('source');
    const sentiment = searchParams.get('sentiment');
    const rating = searchParams.get('rating');
    const responded = searchParams.get('responded');
    const search = searchParams.get('search');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), MAX_LIMIT);
    const skip = (page - 1) * limit;

    // Build where clause with tenant scoping
    const where: Record<string, unknown> = {};

    // Property filter - must belong to tenant
    if (propertyId) {
      // Verify property belongs to tenant
      const property = await db.property.findFirst({
        where: { id: propertyId, tenantId },
      });
      if (!property) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } },
          { status: 404 }
        );
      }
      where.propertyId = propertyId;
    } else {
      // Get all properties for tenant and filter by them
      const properties = await db.property.findMany({
        where: { tenantId },
        select: { id: true },
      });
      const propertyIds = properties.map(p => p.id);
      where.propertyId = { in: propertyIds };
    }

    if (source && source !== 'all') {
      where.source = source;
    }

    if (sentiment && sentiment !== 'all') {
      where.sentimentLabel = sentiment;
    }

    if (rating && rating !== 'all') {
      where.overallRating = parseInt(rating);
    }

    if (responded === 'true') {
      where.responseText = { not: null };
    } else if (responded === 'false') {
      where.responseText = null;
    }

    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);
      where.createdAt = dateFilter;
    }

    // Search filter - search in comment, title, and guest name
    if (search) {
      where.OR = [
        { comment: { contains: search } },
        { title: { contains: search } },
        { guest: { firstName: { contains: search } } },
        { guest: { lastName: { contains: search } } },
      ];
    }

    // Get reviews with guest info
    const reviews = await db.guestReview.findMany({
      where,
      include: {
        guest: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    // Get total count
    const total = await db.guestReview.count({ where });

    // Get property IDs for stats calculation
    let statsPropertyIds: string[] = [];
    if (propertyId) {
      statsPropertyIds = [propertyId];
    } else {
      const properties = await db.property.findMany({
        where: { tenantId },
        select: { id: true },
      });
      statsPropertyIds = properties.map(p => p.id);
    }

    // Calculate statistics for tenant's properties
    const allReviews = await db.guestReview.findMany({
      where: { propertyId: { in: statsPropertyIds } },
      select: {
        overallRating: true,
        cleanlinessRating: true,
        serviceRating: true,
        locationRating: true,
        valueRating: true,
        sentimentScore: true,
        sentimentLabel: true,
        source: true,
        responseText: true,
      },
    });

    const stats = {
      total: allReviews.length,
      averageRating: allReviews.length > 0
        ? allReviews.reduce((sum, r) => sum + r.overallRating, 0) / allReviews.length
        : 0,
      ratingDistribution: {
        5: allReviews.filter(r => r.overallRating === 5).length,
        4: allReviews.filter(r => r.overallRating === 4).length,
        3: allReviews.filter(r => r.overallRating === 3).length,
        2: allReviews.filter(r => r.overallRating === 2).length,
        1: allReviews.filter(r => r.overallRating === 1).length,
      },
      categoryAverages: {
        cleanliness: allReviews.filter(r => r.cleanlinessRating).length > 0
          ? allReviews.filter(r => r.cleanlinessRating).reduce((sum, r) => sum + (r.cleanlinessRating || 0), 0) / allReviews.filter(r => r.cleanlinessRating).length
          : 0,
        service: allReviews.filter(r => r.serviceRating).length > 0
          ? allReviews.filter(r => r.serviceRating).reduce((sum, r) => sum + (r.serviceRating || 0), 0) / allReviews.filter(r => r.serviceRating).length
          : 0,
        location: allReviews.filter(r => r.locationRating).length > 0
          ? allReviews.filter(r => r.locationRating).reduce((sum, r) => sum + (r.locationRating || 0), 0) / allReviews.filter(r => r.locationRating).length
          : 0,
        value: allReviews.filter(r => r.valueRating).length > 0
          ? allReviews.filter(r => r.valueRating).reduce((sum, r) => sum + (r.valueRating || 0), 0) / allReviews.filter(r => r.valueRating).length
          : 0,
      },
      sentimentDistribution: {
        positive: allReviews.filter(r => r.sentimentLabel === 'positive').length,
        neutral: allReviews.filter(r => r.sentimentLabel === 'neutral').length,
        negative: allReviews.filter(r => r.sentimentLabel === 'negative').length,
      },
      sourceDistribution: {
        internal: allReviews.filter(r => r.source === 'internal').length,
        google: allReviews.filter(r => r.source === 'google').length,
        booking_com: allReviews.filter(r => r.source === 'booking_com').length,
        tripadvisor: allReviews.filter(r => r.source === 'tripadvisor').length,
        expedia: allReviews.filter(r => r.source === 'expedia').length,
      },
      responseRate: allReviews.length > 0
        ? (allReviews.filter(r => r.responseText).length / allReviews.length) * 100
        : 0,
    };

    return NextResponse.json({
      success: true,
      reviews,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      stats,
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch reviews' } },
      { status: 500 }
    );
  }
}

// POST - Create a new review
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

    // Validate required fields
    if (!guestId || !propertyId || !overallRating) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: guestId, propertyId, overallRating' } },
        { status: 400 }
      );
    }

    // Validate ratings
    if (overallRating < 1 || overallRating > 5) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Overall rating must be between 1 and 5' } },
        { status: 400 }
      );
    }

    // Verify property belongs to tenant
    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId },
    });

    if (!property) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } },
        { status: 404 }
      );
    }

    // Verify guest belongs to tenant
    const guest = await db.guest.findFirst({
      where: { id: guestId, tenantId, deletedAt: null },
    });

    if (!guest) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Guest not found' } },
        { status: 404 }
      );
    }

    // Validate source
    const validSources = ['internal', 'google', 'booking_com', 'tripadvisor', 'expedia'];
    if (!validSources.includes(source)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid source' } },
        { status: 400 }
      );
    }

    // Create review
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
      },
    });

    return NextResponse.json({ success: true, data: review }, { status: 201 });
  } catch (error) {
    console.error('Error creating review:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create review' } },
      { status: 500 }
    );
  }
}

// PUT - Respond to a review
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
    if (!hasPermission(user, 'reviews.respond') && !hasPermission(user, 'reputation.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const { reviewId, responseText, respondedBy } = body;

    if (!reviewId || !responseText) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: reviewId, responseText' } },
        { status: 400 }
      );
    }

    // Get review with property to verify tenant
    const existingReview = await db.guestReview.findUnique({
      where: { id: reviewId },
      include: {
        property: {
          select: { tenantId: true },
        },
      },
    });

    if (!existingReview) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Review not found' } },
        { status: 404 }
      );
    }

    // Verify review belongs to tenant's property
    if (existingReview.property.tenantId !== tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    const review = await db.guestReview.update({
      where: { id: reviewId },
      data: {
        responseText,
        respondedBy: respondedBy || user.id,
        respondedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, data: review });
  } catch (error) {
    console.error('Error responding to review:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to respond to review' } },
      { status: 500 }
    );
  }
}
