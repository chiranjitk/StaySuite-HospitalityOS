import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/wifi/network/backups - List config backups
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (propertyId) where.propertyId = propertyId;

    const backups = await db.networkConfigBackup.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...(limit && { take: parseInt(limit, 10) }),
      ...(offset && { skip: parseInt(offset, 10) }),
      // Exclude configData from list response for performance
      select: {
        id: true,
        tenantId: true,
        propertyId: true,
        name: true,
        version: true,
        autoBackup: true,
        createdAt: true,
      },
    });

    const total = await db.networkConfigBackup.count({ where });

    return NextResponse.json({
      success: true,
      data: backups,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
    });
  } catch (error) {
    console.error('Error fetching config backups:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch config backups' } },
      { status: 500 }
    );
  }
}

// POST /api/wifi/network/backups - Create a new config backup
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { propertyId, name, configData, autoBackup = false } = body;

    if (!propertyId || !name || !configData) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: propertyId, name, configData' } },
        { status: 400 }
      );
    }

    // Determine the next version number for this property
    const latestBackup = await db.networkConfigBackup.findFirst({
      where: { tenantId: user.tenantId, propertyId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const nextVersion = (latestBackup?.version || 0) + 1;

    const backup = await db.networkConfigBackup.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        name,
        configData: typeof configData === 'string' ? configData : JSON.stringify(configData),
        version: nextVersion,
        autoBackup,
      },
    });

    return NextResponse.json({ success: true, data: backup }, { status: 201 });
  } catch (error) {
    console.error('Error creating config backup:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create config backup' } },
      { status: 500 }
    );
  }
}

// PUT /api/wifi/network/backups - Restore from a backup
export async function PUT(request: NextRequest) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { backupId } = body;

    if (!backupId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: backupId' } },
        { status: 400 }
      );
    }

    const backup = await db.networkConfigBackup.findFirst({
      where: { id: backupId, tenantId: user.tenantId },
    });

    if (!backup) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Config backup not found' } },
        { status: 404 }
      );
    }

    // Return the backup config data so the frontend/gateway can apply it
    // The actual restore logic would be handled by the network gateway
    return NextResponse.json({
      success: true,
      data: {
        id: backup.id,
        name: backup.name,
        version: backup.version,
        propertyId: backup.propertyId,
        configData: backup.configData,
        restoredAt: new Date().toISOString(),
      },
      message: 'Backup data retrieved for restore. Apply to gateway to complete restore.',
    });
  } catch (error) {
    console.error('Error restoring config backup:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to restore config backup' } },
      { status: 500 }
    );
  }
}
