import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { completeCleaningAndInspect, inspectAndReleaseRoom } from '@/lib/housekeeping-automation';

// GET /api/tasks/[id] - Get a single task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    // RBAC check
    if (!hasPermission(user, 'tasks.view') && !hasPermission(user, 'tasks.*') && !hasPermission(user, 'housekeeping.view')) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { id } = await params;

    const task = await db.task.findUnique({
      where: { id },
      include: {
        room: {
          select: {
            id: true,
            number: true,
            floor: true,
            status: true,
            propertyId: true,
            roomType: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            property: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatar: true,
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

    // Tenant isolation
    if (task.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: task,
    });
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch task' } },
      { status: 500 }
    );
  }
}

// PUT /api/tasks/[id] - Update a task
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }
    if (!hasPermission(user, 'tasks.manage') && !hasPermission(user, 'tasks.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const existingTask = await db.task.findUnique({
      where: { id },
      include: {
        room: true,
      },
    });

    if (!existingTask) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } },
        { status: 404 }
      );
    }

    // Tenant isolation
    if (existingTask.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 });
    }

    const {
      roomId,
      assignedTo,
      type,
      category,
      title,
      description,
      priority,
      status,
      scheduledAt,
      startedAt,
      completedAt,
      estimatedDuration,
      actualDuration,
      roomStatusAfter,
      notes,
      completionNotes,
      attachments,
      isRecurring,
      recurrenceRule,
    } = body;

    // If assigned to a user, verify they exist and belong to housekeeping
    if (assignedTo) {
      const assignedUser = await db.user.findUnique({
        where: { id: assignedTo, deletedAt: null },
        include: {
          role: {
            select: { name: true, permissions: true },
          },
        },
      });

      if (!assignedUser) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_USER', message: 'Assigned user not found' } },
          { status: 400 }
        );
      }

      // Verify the user has housekeeping-related role or permissions
      let isHousekeepingStaff = assignedUser.role?.name === 'housekeeping';
      if (!isHousekeepingStaff && assignedUser.role?.permissions) {
        try {
          const perms: string[] = JSON.parse(assignedUser.role.permissions);
          isHousekeepingStaff =
            perms.includes('*') ||
            perms.includes('tasks.*') ||
            perms.includes('housekeeping.*') ||
            perms.some((p) => p.startsWith('tasks.') || p.startsWith('housekeeping.'));
        } catch {
          // ignore parse errors
        }
      }

      if (!isHousekeepingStaff) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_ASSIGNEE', message: 'Task can only be assigned to housekeeping staff' } },
          { status: 400 }
        );
      }
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

    const task = await db.$transaction(async (tx) => {
      const updatedTask = await tx.task.update({
        where: { id },
        data: {
          ...(roomId !== undefined && { roomId }),
          ...(assignedTo !== undefined && { assignedTo }),
          ...(type && { type }),
          ...(category && { category }),
          ...(title && { title }),
          ...(description !== undefined && { description }),
          ...(priority && { priority }),
          ...(status && { status }),
          ...(scheduledAt !== undefined && { scheduledAt: scheduledAt ? new Date(scheduledAt) : null }),
          ...(startedAt !== undefined && { startedAt: startedAt ? new Date(startedAt) : null }),
          ...(completedAt !== undefined && { completedAt: completedAt ? new Date(completedAt) : null }),
          ...(estimatedDuration !== undefined && { estimatedDuration }),
          ...(actualDuration !== undefined && { actualDuration }),
          ...(roomStatusAfter !== undefined && { roomStatusAfter }),
          ...(notes !== undefined && { notes }),
          ...(completionNotes !== undefined && { completionNotes }),
          ...(attachments !== undefined && { attachments }),
          ...(isRecurring !== undefined && { isRecurring }),
          ...(recurrenceRule !== undefined && { recurrenceRule }),
        },
        include: {
          room: {
            select: {
              id: true,
              number: true,
              floor: true,
              status: true,
            },
          },
          assignee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
      });

      return updatedTask;
    });

    // Handle housekeeping lifecycle after task completion
    if (status === 'completed' && existingTask.status !== 'completed') {
      const effectiveType = type || existingTask.type;
      const effectiveRoomId = roomId || existingTask.roomId;

      if (effectiveRoomId) {
        try {
          if (effectiveType === 'cleaning') {
            // Cleaning completed → mark room as inspected, ready for inspection
            await completeCleaningAndInspect(effectiveRoomId, id, user.id);
          } else if (effectiveType === 'inspection') {
            // Inspection completed → mark room as clean and available
            await inspectAndReleaseRoom(effectiveRoomId, user.id);
          }
        } catch (hkError) {
          console.error('Failed to process housekeeping lifecycle on task completion:', hkError);
          // Don't fail the task completion if housekeeping lifecycle fails
        }
      }
    }

    return NextResponse.json({ success: true, data: task });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update task' } },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/[id] - Cancel a task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }
    if (!hasPermission(user, 'tasks.manage') && !hasPermission(user, 'tasks.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { id } = await params;

    const existingTask = await db.task.findUnique({
      where: { id },
    });

    if (!existingTask) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } },
        { status: 404 }
      );
    }

    // Tenant isolation
    if (existingTask.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 });
    }

    // Can only cancel pending or in_progress tasks
    if (!['pending', 'in_progress'].includes(existingTask.status)) {
      return NextResponse.json(
        { success: false, error: { code: 'CANNOT_DELETE', message: 'Can only cancel pending or in-progress tasks' } },
        { status: 400 }
      );
    }

    // Cancel the task
    const task = await db.task.update({
      where: { id },
      data: {
        status: 'cancelled',
        completionNotes: 'Task cancelled',
      },
    });

    return NextResponse.json({
      success: true,
      data: task,
      message: 'Task cancelled successfully',
    });
  } catch (error) {
    console.error('Error cancelling task:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel task' } },
      { status: 500 }
    );
  }
}
