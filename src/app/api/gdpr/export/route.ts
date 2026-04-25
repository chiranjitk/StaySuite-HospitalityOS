import { NextRequest, NextResponse } from 'next/server';
import { gdprService } from '@/lib/gdpr/gdpr-service';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// POST /api/gdpr/export - Request data export for a guest
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
    if (!hasPermission(user, 'gdpr.export') && !hasPermission(user, 'gdpr.*') && !hasPermission(user, 'guests.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { guestId, format = 'json', requesterEmail, requesterName } = body;

    if (!guestId) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_FIELDS', message: 'guestId is required' } },
        { status: 400 }
      );
    }

    // Verify guest exists and belongs to user's tenant
    const guest = await db.guest.findFirst({
      where: { id: guestId, tenantId: user.tenantId, deletedAt: null },
    });

    if (!guest) {
      return NextResponse.json(
        { success: false, error: { code: 'GUEST_NOT_FOUND', message: 'Guest not found or access denied' } },
        { status: 404 }
      );
    }

    // Create export request
    const gdprRequest = await gdprService.createRequest({
      tenantId: user.tenantId,
      guestId,
      requestType: 'export',
      requesterEmail: requesterEmail || user.email,
      requesterName: requesterName || user.name,
    });

    // NOTE: This export runs synchronously within the request. In production,
    // consider queuing this work (e.g., via BullMQ, SQS, etc.) for large exports
    // to avoid HTTP timeout. A reasonable data limit is enforced below.
    const MAX_EXPORT_RECORDS = 10000;

    // Immediately process the export (in production, this might be queued)
    try {
      const exportData = await gdprService.exportGuestData(guestId, user.tenantId, {
        format: format === 'csv' ? 'csv' : 'json',
        includeBookings: true,
        includePayments: true,
        includePreferences: true,
        includeDocuments: true,
        includeCommunications: true,
        maxRecords: MAX_EXPORT_RECORDS,
      });

      // Update request as completed
      await gdprService.updateRequestStatus(gdprRequest.id, user.tenantId, 'completed', {
        completedBy: user.id,
      });

      // Create audit log
      await db.auditLog.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          module: 'gdpr',
          action: 'gdpr.export.completed',
          entityType: 'Guest',
          entityId: guestId,
          newValue: JSON.stringify({
            requestId: gdprRequest.id,
            format,
            guestEmail: guest.email,
          }),
        },
      });

      // Return appropriate format
      if (format === 'csv') {
        // For CSV, return all sections as separate files info
        const csvSections = {
          profile: gdprService.exportToCSV(exportData, 'profile'),
          bookings: gdprService.exportToCSV(exportData, 'bookings'),
          payments: gdprService.exportToCSV(exportData, 'payments'),
        };

        return NextResponse.json({
          success: true,
          data: {
            requestId: gdprRequest.id,
            format: 'csv',
            sections: csvSections,
            exportMetadata: exportData.exportMetadata,
          },
        });
      }

      return NextResponse.json({
        success: true,
        data: {
          requestId: gdprRequest.id,
          exportData,
        },
      });
    } catch (exportError) {
      // Update request as failed
      await gdprService.updateRequestStatus(gdprRequest.id, user.tenantId, 'failed', {
        notes: exportError instanceof Error ? exportError.message : 'Export failed',
      });
      throw exportError;
    }
  } catch (error) {
    console.error('Error processing GDPR export request:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process export request' } },
      { status: 500 }
    );
  }
}

// GET /api/gdpr/export - Get export data for a guest
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
    if (!hasPermission(user, 'gdpr.export') && !hasPermission(user, 'gdpr.*') && !hasPermission(user, 'guests.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const guestId = searchParams.get('guestId');
    const format = searchParams.get('format') || 'json';

    if (!guestId) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_FIELDS', message: 'guestId is required' } },
        { status: 400 }
      );
    }

    // Verify guest exists and belongs to user's tenant
    const guest = await db.guest.findFirst({
      where: { id: guestId, tenantId: user.tenantId, deletedAt: null },
    });

    if (!guest) {
      return NextResponse.json(
        { success: false, error: { code: 'GUEST_NOT_FOUND', message: 'Guest not found or access denied' } },
        { status: 404 }
      );
    }

    // NOTE: This export runs synchronously. A data limit is enforced to prevent timeout.
    const MAX_EXPORT_RECORDS = 10000;

    // Export data
    const exportData = await gdprService.exportGuestData(guestId, user.tenantId, {
      format: format === 'csv' ? 'csv' : 'json',
      includeBookings: true,
      includePayments: true,
      includePreferences: true,
      includeDocuments: true,
      includeCommunications: true,
      maxRecords: MAX_EXPORT_RECORDS,
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        module: 'gdpr',
        action: 'gdpr.export.viewed',
        entityType: 'Guest',
        entityId: guestId,
        newValue: JSON.stringify({
          format,
          guestEmail: guest.email,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      data: exportData,
    });
  } catch (error) {
    console.error('Error exporting guest data:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to export guest data' } },
      { status: 500 }
    );
  }
}
