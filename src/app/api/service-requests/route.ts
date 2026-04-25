import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/service-requests - List all service requests with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'service_requests.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const guestId = searchParams.get('guestId');
    const bookingId = searchParams.get('bookingId');
    const roomId = searchParams.get('roomId');
    const assignedTo = searchParams.get('assignedTo');
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const priority = searchParams.get('priority');
    const search = searchParams.get('search');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (propertyId) {
      where.propertyId = propertyId;
    }

    if (guestId) {
      where.guestId = guestId;
    }

    if (bookingId) {
      where.bookingId = bookingId;
    }

    if (roomId) {
      where.roomId = roomId;
    }

    if (assignedTo) {
      where.assignedTo = assignedTo;
    }

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (priority) {
      where.priority = priority;
    }

    if (search) {
      where.OR = [
        { subject: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const serviceRequests = await db.serviceRequest.findMany({
      where,
      include: {
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            jobTitle: true,
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { requestedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      ...(limit && { take: Math.min(parseInt(limit), 100) }),
      ...(offset && { skip: parseInt(offset) }),
    });

    const total = await db.serviceRequest.count({ where });

    // Calculate summary statistics
    const statusCounts = await db.serviceRequest.groupBy({
      by: ['status'],
      where,
      _count: {
        id: true,
      },
    });

    const priorityCounts = await db.serviceRequest.groupBy({
      by: ['priority'],
      where,
      _count: {
        id: true,
      },
    });

    const typeCounts = await db.serviceRequest.groupBy({
      by: ['type'],
      where,
      _count: {
        id: true,
      },
    });

    // Calculate average rating for completed requests
    const completedRequests = await db.serviceRequest.findMany({
      where: { ...where, status: 'completed', rating: { not: null } },
      select: { rating: true },
    });

    const avgRating = completedRequests.length > 0
      ? completedRequests.reduce((sum, r) => sum + (r.rating || 0), 0) / completedRequests.length
      : null;

    return NextResponse.json({
      success: true,
      data: serviceRequests,
      pagination: {
        total,
        limit: limit ? parseInt(limit) : null,
        offset: offset ? parseInt(offset) : null,
      },
      summary: {
        byStatus: statusCounts.reduce((acc, item) => {
          acc[item.status] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
        byPriority: priorityCounts.reduce((acc, item) => {
          acc[item.priority] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
        byType: typeCounts.reduce((acc, item) => {
          acc[item.type] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
        avgRating,
      },
    });
  } catch (error) {
    console.error('Error fetching service requests:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch service requests' } },
      { status: 500 }
    );
  }
}

// POST /api/service-requests - Create a new service request
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'service_requests.create')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();

    const {
      propertyId,
      guestId,
      bookingId,
      roomId,
      type,
      category,
      subject,
      description,
      priority = 'medium',
      assignedTo,
      source = 'app',
    } = body;

    // Validate required fields
    if (!propertyId || !type || !subject) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: propertyId, type, subject' } },
        { status: 400 }
      );
    }

    // Verify property exists and belongs to tenant
    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId: user.tenantId, deletedAt: null },
    });

    if (!property) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PROPERTY', message: 'Property not found' } },
        { status: 400 }
      );
    }

    // If assigned to a user, verify they exist and belong to same tenant
    if (assignedTo) {
      const assigneeUser = await db.user.findFirst({
        where: { id: assignedTo, tenantId: user.tenantId, deletedAt: null },
      });

      if (!assigneeUser) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_USER', message: 'Assigned user not found' } },
          { status: 400 }
        );
      }
    }

    const serviceRequest = await db.serviceRequest.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        guestId,
        bookingId,
        roomId,
        type,
        category,
        subject,
        description,
        priority,
        status: assignedTo ? 'assigned' : 'pending',
        assignedTo,
        assignedAt: assignedTo ? new Date() : null,
        source,
        requestedAt: new Date(),
      },
      include: {
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            jobTitle: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: serviceRequest }, { status: 201 });
  } catch (error) {
    console.error('Error creating service request:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create service request' } },
      { status: 500 }
    );
  }
}

// PUT /api/service-requests - Update service request (bulk update or status workflow)
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'service_requests.update')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, status, assignedTo, priority, rating, feedback } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Service request ID is required' } },
        { status: 400 }
      );
    }

    const existingRequest = await db.serviceRequest.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existingRequest) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Service request not found' } },
        { status: 404 }
      );
    }

    // Build update data based on status workflow
    const updateData: Record<string, unknown> = {};

    if (status) {
      // Validate status transitions
      const validTransitions: Record<string, string[]> = {
        'pending': ['assigned', 'cancelled'],
        'assigned': ['in_progress', 'cancelled'],
        'in_progress': ['completed', 'on_hold', 'cancelled'],
        'on_hold': ['in_progress', 'cancelled'],
        'completed': [],
        'cancelled': [],
      };

      if (!validTransitions[existingRequest.status]?.includes(status)) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_STATUS', message: `Cannot transition from ${existingRequest.status} to ${status}` } },
          { status: 400 }
        );
      }

      updateData.status = status;

      // Handle status transitions
      if (status === 'in_progress' && !existingRequest.startedAt) {
        updateData.startedAt = new Date();
      }

      if (status === 'completed') {
        updateData.completedAt = new Date();
      }

      if (status === 'assigned' && assignedTo) {
        updateData.assignedTo = assignedTo;
        updateData.assignedAt = new Date();
      }
    }

    if (assignedTo !== undefined) {
      // Verify assignee exists
      if (assignedTo) {
        const assigneeUser = await db.user.findFirst({
          where: { id: assignedTo, tenantId: user.tenantId, deletedAt: null },
        });
        if (!assigneeUser) {
          return NextResponse.json(
            { success: false, error: { code: 'INVALID_USER', message: 'Assigned user not found' } },
            { status: 400 }
          );
        }
      }
      updateData.assignedTo = assignedTo;
      if (assignedTo && existingRequest.status === 'pending') {
        updateData.status = 'assigned';
        updateData.assignedAt = new Date();
      }
    }

    if (priority) {
      updateData.priority = priority;
    }

    if (rating !== undefined) {
      // Validate rating (1-5)
      if (rating < 1 || rating > 5) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Rating must be between 1 and 5' } },
          { status: 400 }
        );
      }
      updateData.rating = rating;
    }

    if (feedback !== undefined) {
      updateData.feedback = feedback;
    }

    const updatedRequest = await db.serviceRequest.update({
      where: { id },
      data: updateData,
      include: {
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            jobTitle: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: updatedRequest });
  } catch (error) {
    console.error('Error updating service request:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update service request' } },
      { status: 500 }
    );
  }
}
