import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

const MAX_LIMIT = 100;

// GET - Fetch campaigns with stats
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
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const platform = searchParams.get('platform') || '';
    const overview = searchParams.get('overview') === 'true';

    // Build where clause
    const where: Record<string, unknown> = { tenantId };
    if (status) where.status = status;
    if (platform) where.platform = platform;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const campaigns = await db.adCampaign.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: MAX_LIMIT,
    });

    // Calculate stats
    const stats = {
      total: campaigns.length,
      active: campaigns.filter(c => c.status === 'active').length,
      paused: campaigns.filter(c => c.status === 'paused').length,
      totalBudget: campaigns.reduce((sum, c) => sum + c.budget, 0),
      totalSpent: campaigns.reduce((sum, c) => sum + c.spentAmount, 0),
      totalRevenue: campaigns.reduce((sum, c) => sum + c.revenue, 0),
      avgRoas: campaigns.length > 0 
        ? campaigns.reduce((sum, c) => sum + c.roas, 0) / campaigns.length 
        : 0,
      avgCtr: campaigns.length > 0
        ? campaigns.reduce((sum, c) => sum + c.ctr, 0) / campaigns.length
        : 0,
    };

    // Overview only
    if (overview) {
      return NextResponse.json({
        success: true,
        data: {
          overview: stats,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        campaigns,
        stats,
      },
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch campaigns' } },
      { status: 500 }
    );
  }
}

// POST - Create new campaign
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

    // Check permission
    if (!hasPermission(user, 'ads.create') && !hasPermission(user, 'marketing.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();

    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Campaign name is required' } },
        { status: 400 }
      );
    }

    // Validate platform
    const validPlatforms = ['google', 'meta', 'tripadvisor', 'trivago', 'expedia', 'booking_com', 'direct'];
    if (body.platform && !validPlatforms.includes(body.platform)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid platform' } },
        { status: 400 }
      );
    }

    // Validate budget
    if (body.budget !== undefined && body.budget < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Budget cannot be negative' } },
        { status: 400 }
      );
    }

    // Validate bid amount
    if (body.bidAmount !== undefined && body.bidAmount !== null && body.bidAmount < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Bid amount cannot be negative' } },
        { status: 400 }
      );
    }

    // Validate target CPA
    if (body.targetCpa !== undefined && body.targetCpa !== null && body.targetCpa < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Target CPA cannot be negative' } },
        { status: 400 }
      );
    }

    // Validate target ROAS
    if (body.targetRoas !== undefined && body.targetRoas !== null && body.targetRoas < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Target ROAS cannot be negative' } },
        { status: 400 }
      );
    }

    // Validate dates
    if (body.startDate && body.endDate && new Date(body.startDate) > new Date(body.endDate)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Start date cannot be after end date' } },
        { status: 400 }
      );
    }

    const campaign = await db.adCampaign.create({
      data: {
        tenantId,
        name: body.name,
        description: body.description || null,
        type: body.type || 'search',
        platform: body.platform || 'google',
        status: 'draft',
        budget: body.budget || 0,
        budgetType: body.budgetType || 'daily',
        bidStrategy: body.bidStrategy || 'auto',
        bidAmount: body.bidAmount || null,
        targetCpa: body.targetCpa || null,
        targetRoas: body.targetRoas || null,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        targeting: body.targeting || '{}',
        keywords: body.keywords || '[]',
        roomTypes: body.roomTypes || '[]',
        ratePlans: body.ratePlans || '[]',
      },
    });

    return NextResponse.json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    console.error('Error creating campaign:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create campaign' } },
      { status: 500 }
    );
  }
}

// PUT - Update campaign
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
    if (!hasPermission(user, 'ads.edit') && !hasPermission(user, 'marketing.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Campaign ID is required' } },
        { status: 400 }
      );
    }

    // Verify campaign exists and belongs to tenant
    const existing = await db.adCampaign.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Campaign not found' } },
        { status: 404 }
      );
    }

    if (existing.tenantId !== tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Validate numeric fields
    if (updateData.budget !== undefined && updateData.budget < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Budget cannot be negative' } },
        { status: 400 }
      );
    }

    if (updateData.bidAmount !== undefined && updateData.bidAmount !== null && updateData.bidAmount < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Bid amount cannot be negative' } },
        { status: 400 }
      );
    }

    // Validate status transition
    const validStatuses = ['draft', 'active', 'paused', 'completed', 'cancelled'];
    if (updateData.status && !validStatuses.includes(updateData.status)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid status' } },
        { status: 400 }
      );
    }

    // Validate dates
    const startDate = updateData.startDate ? new Date(updateData.startDate) : existing.startDate;
    const endDate = updateData.endDate ? new Date(updateData.endDate) : existing.endDate;
    if (startDate && endDate && startDate > endDate) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Start date cannot be after end date' } },
        { status: 400 }
      );
    }

    // Prepare update data
    const data: Record<string, unknown> = {};
    
    if (updateData.name !== undefined) data.name = updateData.name;
    if (updateData.description !== undefined) data.description = updateData.description;
    if (updateData.status !== undefined) data.status = updateData.status;
    if (updateData.budget !== undefined) data.budget = updateData.budget;
    if (updateData.budgetType !== undefined) data.budgetType = updateData.budgetType;
    if (updateData.bidStrategy !== undefined) data.bidStrategy = updateData.bidStrategy;
    if (updateData.bidAmount !== undefined) data.bidAmount = updateData.bidAmount;
    if (updateData.targetCpa !== undefined) data.targetCpa = updateData.targetCpa;
    if (updateData.targetRoas !== undefined) data.targetRoas = updateData.targetRoas;
    if (updateData.startDate !== undefined) data.startDate = updateData.startDate ? new Date(updateData.startDate) : null;
    if (updateData.endDate !== undefined) data.endDate = updateData.endDate ? new Date(updateData.endDate) : null;
    if (updateData.targeting !== undefined) data.targeting = updateData.targeting;
    if (updateData.keywords !== undefined) data.keywords = updateData.keywords;

    const campaign = await db.adCampaign.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    console.error('Error updating campaign:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update campaign' } },
      { status: 500 }
    );
  }
}

// DELETE - Delete campaign
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
    if (!hasPermission(user, 'ads.delete') && !hasPermission(user, 'marketing.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Campaign ID is required' } },
        { status: 400 }
      );
    }

    // Verify campaign exists and belongs to tenant
    const existing = await db.adCampaign.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Campaign not found' } },
        { status: 404 }
      );
    }

    if (existing.tenantId !== tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Delete performance records first
    await db.adPerformance.deleteMany({
      where: { campaignId: id },
    });

    // Delete campaign
    await db.adCampaign.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      data: { id },
    });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete campaign' } },
      { status: 500 }
    );
  }
}
