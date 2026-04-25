import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { segmentEvaluator, SegmentDefinition } from '@/lib/crm/segment-evaluator';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

const MAX_LIMIT = 100;

// GET /api/segments - List guest segments
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
    const search = searchParams.get('search') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), MAX_LIMIT);
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: Prisma.GuestSegmentWhereInput = {
      tenantId,
      ...(search && {
        OR: [
          { name: { contains: search } },
          { description: { contains: search } },
        ],
      }),
    };

    const [segments, total] = await Promise.all([
      db.guestSegment.findMany({
        where,
        include: {
          members: {
            include: {
              guest: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  loyaltyTier: true,
                  totalSpent: true,
                },
              },
            },
          },
          _count: {
            select: { members: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.guestSegment.count({ where }),
    ]);

    // Calculate stats
    const stats = {
      totalSegments: total,
      totalMembers: segments.reduce((acc, s) => acc + s._count.members, 0),
      avgMembersPerSegment: total > 0 ? Math.round(segments.reduce((acc, s) => acc + s._count.members, 0) / segments.length) : 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        segments: segments.map((s) => ({
          ...s,
          memberCount: s._count.members,
          members: s.members.slice(0, 5), // Return only first 5 members as preview
        })),
        total,
        stats,
      },
    });
  } catch (error) {
    console.error('Error fetching segments:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch segments' } },
      { status: 500 }
    );
  }
}

// POST /api/segments - Create a new segment or evaluate rules
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
    
    // Check if this is an evaluate request
    if (body.action === 'evaluate') {
      return handleEvaluateRequest(body, tenantId);
    }
    
    if (body.action === 'preview') {
      return handlePreviewRequest(body, tenantId);
    }

    // Default: Create a new segment - check permission
    if (!hasPermission(user, 'segments.create') && !hasPermission(user, 'crm.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const {
      name,
      description,
      rules,
      guestIds = [],
    } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Segment name is required' } },
        { status: 400 }
      );
    }

    // Check for duplicate name
    const existing = await db.guestSegment.findFirst({
      where: { tenantId, name },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Segment with this name already exists' } },
        { status: 400 }
      );
    }

    // Validate guestIds belong to tenant if provided
    if (guestIds.length > 0) {
      const validGuests = await db.guest.count({
        where: {
          id: { in: guestIds },
          tenantId,
          deletedAt: null,
        },
      });

      if (validGuests !== guestIds.length) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Some guests do not exist or do not belong to this tenant' } },
          { status: 400 }
        );
      }
    }

    // Create segment with optional initial members
    const segment = await db.guestSegment.create({
      data: {
        tenantId,
        name,
        description,
        rules: rules || JSON.stringify({ operator: 'and', rules: [] }),
        memberCount: guestIds.length,
        ...(guestIds.length > 0 && {
          members: {
            create: guestIds.map((guestId: string) => ({
              guestId,
            })),
          },
        }),
      },
      include: {
        members: {
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
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: segment,
    });
  } catch (error) {
    console.error('Error creating segment:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create segment' } },
      { status: 500 }
    );
  }
}

/**
 * Handle segment evaluation request
 */
async function handleEvaluateRequest(body: {
  segmentId: string;
  updateMemberCount?: boolean;
  syncMemberships?: boolean;
}, tenantId: string): Promise<NextResponse> {
  const { segmentId, updateMemberCount = true, syncMemberships = true } = body;

  if (!segmentId) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Segment ID is required' } },
      { status: 400 }
    );
  }

  // Verify segment belongs to tenant
  const segment = await db.guestSegment.findUnique({
    where: { id: segmentId },
    select: { tenantId: true },
  });

  if (!segment) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Segment not found' } },
      { status: 404 }
    );
  }

  if (segment.tenantId !== tenantId) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
      { status: 403 }
    );
  }

  try {
    const result = await segmentEvaluator.evaluateSegmentRules(segmentId, {
      updateMemberCount,
      syncMemberships,
    });

    return NextResponse.json({
      success: true,
      data: {
        segmentId: result.segmentId,
        matchedCount: result.matchedCount,
        guestIds: result.guestIds,
        evaluatedAt: result.evaluatedAt,
        ruleSummary: result.ruleSummary,
      },
    });
  } catch (error) {
    console.error('Error evaluating segment:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to evaluate segment' } },
      { status: 500 }
    );
  }
}

/**
 * Handle rule preview request
 */
async function handlePreviewRequest(body: {
  rules: SegmentDefinition;
}, tenantId: string): Promise<NextResponse> {
  const { rules } = body;

  if (!rules) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Rules are required' } },
      { status: 400 }
    );
  }

  try {
    const result = await segmentEvaluator.evaluateRules(tenantId, rules);

    return NextResponse.json({
      success: true,
      data: {
        matchedCount: result.matchedCount,
        guestIds: result.guestIds,
        ruleSummary: result.ruleSummary,
      },
    });
  } catch (error) {
    console.error('Error previewing rules:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to preview rules' } },
      { status: 500 }
    );
  }
}

// PUT /api/segments - Update segment
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
    if (!hasPermission(user, 'segments.edit') && !hasPermission(user, 'crm.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const { id, name, description, rules, isActive, reevaluate } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Segment ID is required' } },
        { status: 400 }
      );
    }

    // Verify segment exists and belongs to tenant
    const existingSegment = await db.guestSegment.findUnique({
      where: { id },
    });

    if (!existingSegment) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Segment not found' } },
        { status: 404 }
      );
    }

    if (existingSegment.tenantId !== tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Check for duplicate name if name is being updated
    if (name && name !== existingSegment.name) {
      const existing = await db.guestSegment.findFirst({
        where: {
          tenantId,
          name,
          NOT: { id },
        },
      });

      if (existing) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Segment with this name already exists' } },
          { status: 400 }
        );
      }
    }

    // Re-evaluate segment if requested or if rules changed
    if (reevaluate || rules) {
      try {
        await segmentEvaluator.evaluateSegmentRules(id, {
          updateMemberCount: true,
          syncMemberships: true,
        });
      } catch (error) {
        console.error('Error re-evaluating segment:', error);
      }
    }

    const segment = await db.guestSegment.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(rules && { rules }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        members: {
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
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: segment,
    });
  } catch (error) {
    console.error('Error updating segment:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update segment' } },
      { status: 500 }
    );
  }
}

// DELETE /api/segments - Delete segment
export async function DELETE(request: NextRequest) {
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
    if (!hasPermission(user, 'segments.delete') && !hasPermission(user, 'crm.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Segment ID is required' } },
        { status: 400 }
      );
    }

    // Verify segment exists and belongs to tenant
    const segment = await db.guestSegment.findUnique({
      where: { id },
    });

    if (!segment) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Segment not found' } },
        { status: 404 }
      );
    }

    if (segment.tenantId !== tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Check if segment is used in any campaigns
    const campaignUsage = await db.campaignSegment.count({
      where: { segmentId: id },
    });

    if (campaignUsage > 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Cannot delete segment used in campaigns' } },
        { status: 400 }
      );
    }

    // Delete members first (cascade)
    await db.segmentMembership.deleteMany({
      where: { segmentId: id },
    });

    // Delete segment
    await db.guestSegment.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Segment deleted successfully' },
    });
  } catch (error) {
    console.error('Error deleting segment:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete segment' } },
      { status: 500 }
    );
  }
}
