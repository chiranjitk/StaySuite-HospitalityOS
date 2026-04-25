/**
 * Housekeeping Workload API
 * 
 * GET: Get workload distribution
 * POST: Rebalance workload
 * PUT: Update staff capacity
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { taskOptimizationService } from '@/lib/services/task-optimization-service';

// GET /api/housekeeping/workload - Get workload distribution
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
    if (!hasPermission(user, 'housekeeping.view') && !hasPermission(user, 'staff.view')) {
      return NextResponse.json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have permission to view workload' },
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId') || undefined;
    const dateStr = searchParams.get('date');

    // Parse date or use today
    const date = dateStr ? new Date(dateStr) : new Date();

    // Use authenticated user's tenant
    const tenantId = user.tenantId;

    // Get workload distribution
    const distribution = await taskOptimizationService.getWorkloadDistribution(
      tenantId,
      propertyId,
      date
    );

    // Calculate summary statistics
    const summary = {
      totalStaff: distribution.length,
      totalTasks: distribution.reduce((sum, d) => sum + d.totalTasks, 0),
      totalMinutes: distribution.reduce((sum, d) => sum + d.totalMinutes, 0),
      averageUtilization: distribution.length > 0
        ? Math.round(distribution.reduce((sum, d) => sum + d.utilization, 0) / distribution.length)
        : 0,
      overloadedStaff: distribution.filter(d => d.utilization > 90).length,
      underloadedStaff: distribution.filter(d => d.utilization < 30).length,
      balancedStaff: distribution.filter(d => d.utilization >= 30 && d.utilization <= 90).length,
    };

    // Get unassigned tasks count
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const unassignedTasks = await db.task.count({
      where: {
        tenantId,
        propertyId: propertyId || undefined,
        assignedTo: null,
        scheduledAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: 'pending',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        distribution,
        summary: {
          ...summary,
          unassignedTasks,
        },
      },
    });
  } catch (error) {
    console.error('Error in workload GET:', error);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get workload distribution' },
    }, { status: 500 });
  }
}

// POST /api/housekeeping/workload - Rebalance workload
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
    if (!hasPermission(user, 'housekeeping.manage') && !hasPermission(user, 'staff.manage')) {
      return NextResponse.json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have permission to rebalance workload' },
      }, { status: 403 });
    }

    const body = await request.json();
    const { propertyId, maxUtilization, minUtilization } = body;

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

    // Rebalance workload
    const result = await taskOptimizationService.rebalanceWorkload(
      user.tenantId,
      propertyId,
      { maxUtilization, minUtilization }
    );

    // Get updated distribution
    const distribution = await taskOptimizationService.getWorkloadDistribution(
      user.tenantId,
      propertyId
    );

    return NextResponse.json({
      success: true,
      data: {
        rebalanced: result.rebalanced,
        changes: result.changes,
        distribution,
        message: result.rebalanced > 0
          ? `Rebalanced ${result.rebalanced} tasks`
          : 'No rebalancing needed',
      },
    });
  } catch (error) {
    console.error('Error in workload POST:', error);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to rebalance workload' },
    }, { status: 500 });
  }
}

// PUT /api/housekeeping/workload - Update staff capacity
export async function PUT(request: NextRequest) {
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
    if (!hasPermission(user, 'housekeeping.manage') && !hasPermission(user, 'staff.manage')) {
      return NextResponse.json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have permission to update staff capacity' },
      }, { status: 403 });
    }

    const body = await request.json();
    const { userId, capacityMinutes, date } = body;

    if (!userId || !capacityMinutes) {
      return NextResponse.json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'User ID and capacity minutes are required' },
      }, { status: 400 });
    }

    // Validate capacity
    if (capacityMinutes < 0 || capacityMinutes > 1440) {
      return NextResponse.json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Capacity must be between 0 and 1440 minutes (24 hours)' },
      }, { status: 400 });
    }

    // Verify user belongs to same tenant
    const targetUser = await db.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: { tenantId: true },
    });

    if (!targetUser || targetUser.tenantId !== user.tenantId) {
      return NextResponse.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found or does not belong to your tenant' },
      }, { status: 404 });
    }

    // Update staff capacity
    await taskOptimizationService.updateStaffCapacity(
      user.tenantId,
      userId,
      date ? new Date(date) : new Date(),
      capacityMinutes
    );

    // Get updated workload
    const distribution = await taskOptimizationService.getWorkloadDistribution(
      user.tenantId,
      undefined,
      date ? new Date(date) : new Date()
    );

    const updatedUser = distribution.find(d => d.userId === userId);

    return NextResponse.json({
      success: true,
      data: {
        userId,
        capacityMinutes,
        updatedWorkload: updatedUser || null,
        message: `Updated capacity to ${capacityMinutes} minutes`,
      },
    });
  } catch (error) {
    console.error('Error in workload PUT:', error);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update staff capacity' },
    }, { status: 500 });
  }
}
