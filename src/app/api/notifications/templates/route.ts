import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET - List notification templates
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'notifications.view')) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const category = searchParams.get('category');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
    };

    if (type) {
      where.type = type;
    }

    const templates = await db.notificationTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    // Count usage per template from NotificationLog
    const templateIds = templates.map(t => t.id);
    const usageCounts = await db.notificationLog.groupBy({
      by: ['templateId'],
      where: { templateId: { in: templateIds } },
      _count: true,
    });
    const usageCountMap = new Map(
      usageCounts.filter(u => u.templateId).map(u => [u.templateId, u._count])
    );

    // Filter by category (stored in triggerEvent) if provided
    let filtered = templates;
    if (category) {
      filtered = templates.filter((t) => {
        const vars = JSON.parse(t.variables || '[]');
        return vars.includes(category) || t.triggerEvent?.includes(category);
      });
    }

    const result = filtered.map((t) => ({
      id: t.id,
      name: t.name,
      type: t.type as 'email' | 'sms' | 'push' | 'in_app',
      category: t.triggerEvent?.split('.')[0] || 'booking',
      subject: t.subject || undefined,
      body: t.body,
      variables: JSON.parse(t.variables || '[]'),
      status: t.isActive ? 'active' : 'inactive',
      lastModified: t.updatedAt.toISOString(),
      usageCount: usageCountMap.get(t.id) || 0,
      tenantId: t.tenantId,
    }));

    return NextResponse.json({
      success: true,
      data: {
        templates: result,
        stats: {
          total: templates.length,
          active: templates.filter((t) => t.isActive).length,
          emailTemplates: templates.filter((t) => t.type === 'email').length,
          totalSent: usageCounts.reduce((sum, u) => sum + u._count, 0),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching notification templates:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notification templates' },
      { status: 500 }
    );
  }
}

// POST - Create notification template
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'notifications.manage')) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      name,
      type,
      category,
      subject,
      body: templateBody,
      variables,
      status,
    } = body;

    // Validate required fields
    if (!name || !type || !templateBody) {
      return NextResponse.json(
        { success: false, error: 'Name, type, and body are required' },
        { status: 400 }
      );
    }

    // Check for duplicate name
    const existingTemplate = await db.notificationTemplate.findFirst({
      where: { tenantId: user.tenantId, name },
    });

    if (existingTemplate) {
      return NextResponse.json(
        { success: false, error: 'Template with this name already exists' },
        { status: 400 }
      );
    }

    const template = await db.notificationTemplate.create({
      data: {
        tenantId: user.tenantId,
        name,
        type,
        triggerEvent: category || 'general',
        subject: subject || null,
        body: templateBody,
        variables: JSON.stringify(variables || []),
        isActive: status === 'active',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: template.id,
        name: template.name,
        type: template.type,
        category: template.triggerEvent,
        subject: template.subject || undefined,
        body: template.body,
        variables: JSON.parse(template.variables || '[]'),
        status: template.isActive ? 'active' : 'inactive',
        lastModified: template.updatedAt.toISOString(),
        usageCount: 0,
        tenantId: template.tenantId,
      },
      message: 'Notification template created successfully',
    });
  } catch (error) {
    console.error('Error creating notification template:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create notification template' },
      { status: 500 }
    );
  }
}

// PUT - Update notification template
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'notifications.manage')) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Template ID is required' },
        { status: 400 }
      );
    }

    const existing = await db.notificationTemplate.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Notification template not found' },
        { status: 404 }
      );
    }

    const template = await db.notificationTemplate.update({
      where: { id },
      data: {
        name: updates.name || existing.name,
        type: updates.type || existing.type,
        triggerEvent: updates.category || existing.triggerEvent,
        subject: updates.subject !== undefined ? updates.subject : existing.subject,
        body: updates.body || existing.body,
        variables: updates.variables ? JSON.stringify(updates.variables) : existing.variables,
        isActive: updates.status ? updates.status === 'active' : existing.isActive,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: template.id,
        name: template.name,
        type: template.type,
        category: template.triggerEvent,
        subject: template.subject || undefined,
        body: template.body,
        variables: JSON.parse(template.variables || '[]'),
        status: template.isActive ? 'active' : 'inactive',
        lastModified: template.updatedAt.toISOString(),
        usageCount: 0,
      },
      message: 'Notification template updated successfully',
    });
  } catch (error) {
    console.error('Error updating notification template:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update notification template' },
      { status: 500 }
    );
  }
}

// DELETE - Delete notification template
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'notifications.manage')) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Template ID is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const existing = await db.notificationTemplate.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Notification template not found' },
        { status: 404 }
      );
    }

    await db.notificationTemplate.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Notification template deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting notification template:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete notification template' },
      { status: 500 }
    );
  }
}
