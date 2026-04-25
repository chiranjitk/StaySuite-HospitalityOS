import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';

/**
 * POST /api/ai/feedback - Record AI copilot feedback (thumbs up/down)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { messageId, positive, context } = body;

    if (!messageId || positive === undefined) {
      return NextResponse.json(
        { success: false, error: 'messageId and positive are required' },
        { status: 400 }
      );
    }

    // Store feedback in the database (non-critical, so we don't throw on failure)
    try {
      await db.aIFeedback.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          messageId,
          positive: !!positive,
          context: context || null,
        },
      });
    } catch (dbError) {
      // Log but don't fail - feedback is non-critical
      console.warn('Failed to store AI feedback:', dbError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error recording AI feedback:', error);
    // Return success anyway - feedback is non-critical
    return NextResponse.json({ success: true });
  }
}
