import { NextRequest, NextResponse } from 'next/server';
import { gdprService } from '@/lib/gdpr/gdpr-service';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/gdpr/consent - Get consent records
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
    if (!hasPermission(user, 'gdpr.view') && !hasPermission(user, 'gdpr.*') && !hasPermission(user, 'guests.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const guestId = searchParams.get('guestId');
    const userId = searchParams.get('userId');
    const consentType = searchParams.get('consentType');
    const includeStats = searchParams.get('includeStats') === 'true';

    // Build filters
    const filters: {
      guestId?: string;
      userId?: string;
      consentType?: 'marketing' | 'analytics' | 'third_party' | 'cookies' | 'essential' | 'profiling';
    } = {};

    if (guestId) {
      // Verify guest belongs to user's tenant
      const guest = await db.guest.findFirst({
        where: { id: guestId, tenantId: user.tenantId },
      });
      if (!guest) {
        return NextResponse.json(
          { success: false, error: { code: 'GUEST_NOT_FOUND', message: 'Guest not found or access denied' } },
          { status: 404 }
        );
      }
      filters.guestId = guestId;
    }
    
    if (userId) filters.userId = userId;
    if (consentType && ['marketing', 'analytics', 'third_party', 'cookies', 'essential', 'profiling'].includes(consentType)) {
      filters.consentType = consentType as 'marketing' | 'analytics' | 'third_party' | 'cookies' | 'essential' | 'profiling';
    }

    // Get consent records
    const consentRecords = await gdprService.getConsentRecords(user.tenantId, filters);

    // Get stats if requested
    let stats: Record<string, unknown> | null = null;
    if (includeStats) {
      stats = await gdprService.getConsentStats(user.tenantId);
    }

    return NextResponse.json({
      success: true,
      data: {
        records: consentRecords,
        ...(stats ? { stats } : {}),
      },
    });
  } catch (error) {
    console.error('Error fetching consent records:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch consent records' } },
      { status: 500 }
    );
  }
}

// POST /api/gdpr/consent - Record consent
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
    if (!hasPermission(user, 'gdpr.consent') && !hasPermission(user, 'gdpr.*') && !hasPermission(user, 'guests.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      guestId,
      userId: targetUserId,
      consentType,
      consentCategory,
      granted,
      grantedVia,
      consentText,
      consentVersion,
    } = body;

    if (!consentType) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_CONSENT_TYPE', message: 'consentType is required' } },
        { status: 400 }
      );
    }

    if (!guestId && !targetUserId) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_SUBJECT', message: 'Either guestId or userId is required' } },
        { status: 400 }
      );
    }

    // Validate consent type
    const validConsentTypes = ['marketing', 'analytics', 'third_party', 'cookies', 'essential', 'profiling'];
    if (!validConsentTypes.includes(consentType)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_CONSENT_TYPE', message: `consentType must be one of: ${validConsentTypes.join(', ')}` } },
        { status: 400 }
      );
    }

    // Verify guest belongs to user's tenant if specified
    if (guestId) {
      const guest = await db.guest.findFirst({
        where: { id: guestId, tenantId: user.tenantId },
      });
      if (!guest) {
        return NextResponse.json(
          { success: false, error: { code: 'GUEST_NOT_FOUND', message: 'Guest not found or access denied' } },
          { status: 404 }
        );
      }
    }

    // Extract IP and user agent from request
    const ipAddress = 
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      request.headers.get('cf-connecting-ip') ||
      undefined;

    const userAgent = request.headers.get('user-agent') || undefined;

    // Create or update consent
    const consentRecord = await gdprService.createConsent({
      tenantId: user.tenantId,
      guestId,
      userId: targetUserId,
      consentType,
      consentCategory,
      granted: granted === true,
      grantedVia: grantedVia || 'api',
      ipAddress,
      userAgent,
      consentText,
      consentVersion,
    });

    // Update guest's opt-in preferences if applicable
    if (guestId && consentType === 'marketing') {
      await db.guest.update({
        where: { id: guestId },
        data: {
          emailOptIn: granted,
          smsOptIn: granted,
        },
      });
    }

    // Create audit log
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        module: 'gdpr',
        action: granted ? 'gdpr.consent.granted' : 'gdpr.consent.denied',
        entityType: 'ConsentRecord',
        entityId: consentRecord.id,
        newValue: JSON.stringify({
          guestId,
          consentType,
          granted,
          grantedVia,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      data: consentRecord,
    });
  } catch (error) {
    console.error('Error recording consent:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to record consent' } },
      { status: 500 }
    );
  }
}

// DELETE /api/gdpr/consent - Revoke consent
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
    if (!hasPermission(user, 'gdpr.consent') && !hasPermission(user, 'gdpr.*') && !hasPermission(user, 'guests.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const consentId = searchParams.get('consentId');
    const revokedVia = searchParams.get('revokedVia');
    const reason = searchParams.get('reason');

    if (!consentId) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_FIELDS', message: 'consentId is required' } },
        { status: 400 }
      );
    }

    // Revoke consent - the service already checks tenant ownership
    const consentRecord = await gdprService.revokeConsent(consentId, user.tenantId, {
      revokedVia: revokedVia || 'api',
      reason: reason || undefined,
    });

    // Update guest's opt-in preferences if applicable
    if (consentRecord.guestId && consentRecord.consentType === 'marketing') {
      await db.guest.update({
        where: { id: consentRecord.guestId },
        data: {
          emailOptIn: false,
          smsOptIn: false,
        },
      });
    }

    // Create audit log
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        module: 'gdpr',
        action: 'gdpr.consent.revoked',
        entityType: 'ConsentRecord',
        entityId: consentId,
        newValue: JSON.stringify({
          guestId: consentRecord.guestId,
          consentType: consentRecord.consentType,
          reason,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      data: consentRecord,
    });
  } catch (error) {
    console.error('Error revoking consent:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to revoke consent' } },
      { status: 500 }
    );
  }
}
