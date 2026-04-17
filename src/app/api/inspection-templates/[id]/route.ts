import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/inspection-templates/[id] - Get single template
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

    const template = await db.inspectionTemplate.findUnique({
      where: { id },
    });

    if (!template || template.tenantId !== currentUser.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: template });
  } catch (error) {
    console.error('Error fetching inspection template:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch inspection template' } },
      { status: 500 }
    );
  }
}

// PUT /api/inspection-templates/[id] - Update template
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
      !hasPermission(currentUser, 'tasks.update') &&
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

    // Verify template exists and belongs to tenant
    const existing = await db.inspectionTemplate.findUnique({
      where: { id },
    });

    if (!existing || existing.tenantId !== currentUser.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } },
        { status: 404 }
      );
    }

    // Whitelist: only allow specific fields
    const allowedFields: Record<string, unknown> = {};
    const {
      name,
      description,
      roomType,
      category,
      items,
      isActive,
      sortOrder,
    } = body;

    if (name !== undefined) allowedFields.name = name;
    if (description !== undefined) allowedFields.description = description;
    if (roomType !== undefined) allowedFields.roomType = roomType || null;
    if (category !== undefined) allowedFields.category = category;
    if (isActive !== undefined) allowedFields.isActive = isActive;
    if (sortOrder !== undefined) allowedFields.sortOrder = sortOrder;

    // Validate items if provided
    if (items !== undefined) {
      if (!Array.isArray(items)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'items must be an array' } },
          { status: 400 }
        );
      }
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.id || !item.name || item.required === undefined || item.sortOrder === undefined) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: `items[${i}] is missing required fields: id, name, required, sortOrder` } },
            { status: 400 }
          );
        }
      }
      allowedFields.items = JSON.stringify(items);
    }

    const template = await db.inspectionTemplate.update({
      where: { id },
      data: allowedFields,
    });

    return NextResponse.json({ success: true, data: template });
  } catch (error) {
    console.error('Error updating inspection template:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update inspection template' } },
      { status: 500 }
    );
  }
}

// DELETE /api/inspection-templates/[id] - Delete template
export async function DELETE(
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
      !hasPermission(currentUser, 'tasks.delete') &&
      !hasPermission(currentUser, 'tasks.*') &&
      currentUser.roleName !== 'admin'
    ) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Verify template exists and belongs to tenant
    const existing = await db.inspectionTemplate.findUnique({
      where: { id },
    });

    if (!existing || existing.tenantId !== currentUser.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } },
        { status: 404 }
      );
    }

    // Check if any inspection results reference this template
    const resultCount = await db.inspectionResult.count({
      where: { templateId: id },
    });

    if (resultCount > 0) {
      // Soft delete - just deactivate
      const template = await db.inspectionTemplate.update({
        where: { id },
        data: { isActive: false },
      });

      return NextResponse.json({
        success: true,
        data: template,
        message: `Template soft-deleted (${resultCount} inspection results reference it). Set isActive to false.`,
      });
    }

    // Hard delete - no results reference it
    await db.inspectionTemplate.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      data: { id },
      message: 'Template permanently deleted',
    });
  } catch (error) {
    console.error('Error deleting inspection template:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete inspection template' } },
      { status: 500 }
    );
  }
}
