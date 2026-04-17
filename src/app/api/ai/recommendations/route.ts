import { NextRequest, NextResponse } from 'next/server';
import { aiService, AIContext, InsightData } from '@/lib/services/ai-service';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

type RecommendationContext = 'pricing' | 'marketing' | 'operations' | 'guest_experience';

/**
 * GET - Get AI recommendations for specific context
 *
 * Query params:
 * - propertyId: Property ID (optional)
 * - context: Recommendation context (pricing, marketing, operations, guest_experience)
 * - status: Filter by status (pending, applied, dismissed)
 * - limit: Number of results (default: 20)
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
    if (!hasPermission(user, 'ai.view') && !hasPermission(user, 'recommendations.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId') || undefined;
    const contextType = searchParams.get('context') as RecommendationContext | null;
    const status = searchParams.get('status') || undefined;
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const context: AIContext = {
      tenantId,
      propertyId,
    };

    // Get stored recommendations from database
    const storedRecommendations = await db.aISuggestion.findMany({
      where: {
        tenantId,
        ...(contextType ? { type: contextType } : {}),
        ...(status ? { status } : { status: { not: 'dismissed' } }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Group by context type
    const grouped: Record<string, typeof storedRecommendations> = {
      pricing: [],
      marketing: [],
      operations: [],
      guest: [],
    };

    storedRecommendations.forEach(rec => {
      const type = rec.type as keyof typeof grouped;
      if (grouped[type]) {
        grouped[type].push(rec);
      } else {
        grouped.operations.push(rec);
      }
    });

    // Calculate summary stats
    const stats = {
      total: storedRecommendations.length,
      pending: storedRecommendations.filter(r => r.status === 'pending').length,
      applied: storedRecommendations.filter(r => r.status === 'applied').length,
      dismissed: storedRecommendations.filter(r => r.status === 'dismissed').length,
      totalPotentialRevenue: storedRecommendations.reduce(
        (sum, r) => sum + r.potentialRevenue,
        0
      ),
      avgConfidence:
        storedRecommendations.length > 0
          ? storedRecommendations.reduce((sum, r) => sum + r.confidence, 0) /
            storedRecommendations.length
          : 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        recommendations: storedRecommendations.map(r => ({
          id: r.id,
          context: r.type,
          title: r.title,
          description: r.description,
          impact: r.impact,
          potentialRevenue: r.potentialRevenue,
          confidence: r.confidence,
          status: r.status,
          data: JSON.parse(r.data || '{}'),
          appliedAt: r.appliedAt?.toISOString(),
          dismissedAt: r.dismissedAt?.toISOString(),
          createdAt: r.createdAt.toISOString(),
        })),
        grouped: Object.fromEntries(
          Object.entries(grouped).map(([key, value]) => [
            key,
            value.map(r => ({
              id: r.id,
              title: r.title,
              description: r.description,
              impact: r.impact,
              status: r.status,
              createdAt: r.createdAt.toISOString(),
            })),
          ])
        ),
        stats,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching AI recommendations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch AI recommendations' },
      { status: 500 }
    );
  }
}

/**
 * POST - Generate new recommendations for specific context
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
    if (!hasPermission(user, 'ai.manage') && !hasPermission(user, 'recommendations.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { propertyId, context: contextType, store = true } = body;

    if (
      contextType &&
      !['pricing', 'marketing', 'operations', 'guest_experience'].includes(
        contextType
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid context. Use: pricing, marketing, operations, or guest_experience' },
        },
        { status: 400 }
      );
    }

    const tenantId = user.tenantId;
    const context: AIContext = {
      tenantId,
      propertyId,
    };

    // Generate recommendations for all contexts or specific one
    const contexts: RecommendationContext[] = contextType
      ? [contextType as RecommendationContext]
      : ['pricing', 'marketing', 'operations', 'guest_experience'];

    const allRecommendations: InsightData[] = [];

    for (const ctx of contexts) {
      const recommendations = await aiService.generateRecommendations(ctx, context);
      allRecommendations.push(...recommendations);
    }

    // Store recommendations if requested
    const storedIds: string[] = [];
    if (store) {
      for (const rec of allRecommendations) {
        const id = await db.aISuggestion.create({
          data: {
            tenantId,
            type: rec.category,
            title: rec.title,
            description: rec.description,
            impact: rec.impact,
            potentialRevenue: rec.potentialRevenue || 0,
            confidence: rec.confidence,
            status: 'pending',
            data: JSON.stringify(rec.data || {}),
          },
        });
        storedIds.push(id.id);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        recommendations: allRecommendations.map((r, idx) => ({
          id: storedIds[idx] || `rec-${idx}`,
          context: r.category,
          title: r.title,
          description: r.description,
          impact: r.impact,
          potentialRevenue: r.potentialRevenue,
          confidence: r.confidence,
          action: r.action,
          status: 'pending',
          createdAt: new Date().toISOString(),
        })),
        count: allRecommendations.length,
        contextsGenerated: contexts,
        stored: store,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error generating AI recommendations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate AI recommendations' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Mark recommendation as applied or dismissed
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
    const { recommendationId, action, feedback } = body;

    if (!recommendationId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'recommendationId is required' } },
        { status: 400 }
      );
    }

    if (!['apply', 'dismiss', 'undo'].includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid action. Use: apply, dismiss, or undo' },
        },
        { status: 400 }
      );
    }

    const existing = await db.aISuggestion.findUnique({
      where: { id: recommendationId },
    });

    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Recommendation not found' } },
        { status: 404 }
      );
    }

    let updated;
    const updateData: Record<string, unknown> = {};

    switch (action) {
      case 'apply':
        updateData.status = 'applied';
        updateData.appliedAt = new Date();
        break;
      case 'dismiss':
        updateData.status = 'dismissed';
        updateData.dismissedAt = new Date();
        break;
      case 'undo':
        updateData.status = 'pending';
        updateData.appliedAt = null;
        updateData.dismissedAt = null;
        break;
    }

    // Store feedback if provided
    if (feedback) {
      const existingData = JSON.parse(existing.data || '{}');
      updateData.data = JSON.stringify({
        ...existingData,
        feedback,
        feedbackAt: new Date().toISOString(),
      });
    }

    updated = await db.aISuggestion.update({
      where: { id: recommendationId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        recommendation: {
          id: updated.id,
          status: updated.status,
          appliedAt: updated.appliedAt?.toISOString(),
          dismissedAt: updated.dismissedAt?.toISOString(),
        },
        action,
        message:
          action === 'apply'
            ? 'Recommendation marked as applied'
            : action === 'dismiss'
              ? 'Recommendation dismissed'
              : 'Recommendation restored',
      },
    });
  } catch (error) {
    console.error('Error updating AI recommendation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update AI recommendation' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete a recommendation
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
    const recommendationId = searchParams.get('id');

    if (!recommendationId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'id is required' } },
        { status: 400 }
      );
    }

    // Verify recommendation belongs to user's tenant
    const existing = await db.aISuggestion.findUnique({
      where: { id: recommendationId },
    });

    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Recommendation not found' } },
        { status: 404 }
      );
    }

    await db.aISuggestion.delete({
      where: { id: recommendationId },
    });

    return NextResponse.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error) {
    console.error('Error deleting AI recommendation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete AI recommendation' },
      { status: 500 }
    );
  }
}
