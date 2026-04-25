import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { analyzeReviewSentiment, batchAnalyzeReviews, calculateAggregateSentiment, type SentimentResult } from '@/lib/reputation/sentiment-analysis';

// GET /api/reputation/sentiment - Get sentiment analysis for reviews
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
    const reviewId = searchParams.get('reviewId');
    const aggregate = searchParams.get('aggregate');

    // If specific review ID, get sentiment for that review
    if (reviewId) {
      const review = await db.externalReview.findUnique({
        where: { id: reviewId },
      });

      if (!review) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Review not found' } },
          { status: 404 }
        );
      }

      // Get or analyze sentiment
      if (review.sentimentScore !== null) {
        return NextResponse.json({
          success: true,
          data: {
            reviewId,
            sentiment: {
              overall: review.sentimentLabel,
              score: review.sentimentScore,
              aspects: review.sentimentAspects || [],
              keywords: review.sentimentKeywords || [],
            },
          },
        });
      }

      // Analyze sentiment
      const sentiment = await analyzeReviewSentiment(review.content, review.rating);

      // Save to database
      await db.externalReview.update({
        where: { id: reviewId },
        data: {
          sentimentScore: sentiment.score,
          sentimentLabel: sentiment.overall,
          sentimentAspects: JSON.stringify(sentiment.aspects),
          sentimentKeywords: JSON.stringify(sentiment.keywords),
        },
      });

      return NextResponse.json({
        success: true,
        data: { reviewId, sentiment },
      });
    }

    // Build query with tenant scoping
    const where: Record<string, unknown> = { tenantId };
    if (propertyId) where.propertyId = propertyId;

    // Get reviews that need sentiment analysis
    const reviews = await db.externalReview.findMany({
      where,
      select: {
        id: true,
        content: true,
        rating: true,
        sentimentScore: true,
        sentimentLabel: true,
        sentimentAspects: true,
        sentimentKeywords: true,
      },
      orderBy: { reviewDate: 'desc' },
      take: 100,
    });

    // If aggregate flag, return aggregate statistics
    if (aggregate === 'true') {
      const sentiments = reviews
        .filter((r) => r.sentimentScore !== null)
        .map((r) => ({
          overall: (r.sentimentLabel || 'neutral') as SentimentResult['overall'],
          score: r.sentimentScore || 0,
          aspects: (r.sentimentAspects ? (JSON.parse(r.sentimentAspects) as Array<{ aspect: string; sentiment: string; score: number; mentions: string[] }>) : []) || [],
          keywords: (r.sentimentKeywords ? (JSON.parse(r.sentimentKeywords) as string[]) : []) || [],
          actionItems: [] as string[],
        }));

      const aggregateStats = calculateAggregateSentiment(sentiments as SentimentResult[]);

      return NextResponse.json({
        success: true,
        data: {
          totalReviews: reviews.length,
          analyzedReviews: sentiments.length,
          ...aggregateStats,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        hasSentiment: r.sentimentScore !== null,
        sentiment: r.sentimentScore !== null ? {
          overall: r.sentimentLabel,
          score: r.sentimentScore,
          aspects: r.sentimentAspects,
          keywords: r.sentimentKeywords,
        } : null,
      })),
    });
  } catch (error) {
    console.error('Error fetching sentiment analysis:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch sentiment analysis' } },
      { status: 500 }
    );
  }
}

// POST /api/reputation/sentiment - Analyze sentiment for reviews
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

    // Permission check
    if (!hasPermission(user, 'reputation.manage') && !hasPermission(user, 'reviews.respond')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const { propertyId, reviewIds, text } = body;

    // If text provided, analyze directly
    if (text) {
      const sentiment = await analyzeReviewSentiment(text, body.rating);
      return NextResponse.json({
        success: true,
        data: sentiment,
      });
    }

    // Build query for reviews to analyze
    const where: Record<string, unknown> = { tenantId };
    if (propertyId) where.propertyId = propertyId;
    if (reviewIds && Array.isArray(reviewIds)) {
      where.id = { in: reviewIds };
    } else {
      // Only get reviews without sentiment
      where.sentimentScore = null;
    }

    const reviews = await db.externalReview.findMany({
      where,
      select: { id: true, content: true, rating: true },
      take: 50,
    });

    if (reviews.length === 0) {
      return NextResponse.json({
        success: true,
        data: { analyzed: 0, message: 'No reviews to analyze' },
      });
    }

    // Batch analyze
    const results = await batchAnalyzeReviews(
      reviews.map((r) => ({ id: r.id, text: r.content, rating: r.rating }))
    );

    // Update database
    for (const result of results) {
      await db.externalReview.update({
        where: { id: result.id },
        data: {
          sentimentScore: result.sentiment.score,
          sentimentLabel: result.sentiment.overall,
          sentimentAspects: JSON.stringify(result.sentiment.aspects),
          sentimentKeywords: JSON.stringify(result.sentiment.keywords),
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        analyzed: results.length,
        results: results.map((r) => ({
          id: r.id,
          sentiment: r.sentiment,
        })),
      },
    });
  } catch (error) {
    console.error('Error analyzing sentiment:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to analyze sentiment' } },
      { status: 500 }
    );
  }
}
