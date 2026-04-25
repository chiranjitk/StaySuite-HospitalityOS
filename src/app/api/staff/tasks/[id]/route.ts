import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/staff/tasks/[id] - Get a single task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const task = await db.task.findUnique({
      where: { id, tenantId: user.tenantId }, // Tenant scoping
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

    if (!task) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      task: {
        ...task,
        assignedToUser: task.assignee,
      },
    });
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch task' } },
      { status: 500 }
    );
  }
}

// PUT /api/staff/tasks/[id] - Update a task
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    if (!hasPermission(user, 'tasks.update') && !hasPermission(user, 'staff.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to update tasks' } },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const {
      title,
      description,
      category,
      priority,
      status,
      assignedTo,
      scheduledAt,
      dueDate,
      notes,
    } = body;

    // Get existing task with tenant scoping
    const existingTask = await db.task.findUnique({
      where: { id, tenantId: user.tenantId },
    });

    if (!existingTask) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } },
        { status: 404 }
      );
    }

    // Validate status transitions
    if (status && status !== existingTask.status) {
      const validTransitions: Record<string, string[]> = {
        pending: ['in_progress', 'completed', 'cancelled'],
        in_progress: ['completed', 'pending', 'cancelled'],
        completed: [],
        cancelled: ['pending'],
      };

      if (!validTransitions[existingTask.status]?.includes(status)) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_STATUS_TRANSITION', message: `Cannot transition from ${existingTask.status} to ${status}` } },
          { status: 400 }
        );
      }
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

    const task = await db.task.update({
      where: { id },
      data: {
        title,
        description,
        category,
        priority,
        status,
        assignedTo: assignedTo || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        deadline: dueDate ? new Date(dueDate) : null,
        notes,
        completedAt: status === 'completed' && existingTask.status !== 'completed' ? new Date() : null,
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
    console.error('Error updating task:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update task' } },
      { status: 500 }
    );
  }
}

// PATCH /api/staff/tasks/[id] - Partial update (e.g., status change)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    if (!hasPermission(user, 'tasks.update') && !hasPermission(user, 'staff.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to update tasks' } },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    // Get existing task with tenant scoping
    const existingTask = await db.task.findUnique({
      where: { id, tenantId: user.tenantId },
    });

    if (!existingTask) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } },
        { status: 404 }
      );
    }

    // Validate status transitions if status is being changed
    if (body.status && body.status !== existingTask.status) {
      const validTransitions: Record<string, string[]> = {
        pending: ['in_progress', 'completed', 'cancelled'],
        in_progress: ['completed', 'pending', 'cancelled'],
        completed: [],
        cancelled: ['pending'],
      };

      if (!validTransitions[existingTask.status]?.includes(body.status)) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_STATUS_TRANSITION', message: `Cannot transition from ${existingTask.status} to ${body.status}` } },
          { status: 400 }
        );
      }
    }

    // Explicit field whitelist to prevent overwriting protected fields (tenantId, createdAt, etc.)
    const allowedFields = ['title', 'description', 'status', 'priority', 'assignedTo', 'deadline', 'propertyId', 'roomId', 'category', 'scheduledAt', 'notes'];
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    // Set completedAt when transitioning to completed
    if (body.status === 'completed' && existingTask.status !== 'completed') {
      updateData.completedAt = new Date();
    }

    const task = await db.task.update({
      where: { id },
      data: updateData,
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
    console.error('Error patching task:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update task' } },
      { status: 500 }
    );
  }
}

// DELETE /api/staff/tasks/[id] - Delete a task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    if (!hasPermission(user, 'tasks.delete') && !hasPermission(user, 'staff.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to delete tasks' } },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Check if task exists and belongs to user's tenant
    const existingTask = await db.task.findUnique({
      where: { id, tenantId: user.tenantId },
    });

    if (!existingTask) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } },
        { status: 404 }
      );
    }

    // Can only delete pending tasks (soft delete by cancelling)
    if (existingTask.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: { code: 'CANNOT_DELETE', message: 'Can only delete pending tasks' } },
        { status: 400 }
      );
    }

    await db.task.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete task' } },
      { status: 500 }
    );
  }
}
