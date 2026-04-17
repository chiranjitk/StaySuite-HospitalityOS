import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { requirePermission } from '@/lib/auth/tenant-context';// GET /api/crm/feedback - List all feedback
export async function GET(request: NextRequest) {    const user = await requirePermission(request, 'crm.view');
    if (user instanceof NextResponse) return user;

      try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = user.tenantId;
    const type = searchParams.get('type');
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    const where: Prisma.GuestFeedbackWhereInput = {
      guest: { tenantId },
      ...(type && { type }),
      ...(category && { category }),
      ...(status && { status }),
      ...(priority && { priority }),
    };

    const [feedbacks, total] = await Promise.all([
      db.guestFeedback.findMany({
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
      db.guestFeedback.count({ where }),
    ]);

    // Calculate stats
    const allFeedback = await db.guestFeedback.findMany({
      where: { guest: { tenantId } },
      select: { type: true, status: true, priority: true, createdAt: true },
    });

    const stats = {
      total: allFeedback.length,
      open: allFeedback.filter(f => f.status === 'open' || f.status === 'in_progress').length,
      resolved: allFeedback.filter(f => f.status === 'resolved').length,
      byType: {
        complaint: allFeedback.filter(f => f.type === 'complaint').length,
        compliment: allFeedback.filter(f => f.type === 'compliment').length,
        suggestion: allFeedback.filter(f => f.type === 'suggestion').length,
      },
      byStatus: {
        open: allFeedback.filter(f => f.status === 'open').length,
        in_progress: allFeedback.filter(f => f.status === 'in_progress').length,
        resolved: allFeedback.filter(f => f.status === 'resolved').length,
        closed: allFeedback.filter(f => f.status === 'closed').length,
      },
      byPriority: {
        low: allFeedback.filter(f => f.priority === 'low').length,
        medium: allFeedback.filter(f => f.priority === 'medium').length,
        high: allFeedback.filter(f => f.priority === 'high').length,
        critical: allFeedback.filter(f => f.priority === 'critical').length,
      },
    };

    return NextResponse.json({
      success: true,
      data: {
        feedbacks,
        total,
        stats,
      },
    });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch feedback' } },
      { status: 500 }
    );
  }
}

// POST /api/crm/feedback - Create new feedback
export async function POST(request: NextRequest) {    const user = await requirePermission(request, 'crm.manage');
    if (user instanceof NextResponse) return user;

      try {
    const body = await request.json();
    const {
      guestId,
      propertyId,
      type,
      category,
      subject,
      description,
      priority = 'medium',
    } = body;

    if (!guestId || !subject || !description || !type || !category) {
      return NextResponse.json(
        { success: false, error: { message: 'Guest ID, subject, description, type, and category are required' } },
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

    const feedback = await db.guestFeedback.create({
      data: {
        guestId,
        propertyId,
        type,
        category,
        subject,
        description,
        priority,
        status: 'open',
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
      data: feedback,
    });
  } catch (error) {
    console.error('Error creating feedback:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to create feedback' } },
      { status: 500 }
    );
  }
}

// PUT /api/crm/feedback - Update feedback (resolve, change status)
export async function PUT(request: NextRequest) {    const user = await requirePermission(request, 'crm.manage');
    if (user instanceof NextResponse) return user;

      try {
    const body = await request.json();
    const { id, status, resolution, resolvedBy, priority, assignedTo } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { message: 'Feedback ID is required' } },
        { status: 400 }
      );
    }

    // Verify feedback belongs to user's tenant
    const existingFeedback = await db.guestFeedback.findUnique({
      where: { id },
      include: { guest: { select: { tenantId: true } } },
    });
    if (!existingFeedback || existingFeedback.guest?.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { message: 'Feedback not found or access denied' } },
        { status: 404 }
      );
    }

    const updateData: Prisma.GuestFeedbackUpdateInput = {};
    
    if (status) {
      updateData.status = status;
      if (status === 'resolved' || status === 'closed') {
        updateData.resolvedAt = new Date();
      }
    }
    if (resolution !== undefined) updateData.resolution = resolution;
    if (resolvedBy !== undefined) updateData.resolvedBy = resolvedBy;
    if (priority) updateData.priority = priority;
    // When resolving, set resolvedBy to the current user's ID if not explicitly provided
    if ((status === 'resolved' || status === 'closed') && !resolvedBy) {
      updateData.resolvedBy = user.id;
    }

    const feedback = await db.guestFeedback.update({
      where: { id },
      data: updateData,
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
      data: feedback,
    });
  } catch (error) {
    console.error('Error updating feedback:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to update feedback' } },
      { status: 500 }
    );
  }
}

// DELETE /api/crm/feedback - Delete feedback
export async function DELETE(request: NextRequest) {    const user = await requirePermission(request, 'crm.manage');
    if (user instanceof NextResponse) return user;

      try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { message: 'Feedback ID is required' } },
        { status: 400 }
      );
    }

    // Verify feedback belongs to user's tenant
    const existingFeedback = await db.guestFeedback.findUnique({
      where: { id },
      include: { guest: { select: { tenantId: true } } },
    });
    if (!existingFeedback || existingFeedback.guest?.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { message: 'Feedback not found or access denied' } },
        { status: 404 }
      );
    }

    await db.guestFeedback.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Feedback deleted successfully' },
    });
  } catch (error) {
    console.error('Error deleting feedback:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to delete feedback' } },
      { status: 500 }
    );
  }
}
