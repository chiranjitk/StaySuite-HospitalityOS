import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { randomUUID } from 'crypto';

// Valid values for validation
const VALID_INCIDENT_TYPES = ['theft', 'unauthorized', 'accident', 'disturbance', 'fire', 'other'];
const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'];
const VALID_STATUSES = ['open', 'investigating', 'resolved', 'closed'];

// Status transition rules
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  'open': ['investigating', 'resolved', 'closed'],
  'investigating': ['resolved', 'closed', 'open'],
  'resolved': ['closed'],
  'closed': [], // Terminal state
};

// GET /api/security/incidents - List all incidents
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
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');
    const type = searchParams.get('type');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate filters
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: 'Invalid status filter' } },
        { status: 400 }
      );
    }
    if (severity && !VALID_SEVERITIES.includes(severity)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_SEVERITY', message: 'Invalid severity filter' } },
        { status: 400 }
      );
    }
    if (type && !VALID_INCIDENT_TYPES.includes(type)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TYPE', message: 'Invalid type filter' } },
        { status: 400 }
      );
    }

    // Build where clause - use authenticated user's tenant
    const where: Prisma.SecurityIncidentWhereInput = {
      tenantId: user.tenantId,
      ...(status && { status }),
      ...(severity && { severity }),
      ...(type && { type }),
    };

    const [incidents, total] = await Promise.all([
      db.securityIncident.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.securityIncident.count({ where }),
    ]);

    // Calculate stats
    const allIncidents = await db.securityIncident.findMany({
      where: { tenantId: user.tenantId },
      select: { status: true, severity: true, createdAt: true, resolvedAt: true },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = {
      total: allIncidents.length,
      open: allIncidents.filter(i => i.status === 'open' || i.status === 'investigating').length,
      critical: allIncidents.filter(i => i.severity === 'critical' && i.status !== 'closed').length,
      resolvedToday: allIncidents.filter(i => 
        i.resolvedAt && new Date(i.resolvedAt) >= today
      ).length,
      byStatus: {
        open: allIncidents.filter(i => i.status === 'open').length,
        investigating: allIncidents.filter(i => i.status === 'investigating').length,
        resolved: allIncidents.filter(i => i.status === 'resolved').length,
        closed: allIncidents.filter(i => i.status === 'closed').length,
      },
      bySeverity: {
        low: allIncidents.filter(i => i.severity === 'low').length,
        medium: allIncidents.filter(i => i.severity === 'medium').length,
        high: allIncidents.filter(i => i.severity === 'high').length,
        critical: allIncidents.filter(i => i.severity === 'critical').length,
      },
    };

    return NextResponse.json({
      success: true,
      data: {
        incidents,
        total,
        stats,
      },
    });
  } catch (error) {
    console.error('Error fetching incidents:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch incidents' } },
      { status: 500 }
    );
  }
}

// POST /api/security/incidents - Create a new incident
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
      type,
      severity = 'medium',
      title,
      description,
      location,
      reportedBy,
      cameraId,
    } = body;

    // Validation
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Title is required' } },
        { status: 400 }
      );
    }

    if (!location || typeof location !== 'string' || location.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Location is required' } },
        { status: 400 }
      );
    }

    // Validate type
    if (type && !VALID_INCIDENT_TYPES.includes(type)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid incident type. Must be one of: ${VALID_INCIDENT_TYPES.join(', ')}` } },
        { status: 400 }
      );
    }

    // Validate severity
    if (!VALID_SEVERITIES.includes(severity)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid severity. Must be one of: ${VALID_SEVERITIES.join(', ')}` } },
        { status: 400 }
      );
    }

    // Validate property belongs to tenant
    if (propertyId) {
      const property = await db.property.findFirst({
        where: { id: propertyId, tenantId: user.tenantId },
      });
      if (!property) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_PROPERTY', message: 'Property not found or access denied' } },
          { status: 400 }
        );
      }
    }

    // Validate camera belongs to property in tenant
    if (cameraId && propertyId) {
      const camera = await db.camera.findFirst({
        where: { id: cameraId, propertyId },
      });
      if (!camera) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_CAMERA', message: 'Camera not found or does not belong to property' } },
          { status: 400 }
        );
      }
    }

    const incident = await db.securityIncident.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        type: type || 'other',
        severity,
        title: title.trim(),
        description: description?.trim() || null,
        location: location.trim(),
        reportedBy: reportedBy || user.name,
        cameraId,
        status: 'open',
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        module: 'security',
        action: 'security.incident.created',
        entityType: 'SecurityIncident',
        entityId: incident.id,
        newValue: JSON.stringify({
          type: incident.type,
          severity: incident.severity,
          title: incident.title,
          location: incident.location,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      data: incident,
    });
  } catch (error) {
    console.error('Error creating incident:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create incident' } },
      { status: 500 }
    );
  }
}

// PUT /api/security/incidents - Update incident
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
    const { id, status, severity, assignedTo, resolution } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Incident ID is required' } },
        { status: 400 }
      );
    }

    // Get existing incident and verify ownership
    const existingIncident = await db.securityIncident.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existingIncident) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Incident not found or access denied' } },
        { status: 404 }
      );
    }

    // Validate status transition
    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` } },
          { status: 400 }
        );
      }

      const allowedTransitions = VALID_STATUS_TRANSITIONS[existingIncident.status] || [];
      if (!allowedTransitions.includes(status)) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_TRANSITION', message: `Cannot transition from '${existingIncident.status}' to '${status}'` } },
          { status: 400 }
        );
      }
    }

    // Validate severity
    if (severity && !VALID_SEVERITIES.includes(severity)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid severity. Must be one of: ${VALID_SEVERITIES.join(', ')}` } },
        { status: 400 }
      );
    }

    const updateData: Prisma.SecurityIncidentUpdateInput = {};
    
    if (status) {
      updateData.status = status;
      if (status === 'resolved' || status === 'closed') {
        updateData.resolvedAt = new Date();
      }
    }
    if (severity) updateData.severity = severity;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (resolution !== undefined) updateData.resolution = resolution?.trim() || null;

    const incident = await db.securityIncident.update({
      where: { id },
      data: updateData,
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        module: 'security',
        action: 'security.incident.updated',
        entityType: 'SecurityIncident',
        entityId: incident.id,
        newValue: JSON.stringify({
          previousStatus: existingIncident.status,
          newStatus: status || existingIncident.status,
          updates: updateData,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      data: incident,
    });
  } catch (error) {
    console.error('Error updating incident:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update incident' } },
      { status: 500 }
    );
  }
}

// DELETE /api/security/incidents - Delete incident
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Check permission - only admins can delete incidents
    if (user.roleName !== 'admin' && !hasPermission(user, 'security.delete') && !hasPermission(user, 'security.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only administrators can delete incidents' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Incident ID is required' } },
        { status: 400 }
      );
    }

    // Verify ownership
    const existingIncident = await db.securityIncident.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existingIncident) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Incident not found or access denied' } },
        { status: 404 }
      );
    }

    // Create audit log before deletion
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        module: 'security',
        action: 'security.incident.deleted',
        entityType: 'SecurityIncident',
        entityId: id,
        newValue: JSON.stringify({
          deletedIncident: {
            title: existingIncident.title,
            type: existingIncident.type,
            severity: existingIncident.severity,
            status: existingIncident.status,
          },
        }),
      },
    });

    await db.securityIncident.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Incident deleted successfully' },
    });
  } catch (error) {
    console.error('Error deleting incident:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete incident' } },
      { status: 500 }
    );
  }
}
