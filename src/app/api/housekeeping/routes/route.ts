/**
 * Housekeeping Routes API
 * 
 * GET: Get optimal routes for staff
 * Minimize travel time between rooms
 * Zone-based assignment
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { taskOptimizationService, RouteOptimization } from '@/lib/services/task-optimization-service';

// GET /api/housekeeping/routes - Get optimal routes for staff
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      }, { status: 401 });
    }

    // Permission check
    if (!hasPermission(user, 'housekeeping.view') && !hasPermission(user, 'tasks.view')) {
      return NextResponse.json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have permission to view routes' },
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const dateStr = searchParams.get('date');
    const userIdFilter = searchParams.get('userId');

    if (!propertyId) {
      return NextResponse.json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Property ID is required' },
      }, { status: 400 });
    }

    // Verify property belongs to user's tenant
    const property = await db.property.findUnique({
      where: { id: propertyId, tenantId: user.tenantId },
      select: { id: true },
    });

    if (!property) {
      return NextResponse.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Property not found or does not belong to your tenant' },
      }, { status: 404 });
    }

    // Parse date or use today
    const date = dateStr ? new Date(dateStr) : new Date();

    // Get optimal routes using authenticated user's tenant
    const routes = await taskOptimizationService.getOptimalRoutes(
      user.tenantId,
      propertyId,
      date
    );

    // Filter by user if specified
    const filteredRoutes = userIdFilter 
      ? routes.filter(r => r.userId === userIdFilter)
      : routes;

    // Calculate summary statistics
    const summary = {
      totalStaff: filteredRoutes.length,
      totalTasks: filteredRoutes.reduce((sum, r) => sum + r.tasks.length, 0),
      totalDistance: filteredRoutes.reduce((sum, r) => sum + r.totalDistance, 0),
      totalMinutes: filteredRoutes.reduce((sum, r) => sum + r.totalMinutes, 0),
      averageTasksPerStaff: filteredRoutes.length > 0
        ? Math.round(filteredRoutes.reduce((sum, r) => sum + r.tasks.length, 0) / filteredRoutes.length)
        : 0,
      zonesCovered: [...new Set(filteredRoutes.flatMap(r => r.zones))],
    };

    return NextResponse.json({
      success: true,
      data: {
        routes: filteredRoutes,
        summary,
      },
    });
  } catch (error) {
    console.error('Error in routes GET:', error);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get optimal routes' },
    }, { status: 500 });
  }
}

// POST /api/housekeeping/routes - Recalculate/reorder routes
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      }, { status: 401 });
    }

    // Permission check
    if (!hasPermission(user, 'housekeeping.manage') && !hasPermission(user, 'tasks.manage')) {
      return NextResponse.json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have permission to manage routes' },
      }, { status: 403 });
    }

    const body = await request.json();
    const { propertyId, userIds, prioritizeBy } = body;

    if (!propertyId) {
      return NextResponse.json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Property ID is required' },
      }, { status: 400 });
    }

    // Verify property belongs to user's tenant
    const property = await db.property.findUnique({
      where: { id: propertyId, tenantId: user.tenantId },
      select: { id: true },
    });

    if (!property) {
      return NextResponse.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Property not found or does not belong to your tenant' },
      }, { status: 404 });
    }

    // Get routes using authenticated user's tenant
    const routes = await taskOptimizationService.getOptimalRoutes(
      user.tenantId,
      propertyId,
      new Date()
    );

    // Filter by user IDs if specified
    const filteredRoutes = userIds 
      ? routes.filter(r => userIds.includes(r.userId))
      : routes;

    // Reorder tasks based on priority criteria
    if (prioritizeBy) {
      for (const route of filteredRoutes) {
        await reorderRouteTasks(route, prioritizeBy, user.tenantId);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        routes: filteredRoutes,
        message: prioritizeBy 
          ? `Routes reordered by ${prioritizeBy}` 
          : 'Routes calculated successfully',
      },
    });
  } catch (error) {
    console.error('Error in routes POST:', error);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to recalculate routes' },
    }, { status: 500 });
  }
}

// Helper to reorder tasks based on priority criteria
async function reorderRouteTasks(
  route: RouteOptimization,
  prioritizeBy: string,
  tenantId: string
): Promise<void> {
  const taskIds = route.tasks.map(t => t.id);

  // Get task details with tenant scoping
  const tasks = await db.task.findMany({
    where: {
      id: { in: taskIds },
      tenantId, // Tenant scoping
    },
    select: {
      id: true,
      priority: true,
      scheduledAt: true,
      room: { select: { floor: true } },
    },
  });

  // Create a map for quick lookup
  const taskMap = new Map(tasks.map(t => [t.id, t]));

  // Sort based on priority criteria
  let sortedTaskIds: string[];
  
  switch (prioritizeBy) {
    case 'priority':
      // Sort by priority (urgent first)
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      sortedTaskIds = [...taskIds].sort((a, b) => {
        const taskA = taskMap.get(a);
        const taskB = taskMap.get(b);
        const orderA = taskA?.priority ? priorityOrder[taskA.priority as keyof typeof priorityOrder] ?? 4 : 4;
        const orderB = taskB?.priority ? priorityOrder[taskB.priority as keyof typeof priorityOrder] ?? 4 : 4;
        return orderA - orderB;
      });
      break;

    case 'floor':
      // Sort by floor (lowest first)
      sortedTaskIds = [...taskIds].sort((a, b) => {
        const taskA = taskMap.get(a);
        const taskB = taskMap.get(b);
        const floorA = taskA?.room?.floor || 0;
        const floorB = taskB?.room?.floor || 0;
        return floorA - floorB;
      });
      break;

    case 'scheduled':
      // Sort by scheduled time
      sortedTaskIds = [...taskIds].sort((a, b) => {
        const taskA = taskMap.get(a);
        const taskB = taskMap.get(b);
        const timeA = taskA?.scheduledAt?.getTime() || 0;
        const timeB = taskB?.scheduledAt?.getTime() || 0;
        return timeA - timeB;
      });
      break;

    default:
      return; // No reordering needed
  }

  // Update task scheduled times based on new order
  const now = new Date();
  let currentTime = now;

  for (let i = 0; i < sortedTaskIds.length; i++) {
    const taskId = sortedTaskIds[i];
    const routeTask = route.tasks.find(t => t.id === taskId);
    
    if (routeTask) {
      // Schedule tasks sequentially
      await db.task.update({
        where: { id: taskId },
        data: {
          scheduledAt: currentTime,
        },
      });

      // Add estimated duration for next task
      currentTime = new Date(currentTime.getTime() + routeTask.estimatedMinutes * 60000);
    }
  }
}
