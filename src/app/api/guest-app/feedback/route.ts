import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/guest-app/feedback - Get existing feedback for guest
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Token is required' } },
        { status: 400 }
      );
    }

    // Find booking by portal token
    const booking = await db.booking.findFirst({
      where: {
        portalToken: token,
        status: { in: ['confirmed', 'checked_in', 'checked_out'] },
      },
      select: {
        id: true,
        propertyId: true,
        primaryGuestId: true,
      },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Invalid token' } },
        { status: 404 }
      );
    }

    // Get existing feedback from this guest
    const existingFeedback = await db.guestFeedback.findMany({
      where: {
        guestId: booking.primaryGuestId,
        propertyId: booking.propertyId,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Get existing reviews
    const existingReviews = await db.guestReview.findMany({
      where: {
        guestId: booking.primaryGuestId,
        propertyId: booking.propertyId,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: {
        feedback: existingFeedback.map(fb => ({
          id: fb.id,
          type: fb.type,
          category: fb.category,
          subject: fb.subject,
          description: fb.description,
          priority: fb.priority,
          status: fb.status,
          resolvedAt: fb.resolvedAt,
          resolution: fb.resolution,
          createdAt: fb.createdAt,
        })),
        reviews: existingReviews.map(rv => ({
          id: rv.id,
          overallRating: rv.overallRating,
          cleanlinessRating: rv.cleanlinessRating,
          serviceRating: rv.serviceRating,
          locationRating: rv.locationRating,
          valueRating: rv.valueRating,
          title: rv.title,
          comment: rv.comment,
          source: rv.source,
          createdAt: rv.createdAt,
        })),
        canLeaveReview: existingReviews.length === 0,
      },
    });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch feedback' } },
      { status: 500 }
    );
  }
}

// POST /api/guest-app/feedback - Submit feedback or review
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      token,
      type, // 'feedback' or 'review'
      // Feedback fields
      feedbackType,
      category,
      subject,
      description,
      priority,
      // Review fields
      overallRating,
      cleanlinessRating,
      serviceRating,
      locationRating,
      valueRating,
      title,
      comment,
    } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Token is required' } },
        { status: 400 }
      );
    }

    // Find booking by portal token
    const booking = await db.booking.findFirst({
      where: {
        portalToken: token,
        status: { in: ['confirmed', 'checked_in', 'checked_out'] },
      },
      select: {
        id: true,
        propertyId: true,
        primaryGuestId: true,
      },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Invalid token' } },
        { status: 404 }
      );
    }

    let result;

    if (type === 'review') {
      // Validate review fields
      if (!overallRating || overallRating < 1 || overallRating > 5) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Overall rating is required (1-5)' } },
          { status: 400 }
        );
      }

      // Create review
      result = await db.guestReview.create({
        data: {
          guestId: booking.primaryGuestId,
          propertyId: booking.propertyId,
          overallRating,
          cleanlinessRating,
          serviceRating,
          locationRating,
          valueRating,
          title,
          comment,
          source: 'internal',
        },
      });

      // Update guest's average rating contribution
      // This could trigger an AI sentiment analysis in a real system

    } else {
      // Create feedback
      if (!feedbackType || !category || !subject || !description) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Feedback type, category, subject, and description are required' } },
          { status: 400 }
        );
      }

      result = await db.guestFeedback.create({
        data: {
          guestId: booking.primaryGuestId,
          propertyId: booking.propertyId,
          type: feedbackType,
          category,
          subject,
          description,
          priority: priority || 'medium',
          status: 'open',
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: result.id,
        type: type === 'review' ? 'review' : 'feedback',
        createdAt: result.createdAt,
      },
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to submit feedback' } },
      { status: 500 }
    );
  }
}
