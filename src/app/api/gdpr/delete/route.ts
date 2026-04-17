import { NextRequest, NextResponse } from 'next/server';
import { gdprService } from '@/lib/gdpr/gdpr-service';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// POST /api/gdpr/delete - Request data deletion for a guest
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Check permission - deletion requires admin or specific GDPR permission
    if (!hasPermission(user, 'gdpr.delete') && !hasPermission(user, 'gdpr.*') && user.roleName !== 'admin') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions. Only admins can delete guest data.' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { guestId, requesterEmail, requesterName, hardDelete, preserveFinancialRecords } = body;

    if (!guestId) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_FIELDS', message: 'guestId is required' } },
        { status: 400 }
      );
    }

    // Verify guest exists and belongs to user's tenant
    const guest = await db.guest.findFirst({
      where: { id: guestId, tenantId: user.tenantId, deletedAt: null },
      include: {
        bookings: {
          where: {
            status: { in: ['confirmed', 'checked_in'] },
          },
        },
      },
    });

    if (!guest) {
      return NextResponse.json(
        { success: false, error: { code: 'GUEST_NOT_FOUND', message: 'Guest not found or access denied' } },
        { status: 404 }
      );
    }

    // Check for active bookings
    if (guest.bookings.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'HAS_ACTIVE_BOOKINGS', 
            message: 'Cannot delete guest with active bookings. Please complete or cancel all bookings first.' 
          } 
        },
        { status: 400 }
      );
    }

    // Create deletion request
    const gdprRequest = await gdprService.createRequest({
      tenantId: user.tenantId,
      guestId,
      requestType: 'delete',
      requesterEmail: requesterEmail || user.email,
      requesterName: requesterName || user.name,
    });

    // Update request status to processing
    await gdprService.updateRequestStatus(gdprRequest.id, user.tenantId, 'processing');

    try {
      // Perform deletion
      const result = await gdprService.deleteGuestData(guestId, user.tenantId, {
        hardDelete: hardDelete || false,
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
          action: 'gdpr.delete.completed',
          entityType: 'Guest',
          entityId: guestId,
          newValue: JSON.stringify({
            requestId: gdprRequest.id,
            deletedRecords: result.deletedRecords,
            hardDelete: hardDelete || false,
            preserveFinancialRecords,
          }),
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          requestId: gdprRequest.id,
          deletedRecords: result.deletedRecords,
          message: hardDelete 
            ? 'Guest data has been permanently deleted' 
            : 'Guest data has been soft deleted',
        },
      });
    } catch (deleteError) {
      // Update request as failed
      await gdprService.updateRequestStatus(gdprRequest.id, user.tenantId, 'failed', {
        notes: deleteError instanceof Error ? deleteError.message : 'Deletion failed',
      });
      throw deleteError;
    }
  } catch (error) {
    console.error('Error processing GDPR deletion request:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process deletion request' } },
      { status: 500 }
    );
  }
}
