import { NextRequest, NextResponse } from 'next/server';
import { aiService, AIContext } from '@/lib/services/ai-service';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

/**
 * GET - Get AI insights
 * 
 * Query params:
 * - propertyId: Property ID (optional filter)
 * - category: Filter by category (revenue, operations, guest, pricing, marketing)
 * - refresh: Force refresh insights (bypass cache)
 * - store: Store generated insights in database
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'ai.view') && !hasPermission(user, 'insights.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId') || undefined;
    const category = searchParams.get('category') || undefined;
    const refresh = searchParams.get('refresh') === 'true';
    const store = searchParams.get('store') === 'true';

    const context: AIContext = {
      tenantId,
      propertyId,
    };

    // Clear cache if refresh requested
    if (refresh) {
      aiService.clearCache(tenantId);
    }

    // Generate insights using AI service
    const insights = await aiService.generateInsights(context);

    // Filter by category if specified
    const filteredInsights = category
      ? insights.filter(i => i.category === category)
      : insights;

    // Store insights in database if requested
    if (store) {
      for (const insight of filteredInsights) {
        await aiService.storeInsight(insight, context);
      }
    }

    // Get stored insights from database as well
    const storedInsights = await aiService.getStoredInsights(context, {
      status: 'pending',
      type: category,
      limit: 10,
    });

    // Calculate stats
    const stats = {
      total: filteredInsights.length + storedInsights.length,
      opportunities: filteredInsights.filter(i => i.type === 'opportunity').length,
      alerts: filteredInsights.filter(i => i.type === 'alert').length,
      recommendations: filteredInsights.filter(i => i.type === 'recommendation').length,
      totalPotentialRevenue: filteredInsights.reduce(
        (sum, i) => sum + (i.potentialRevenue || 0),
        0
      ),
      avgConfidence:
        filteredInsights.length > 0
          ? filteredInsights.reduce((sum, i) => sum + i.confidence, 0) /
            filteredInsights.length
          : 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        insights: [
          ...filteredInsights.map((i, idx) => ({
            id: `ai-insight-${idx}`,
            ...i,
            createdAt: new Date().toISOString(),
            status: 'active',
          })),
          ...storedInsights.map(s => ({
            id: s.id,
            category: s.type,
            type: 'recommendation',
            title: s.title,
            description: s.description,
            impact: s.impact,
            potentialRevenue: s.potentialRevenue,
            confidence: s.confidence,
            action: JSON.parse(s.data || '{}').action,
            createdAt: s.createdAt.toISOString(),
            status: s.status,
            appliedAt: s.appliedAt?.toISOString(),
            dismissedAt: s.dismissedAt?.toISOString(),
          })),
        ],
        stats,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching AI insights:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch AI insights' },
      { status: 500 }
    );
  }
}

/**
 * POST - Generate and store new insights
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'ai.manage') && !hasPermission(user, 'insights.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { propertyId, category } = body;

    const context: AIContext = {
      tenantId: user.tenantId,
      propertyId,
    };

    // Clear cache to force fresh generation
    aiService.clearCache(user.tenantId);

    // Generate fresh insights
    const insights = await aiService.generateInsights(context);

    // Filter by category if specified
    const filteredInsights = category
      ? insights.filter(i => i.category === category)
      : insights;

    // Store all insights in database
    const storedIds: string[] = [];
    for (const insight of filteredInsights) {
      const id = await aiService.storeInsight(insight, context);
      storedIds.push(id!);
    }

    return NextResponse.json({
      success: true,
      data: {
        insights: filteredInsights.map((i, idx) => ({
          id: storedIds[idx],
          ...i,
          createdAt: new Date().toISOString(),
          status: 'pending',
        })),
        count: filteredInsights.length,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error generating AI insights:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate AI insights' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update insight status (apply/dismiss)
 */
export async function PUT(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { insightId, action } = body;

    if (!insightId || !action) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'insightId and action are required' } },
        { status: 400 }
      );
    }

    // Verify insight belongs to user's tenant
    const existingInsight = await db.aISuggestion.findUnique({
      where: { id: insightId },
    });

    if (!existingInsight || existingInsight.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Insight not found' } },
        { status: 404 }
      );
    }

    if (action === 'apply') {
      await aiService.applyInsight(insightId);
    } else if (action === 'dismiss') {
      await aiService.dismissInsight(insightId);
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Use "apply" or "dismiss"' },
        { status: 400 }
      );
    }

    // Get updated insight
    const insight = await db.aISuggestion.findUnique({
      where: { id: insightId },
    });

    return NextResponse.json({
      success: true,
      data: {
        insight: insight
          ? {
              id: insight.id,
              status: insight.status,
              appliedAt: insight.appliedAt?.toISOString(),
              dismissedAt: insight.dismissedAt?.toISOString(),
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Error updating AI insight:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update AI insight' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete an insight
 */
export async function DELETE(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const insightId = searchParams.get('id');

    if (!insightId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'id is required' } },
        { status: 400 }
      );
    }

    // Verify insight belongs to user's tenant
    const existingInsight = await db.aISuggestion.findUnique({
      where: { id: insightId },
    });

    if (!existingInsight || existingInsight.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Insight not found' } },
        { status: 404 }
      );
    }

    await db.aISuggestion.delete({
      where: { id: insightId },
    });

    return NextResponse.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error) {
    console.error('Error deleting AI insight:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete AI insight' },
      { status: 500 }
    );
  }
}
