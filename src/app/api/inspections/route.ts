import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { processInspectionResult } from '@/lib/inspection-engine';

// GET /api/inspections - List inspection results
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // RBAC check
    if (
      !hasPermission(currentUser, 'tasks.view') &&
      !hasPermission(currentUser, 'tasks.*') &&
      !hasPermission(currentUser, 'housekeeping.view')
    ) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const roomId = searchParams.get('roomId');
    const inspectorId = searchParams.get('inspectorId');
    const templateId = searchParams.get('templateId');
    const passed = searchParams.get('passed');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // Build where clause - always scoped to tenant
    const where: Record<string, unknown> = {
      tenantId: currentUser.tenantId,
    };

    if (propertyId) where.propertyId = propertyId;
    if (roomId) where.roomId = roomId;
    if (inspectorId) where.inspectorId = inspectorId;
    if (templateId) where.templateId = templateId;

    if (passed !== null && passed !== undefined && passed !== '') {
      where.passed = passed === 'true';
    }

    if (dateFrom || dateTo) {
      where.completedAt = {};
      if (dateFrom) {
        (where.completedAt as Record<string, unknown>).gte = new Date(dateFrom);
      }
      if (dateTo) {
        (where.completedAt as Record<string, unknown>).lte = new Date(dateTo);
      }
    }

    const skip = (page - 1) * limit;

    const [inspections, total] = await Promise.all([
      db.inspectionResult.findMany({
        where,
        include: {
          template: {
            select: {
              id: true,
              name: true,
              category: true,
            },
          },
        },
        orderBy: { completedAt: 'desc' },
        skip,
        take: limit,
      }),
      db.inspectionResult.count({ where }),
    ]);

    // Fetch room info for all inspections (batch)
    const roomIds = [...new Set(inspections.map((i) => i.roomId))];
    const rooms = await db.room.findMany({
      where: {
        id: { in: roomIds },
      },
      select: {
        id: true,
        number: true,
        roomType: {
          select: { id: true, name: true },
        },
        floor: true,
      },
    });
    const roomMap = new Map(rooms.map((r) => [r.id, r]));

    // Attach room info to inspections
    const enrichedInspections = inspections.map((inspection) => ({
      ...inspection,
      room: roomMap.get(inspection.roomId) || null,
    }));

    // Calculate stats
    const statsWhere: Record<string, unknown> = {
      tenantId: currentUser.tenantId,
      ...Object.fromEntries(
        Object.entries(where).filter(([key]) =>
          ['propertyId', 'roomId', 'inspectorId', 'templateId', 'passed'].includes(key)
        )
      ),
    };

    // Copy date range if present
    if (where.completedAt) {
      statsWhere.completedAt = where.completedAt;
    }

    const [totalInspections, passedCount, failedCount, avgScoreResult] =
      await Promise.all([
        db.inspectionResult.count({ where: statsWhere }),
        db.inspectionResult.count({
          where: { ...statsWhere, passed: true },
        }),
        db.inspectionResult.count({
          where: { ...statsWhere, passed: false },
        }),
        db.inspectionResult.aggregate({
          where: statsWhere,
          _avg: { score: true },
        }),
      ]);

    return NextResponse.json({
      success: true,
      data: enrichedInspections,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        total: totalInspections,
        passed: passedCount,
        failed: failedCount,
        avgScore: avgScoreResult._avg.score
          ? Math.round(avgScoreResult._avg.score)
          : 0,
      },
    });
  } catch (error) {
    console.error('Error fetching inspections:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch inspections' } },
      { status: 500 }
    );
  }
}

// POST /api/inspections - Create inspection result
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // RBAC check
    if (
      !hasPermission(currentUser, 'tasks.manage') &&
      !hasPermission(currentUser, 'tasks.*') &&
      currentUser.roleName !== 'admin'
    ) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      propertyId,
      roomId,
      taskId,
      templateId,
      items,
      notes,
    } = body;

    // Validate required fields
    if (!propertyId || !roomId || !templateId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: propertyId, roomId, templateId' } },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'items must be a non-empty array' } },
        { status: 400 }
      );
    }

    // Validate each item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.templateItemId || !item.name || typeof item.passed !== 'boolean') {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: `items[${i}] is missing required fields: templateItemId, name, passed (boolean)` } },
          { status: 400 }
        );
      }
    }

    // If taskId provided, verify it exists and belongs to tenant
    if (taskId) {
      const task = await db.task.findUnique({
        where: { id: taskId },
      });
      if (!task || task.tenantId !== currentUser.tenantId) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_TASK', message: 'Task not found or not owned by tenant' } },
          { status: 400 }
        );
      }
    }

    // Look up the template to get required field info for each item
    const template = await db.inspectionTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template || template.tenantId !== currentUser.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TEMPLATE', message: 'Template not found or not owned by tenant' } },
        { status: 400 }
      );
    }

    // Parse template items to get `required` flag per item
    let templateItems: Array<{ id: string; required: boolean }> = [];
    try {
      templateItems = JSON.parse(template.items);
    } catch {
      templateItems = [];
    }

    const templateItemMap = new Map(
      templateItems.map((ti) => [ti.id, ti.required])
    );

    // Merge `required` from template into inspection items
    const mergedItems = items.map((item: Record<string, unknown>) => ({
      templateItemId: item.templateItemId as string,
      name: item.name as string,
      passed: item.passed as boolean,
      required: templateItemMap.get(item.templateItemId as string) ?? true,
      notes: (item.notes as string) || undefined,
      photoUrl: (item.photoUrl as string) || undefined,
    }));

    // Process the inspection result
    const result = await processInspectionResult({
      tenantId: currentUser.tenantId,
      propertyId,
      roomId,
      taskId,
      templateId,
      inspectorId: currentUser.id,
      items: mergedItems,
      notes,
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating inspection result:', error);
    const message = error instanceof Error ? error.message : 'Failed to create inspection result';

    if (
      message === 'TEMPLATE_NOT_FOUND' ||
      message === 'ROOM_NOT_FOUND'
    ) {
      return NextResponse.json(
        { success: false, error: { code: message, message: message.replace(/_/g, ' ').toLowerCase() } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create inspection result' } },
      { status: 500 }
    );
  }
}
