import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/communication/templates - List all message templates
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'communication.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const channel = searchParams.get('channel');
    const category = searchParams.get('category');
    const isQuickReply = searchParams.get('isQuickReply');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = { tenantId: user.tenantId, isActive: true };

    if (channel) {
      where.channel = channel;
    }

    if (category) {
      where.category = category;
    }

    if (isQuickReply !== null && isQuickReply !== undefined) {
      where.isQuickReply = isQuickReply === 'true';
    }

    const templates = await db.messageTemplate.findMany({
      where,
      orderBy: [
        { usageCount: 'desc' },
        { name: 'asc' },
      ],
    });

    // Filter by search if provided
    let filteredTemplates = templates;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredTemplates = templates.filter((template) =>
        template.name.toLowerCase().includes(searchLower) ||
        template.body.toLowerCase().includes(searchLower) ||
        template.category.toLowerCase().includes(searchLower)
      );
    }

    // Parse variables for each template
    const enrichedTemplates = filteredTemplates.map((template) => {
      let variables: string[] = [];
      try {
        variables = template.variables ? JSON.parse(template.variables) : [];
      } catch {
        variables = [];
      }
      return {
        ...template,
        variables,
      };
    });

    // Get template stats
    const stats = {
      total: templates.length,
      byChannel: {
        email: templates.filter((t) => t.channel === 'email').length,
        sms: templates.filter((t) => t.channel === 'sms').length,
        whatsapp: templates.filter((t) => t.channel === 'whatsapp').length,
        all: templates.filter((t) => t.channel === 'all').length,
      },
      byCategory: templates.reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      quickReplies: templates.filter((t) => t.isQuickReply).length,
    };

    return NextResponse.json({
      success: true,
      data: enrichedTemplates,
      stats,
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch templates' } },
      { status: 500 }
    );
  }
}

// POST /api/communication/templates - Create a new template
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'communication.create')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();

    const {
      name,
      category,
      channel,
      subject,
      body: templateBody,
      variables = [],
      isQuickReply = false,
      shortcut,
      whatsappTemplateId,
      whatsappCategory,
    } = body;

    if (!name || !category || !channel || !templateBody) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Name, category, channel, and body are required' } },
        { status: 400 }
      );
    }

    // Check if template with same name and channel exists
    const existingTemplate = await db.messageTemplate.findFirst({
      where: {
        tenantId: user.tenantId,
        name,
        channel,
      },
    });

    if (existingTemplate) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE', message: 'Template with this name already exists for this channel' } },
        { status: 400 }
      );
    }

    const template = await db.messageTemplate.create({
      data: {
        tenantId: user.tenantId,
        name,
        category,
        channel,
        subject,
        body: templateBody,
        variables: JSON.stringify(variables),
        isQuickReply,
        shortcut,
        whatsappTemplateId,
        whatsappCategory,
        isActive: true,
        usageCount: 0,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...template,
        variables,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create template' } },
      { status: 500 }
    );
  }
}

// PUT /api/communication/templates - Update a template
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'communication.update')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      id,
      name,
      category,
      channel,
      subject,
      body: templateBody,
      variables,
      isQuickReply,
      shortcut,
      whatsappTemplateId,
      whatsappCategory,
      isActive,
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Template ID is required' } },
        { status: 400 }
      );
    }

    const existingTemplate = await db.messageTemplate.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (name) updateData.name = name;
    if (category) updateData.category = category;
    if (channel) updateData.channel = channel;
    if (subject !== undefined) updateData.subject = subject;
    if (templateBody) updateData.body = templateBody;
    if (variables) updateData.variables = Array.isArray(variables) ? JSON.stringify(variables) : variables;
    if (isQuickReply !== undefined) updateData.isQuickReply = isQuickReply;
    if (shortcut !== undefined) updateData.shortcut = shortcut;
    if (whatsappTemplateId !== undefined) updateData.whatsappTemplateId = whatsappTemplateId;
    if (whatsappCategory !== undefined) updateData.whatsappCategory = whatsappCategory;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedTemplate = await db.messageTemplate.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...updatedTemplate,
        variables: updatedTemplate.variables ? JSON.parse(updatedTemplate.variables) : [],
      },
    });
  } catch (error) {
    console.error('Error updating template:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update template' } },
      { status: 500 }
    );
  }
}

// DELETE /api/communication/templates - Delete a template
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'communication.delete')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Template ID is required' } },
        { status: 400 }
      );
    }

    const existingTemplate = await db.messageTemplate.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } },
        { status: 404 }
      );
    }

    await db.messageTemplate.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete template' } },
      { status: 500 }
    );
  }
}
