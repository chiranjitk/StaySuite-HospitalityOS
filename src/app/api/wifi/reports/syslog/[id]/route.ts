import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/wifi/reports/syslog/[id] - Get single syslog server configuration
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;

    const server = await db.syslogServer.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!server) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Syslog server not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: server });
  } catch (error) {
    console.error('Error fetching syslog server:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch syslog server' } },
      { status: 500 }
    );
  }
}

// PUT /api/wifi/reports/syslog/[id] - Update syslog server configuration
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.syslogServer.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Syslog server not found' } },
        { status: 404 }
      );
    }

    const {
      name, protocol, host, port, format, facility, severity,
      categories, enabled, tlsCertPath, tlsVerify,
    } = body;

    const server = await db.syslogServer.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(protocol !== undefined && { protocol }),
        ...(host !== undefined && { host }),
        ...(port !== undefined && { port: parseInt(String(port), 10) }),
        ...(format !== undefined && { format }),
        ...(facility !== undefined && { facility }),
        ...(severity !== undefined && { severity }),
        ...(categories !== undefined && { categories: typeof categories === 'string' ? categories : JSON.stringify(categories) }),
        ...(enabled !== undefined && { enabled }),
        ...(tlsCertPath !== undefined && { tlsCertPath }),
        ...(tlsVerify !== undefined && { tlsVerify }),
      },
    });

    // Format the response for the frontend
    let parsedCategories: string[] = [];
    try {
      parsedCategories = JSON.parse(server.categories || '[]');
    } catch { /* ignore */ }

    const formatted = {
      id: server.id,
      name: server.name,
      host: server.host,
      port: server.port,
      protocol: server.protocol,
      format: server.format === 'ietf' ? 'RFC5424' : server.format === 'bsd' ? 'RFC3164' : server.format.toUpperCase(),
      facility: server.facility,
      severity: server.severity,
      categories: parsedCategories,
      status: server.enabled ? 'connected' : 'disconnected',
      tlsVerify: server.tlsVerify,
    };

    return NextResponse.json({ success: true, data: formatted });
  } catch (error) {
    console.error('Error updating syslog server:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update syslog server' } },
      { status: 500 }
    );
  }
}

// DELETE /api/wifi/reports/syslog/[id] - Delete syslog server configuration
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;

    const existing = await db.syslogServer.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Syslog server not found' } },
        { status: 404 }
      );
    }

    await db.syslogServer.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: 'Syslog server configuration deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting syslog server:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete syslog server' } },
      { status: 500 }
    );
  }
}
