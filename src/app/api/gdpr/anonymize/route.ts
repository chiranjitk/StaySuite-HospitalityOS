import { NextRequest, NextResponse } from 'next/server';
import { gdprService } from '@/lib/gdpr/gdpr-service';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// POST /api/gdpr/anonymize - Request data anonymization for a guest
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Check permission - anonymization requires elevated permissions
    if (!hasPermission(user, 'gdpr.anonymize') && !hasPermission(user, 'gdpr.*') && user.roleName !== 'admin') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions. Only admins can anonymize guest data.' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { guestId, requesterEmail, requesterName, preserveAnalytics, preserveFinancialRecords } = body;

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

    // Create anonymization request
    const gdprRequest = await gdprService.createRequest({
      tenantId: user.tenantId,
      guestId,
      requestType: 'anonymize',
      requesterEmail: requesterEmail || user.email,
      requesterName: requesterName || user.name,
    });

    // Update request status to processing
    await gdprService.updateRequestStatus(gdprRequest.id, user.tenantId, 'processing');

    try {
      // Perform anonymization
      const result = await gdprService.anonymizeGuestData(guestId, user.tenantId, {
        preserveAnalytics: preserveAnalytics !== false, // Default to true
        preserveFinancialRecords: preserveFinancialRecords !== false, // Default to true
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
          action: 'gdpr.anonymize.completed',
          entityType: 'Guest',
          entityId: guestId,
          newValue: JSON.stringify({
            requestId: gdprRequest.id,
            anonymizedFields: result.anonymizedFields,
            preserveAnalytics,
            preserveFinancialRecords,
          }),
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          requestId: gdprRequest.id,
          anonymizedFields: result.anonymizedFields,
          message: 'Guest data has been anonymized while preserving analytics',
        },
      });
    } catch (anonymizeError) {
      // Update request as failed
      await gdprService.updateRequestStatus(gdprRequest.id, user.tenantId, 'failed', {
        notes: anonymizeError instanceof Error ? anonymizeError.message : 'Anonymization failed',
      });
      throw anonymizeError;
    }
  } catch (error) {
    console.error('Error processing GDPR anonymization request:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process anonymization request' } },
      { status: 500 }
    );
  }
}
