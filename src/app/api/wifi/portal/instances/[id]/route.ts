import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/wifi/portal/instances/[id] - Get single portal instance
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;

    const instance = await db.captivePortal.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        property: {
          select: { id: true, name: true },
        },
        portalMappings: {
          orderBy: { priority: 'desc' },
        },
        authMethods: {
          where: { enabled: true },
          orderBy: { priority: 'asc' },
        },
        portalPages: true,
      },
    });

    if (!instance) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Portal instance not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: instance });
  } catch (error) {
    console.error('Error fetching portal instance:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch portal instance' } },
      { status: 500 }
    );
  }
}

// PUT /api/wifi/portal/instances/[id] - Update portal instance
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.captivePortal.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Portal instance not found' } },
        { status: 404 }
      );
    }

    const {
      name, description, listenIp, listenPort, useSsl,
      sslCertPath, sslKeyPath, enabled, maxConcurrent,
      sessionTimeout, idleTimeout, redirectUrl,
      successMessage, failMessage,
    } = body;

    const instance = await db.captivePortal.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(listenIp !== undefined && { listenIp }),
        ...(listenPort !== undefined && { listenPort: parseInt(listenPort, 10) }),
        ...(useSsl !== undefined && { useSsl }),
        ...(sslCertPath !== undefined && { sslCertPath }),
        ...(sslKeyPath !== undefined && { sslKeyPath }),
        ...(enabled !== undefined && { enabled }),
        ...(maxConcurrent !== undefined && { maxConcurrent: parseInt(maxConcurrent, 10) }),
        ...(sessionTimeout !== undefined && { sessionTimeout: parseInt(sessionTimeout, 10) }),
        ...(idleTimeout !== undefined && { idleTimeout: parseInt(idleTimeout, 10) }),
        ...(redirectUrl !== undefined && { redirectUrl }),
        ...(successMessage !== undefined && { successMessage }),
        ...(failMessage !== undefined && { failMessage }),
      },
    });

    return NextResponse.json({ success: true, data: instance });
  } catch (error) {
    console.error('Error updating portal instance:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update portal instance' } },
      { status: 500 }
    );
  }
}

// DELETE /api/wifi/portal/instances/[id] - Delete portal instance
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;

    const existing = await db.captivePortal.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        _count: {
          select: {
            portalMappings: true,
            authMethods: true,
            portalPages: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Portal instance not found' } },
        { status: 404 }
      );
    }

    // Check for associated resources
    const hasAssociations = existing._count.portalMappings > 0
      || existing._count.authMethods > 0
      || existing._count.portalPages > 0;

    if (hasAssociations) {
      // Disable instead of deleting
      await db.captivePortal.update({
        where: { id },
        data: { enabled: false },
      });

      return NextResponse.json({
        success: true,
        message: 'Portal instance deactivated (has associated mappings, auth methods, or pages)',
      });
    }

    await db.captivePortal.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: 'Portal instance deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting portal instance:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete portal instance' } },
      { status: 500 }
    );
  }
}
