import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// Valid camera statuses
const VALID_CAMERA_STATUSES = ['online', 'offline', 'maintenance'];
const VALID_STREAM_TYPES = ['rtsp', 'rtmp', 'hls', 'webrtc', 'onvif'];

// GET /api/security/cameras - List all cameras
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Check permission
    if (!hasPermission(user, 'security.view') && !hasPermission(user, 'security.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status');

    // Validate status filter
    if (status && !VALID_CAMERA_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: 'Invalid status filter' } },
        { status: 400 }
      );
    }

    // Build where clause for properties - only user's tenant
    const propertyWhere: Prisma.PropertyWhereInput = {
      tenantId: user.tenantId,
      status: 'active',
    };

    // Get properties first
    const properties = await db.property.findMany({
      where: propertyWhere,
      select: { id: true, name: true },
    });

    const propertyIds = propertyId ? [propertyId] : properties.map(p => p.id);

    // Validate propertyId if specified
    if (propertyId && !propertyIds.includes(propertyId)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PROPERTY', message: 'Property not found or access denied' } },
        { status: 400 }
      );
    }

    // Build camera where clause
    const cameraWhere: Prisma.CameraWhereInput = {
      propertyId: { in: propertyIds },
      ...(status && { status }),
    };

    const [cameras, groups] = await Promise.all([
      db.camera.findMany({
        where: cameraWhere,
        include: {
          group: {
            select: { id: true, name: true },
          },
          property: {
            select: { id: true, name: true },
          },
        },
        orderBy: { name: 'asc' },
      }),
      db.cameraGroup.findMany({
        where: { propertyId: { in: propertyIds } },
        select: { id: true, name: true },
      }),
    ]);

    // Calculate stats
    const stats = {
      total: cameras.length,
      online: cameras.filter(c => c.status === 'online').length,
      offline: cameras.filter(c => c.status === 'offline').length,
      maintenance: cameras.filter(c => c.status === 'maintenance').length,
      recording: cameras.filter(c => c.isRecording).length,
    };

    return NextResponse.json({
      success: true,
      data: {
        cameras: cameras.map(c => ({
          id: c.id,
          name: c.name,
          location: c.location || '',
          status: c.status,
          isRecording: c.isRecording,
          streamUrl: c.streamUrl || undefined,
          streamType: c.streamType,
          groupId: c.groupId,
          groupName: c.group?.name || null,
          posX: c.posX,
          posY: c.posY,
          propertyId: c.propertyId,
          propertyName: c.property?.name,
        })),
        groups: groups.map(g => ({
          id: g.id,
          name: g.name,
        })),
        stats,
        properties: properties,
      },
    });
  } catch (error) {
    console.error('Error fetching cameras:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch cameras' } },
      { status: 500 }
    );
  }
}

// POST /api/security/cameras - Create a new camera
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Check permission
    if (!hasPermission(user, 'security.create') && !hasPermission(user, 'security.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      propertyId,
      name,
      location,
      streamUrl,
      streamType = 'rtsp',
      groupId,
    } = body;

    // Validation
    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Property ID is required' } },
        { status: 400 }
      );
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Camera name is required' } },
        { status: 400 }
      );
    }

    // Validate stream type
    if (streamType && !VALID_STREAM_TYPES.includes(streamType)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid stream type. Must be one of: ${VALID_STREAM_TYPES.join(', ')}` } },
        { status: 400 }
      );
    }

    // Verify property belongs to user's tenant
    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId: user.tenantId, status: 'active' },
    });

    if (!property) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PROPERTY', message: 'Property not found or access denied' } },
        { status: 400 }
      );
    }

    // Validate group belongs to property if specified
    if (groupId) {
      const group = await db.cameraGroup.findFirst({
        where: { id: groupId, propertyId },
      });
      if (!group) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_GROUP', message: 'Camera group not found or does not belong to property' } },
          { status: 400 }
        );
      }
    }

    const camera = await db.camera.create({
      data: {
        propertyId,
        name: name.trim(),
        location: location?.trim() || null,
        streamUrl: streamUrl?.trim() || null,
        streamType,
        groupId,
        status: 'online',
        isRecording: false,
      },
      include: {
        group: {
          select: { id: true, name: true },
        },
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        module: 'security',
        action: 'security.camera.created',
        entityType: 'Camera',
        entityId: camera.id,
        newValue: JSON.stringify({
          name: camera.name,
          location: camera.location,
          propertyId,
          streamType,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      data: camera,
    });
  } catch (error) {
    console.error('Error creating camera:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create camera' } },
      { status: 500 }
    );
  }
}

// PUT /api/security/cameras - Update camera
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Check permission
    if (!hasPermission(user, 'security.update') && !hasPermission(user, 'security.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, name, location, status, isRecording, groupId } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Camera ID is required' } },
        { status: 400 }
      );
    }

    // Validate status if provided
    if (status && !VALID_CAMERA_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid status. Must be one of: ${VALID_CAMERA_STATUSES.join(', ')}` } },
        { status: 400 }
      );
    }

    // Get existing camera and verify ownership through property
    const existingCamera = await db.camera.findFirst({
      where: { id },
      include: { property: { select: { tenantId: true } } },
    });

    if (!existingCamera || existingCamera.property.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Camera not found or access denied' } },
        { status: 404 }
      );
    }

    // Validate group if specified
    if (groupId !== undefined && groupId !== null) {
      const group = await db.cameraGroup.findFirst({
        where: { id: groupId, propertyId: existingCamera.propertyId },
      });
      if (!group) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_GROUP', message: 'Camera group not found or does not belong to property' } },
          { status: 400 }
        );
      }
    }

    const camera = await db.camera.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(location !== undefined && { location: location?.trim() || null }),
        ...(status && { status }),
        ...(isRecording !== undefined && { isRecording }),
        ...(groupId !== undefined && { groupId }),
      },
      include: {
        group: {
          select: { id: true, name: true },
        },
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        module: 'security',
        action: 'security.camera.updated',
        entityType: 'Camera',
        entityId: camera.id,
        newValue: JSON.stringify({
          updates: { name, location, status, isRecording, groupId },
        }),
      },
    });

    return NextResponse.json({
      success: true,
      data: camera,
    });
  } catch (error) {
    console.error('Error updating camera:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update camera' } },
      { status: 500 }
    );
  }
}

// DELETE /api/security/cameras - Delete camera
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Check permission
    if (!hasPermission(user, 'security.delete') && !hasPermission(user, 'security.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Camera ID is required' } },
        { status: 400 }
      );
    }

    // Get existing camera and verify ownership
    const existingCamera = await db.camera.findFirst({
      where: { id },
      include: { property: { select: { tenantId: true } } },
    });

    if (!existingCamera || existingCamera.property.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Camera not found or access denied' } },
        { status: 404 }
      );
    }

    // Create audit log before deletion
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        module: 'security',
        action: 'security.camera.deleted',
        entityType: 'Camera',
        entityId: id,
        newValue: JSON.stringify({
          deletedCamera: {
            name: existingCamera.name,
            location: existingCamera.location,
          },
        }),
      },
    });

    await db.camera.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Camera deleted successfully' },
    });
  } catch (error) {
    console.error('Error deleting camera:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete camera' } },
      { status: 500 }
    );
  }
}
