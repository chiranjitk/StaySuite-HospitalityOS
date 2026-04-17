import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/inspections/[id] - Get single inspection result
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const result = await db.inspectionResult.findUnique({
      where: { id },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            category: true,
            items: true,
          },
        },
      },
    });

    if (!result || result.tenantId !== currentUser.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Inspection result not found' } },
        { status: 404 }
      );
    }

    // Fetch room info
    const room = await db.room.findUnique({
      where: { id: result.roomId },
      select: {
        id: true,
        number: true,
        floor: true,
        housekeepingStatus: true,
        roomType: {
          select: { id: true, name: true },
        },
      },
    });

    // Fetch inspector info
    const inspector = await db.user.findUnique({
      where: { id: result.inspectorId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatar: true,
        jobTitle: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        room,
        inspector,
      },
    });
  } catch (error) {
    console.error('Error fetching inspection result:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch inspection result' } },
      { status: 500 }
    );
  }
}

// PUT /api/inspections/[id] - Update inspection result
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await request.json();

    // Verify result exists and belongs to tenant
    const existing = await db.inspectionResult.findUnique({
      where: { id },
    });

    if (!existing || existing.tenantId !== currentUser.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Inspection result not found' } },
        { status: 404 }
      );
    }

    // Whitelist: only allow notes and reAssigned
    const data: Record<string, unknown> = {};
    const { notes, reAssigned } = body;

    if (notes !== undefined) data.notes = notes;
    if (reAssigned !== undefined) data.reAssigned = reAssigned;

    const result = await db.inspectionResult.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error updating inspection result:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update inspection result' } },
      { status: 500 }
    );
  }
}
