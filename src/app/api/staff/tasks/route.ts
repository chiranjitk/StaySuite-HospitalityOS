import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/staff/tasks - Get tasks
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
    if (!hasPermission(user, 'tasks.view') && !hasPermission(user, 'staff.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view tasks' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const priority = searchParams.get('priority');
    const status = searchParams.get('status');
    const assignedTo = searchParams.get('assignedTo');
    const category = searchParams.get('category');
    const limit = searchParams.get('limit');

    // Build where clause with tenant scoping
    const where: Record<string, unknown> = { tenantId: user.tenantId };
    
    if (priority) where.priority = priority;
    if (status) where.status = status;
    if (assignedTo) where.assignedTo = assignedTo;
    if (category) where.category = category;

    const tasks = await db.task.findMany({
      where,
      include: {
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            department: true,
            jobTitle: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      ...(limit && { take: Math.min(parseInt(limit, 10), 100) }), // Cap at 100
    });

    // Calculate stats
    const stats = {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      overdue: tasks.filter(t => {
        if (!t.deadline || t.status === 'completed') return false;
        return new Date(t.deadline) < new Date();
      }).length,
    };

    return NextResponse.json({
      success: true,
      tasks: tasks.map(t => ({
        ...t,
        assignedToUser: t.assignee,
      })),
      stats,
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch tasks' } },
      { status: 500 }
    );
  }
}

// POST /api/staff/tasks - Create a new task
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
    if (!hasPermission(user, 'tasks.create') && !hasPermission(user, 'staff.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to create tasks' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      title,
      description,
      category,
      priority = 'medium',
      status = 'pending',
      assignedTo,
      scheduledAt,
      dueDate,
      notes,
      propertyId,
    } = body;

    // Validate required fields
    if (!title) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Title is required' } },
        { status: 400 }
      );
    }

    // If property is specified, verify it exists and belongs to user's tenant
    let resolvedPropertyId = propertyId;
    if (propertyId) {
      const property = await db.property.findUnique({
        where: { id: propertyId, tenantId: user.tenantId },
        select: { id: true },
      });
      if (!property) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_PROPERTY', message: 'Property not found or does not belong to your tenant' } },
          { status: 400 }
        );
      }
    } else {
      // Get first property from user's tenant as default
      const firstProperty = await db.property.findFirst({
        where: { tenantId: user.tenantId },
        select: { id: true },
      });
      resolvedPropertyId = firstProperty?.id;
    }

    // If assigned to a user, verify they exist and belong to same tenant
    if (assignedTo) {
      const assignedUser = await db.user.findUnique({
        where: { id: assignedTo, tenantId: user.tenantId, deletedAt: null },
      });
      if (!assignedUser) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_USER', message: 'Assigned user not found or does not belong to your tenant' } },
          { status: 400 }
        );
      }
    }

    const task = await db.task.create({
      data: {
        tenantId: user.tenantId,
        propertyId: resolvedPropertyId,
        title,
        description,
        category: category || 'Other',
        type: 'staff_task',
        priority,
        status,
        assignedTo: assignedTo || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        deadline: dueDate ? new Date(dueDate) : null,
        notes,
      },
      include: {
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            department: true,
            jobTitle: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      task: {
        ...task,
        assignedToUser: task.assignee,
      },
    });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create task' } },
      { status: 500 }
    );
  }
}
