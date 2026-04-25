import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logSettings } from '@/lib/audit';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET - Get security settings
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check - security settings require admin
    if (user.roleName !== 'admin' && !user.permissions.includes('*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only administrators can view security settings' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;

    // Get tenant
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId, deletedAt: null },
      include: {
        users: {
          take: 10,
          orderBy: { updatedAt: 'desc' },
          select: {
            email: true,
            twoFactorEnabled: true,
            updatedAt: true,
          },
        },
        auditLogs: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            action: true,
            createdAt: true,
            user: {
              select: {
                email: true,
              },
            },
          },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } },
        { status: 404 }
      );
    }

    // Parse settings from tenant
    let tenantSettings: Record<string, unknown> = {};
    try {
      tenantSettings = tenant.settings ? JSON.parse(tenant.settings) : {};
    } catch {
      tenantSettings = {};
    }

    // Calculate security stats from real data
    const usersWith2FA = tenant.users.filter(u => u.twoFactorEnabled).length;
    const totalUsers = tenant.users.length;

    const settings = {
      authentication: {
        mfaEnabled: ((tenantSettings.mfaEnabled as boolean) ?? (usersWith2FA > totalUsers * 0.5)),
        mfaMethod: (tenantSettings.mfaMethod as string) || 'totp',
        ssoEnabled: ((tenantSettings.ssoEnabled as boolean) ?? false),
        ssoProvider: (tenantSettings.ssoProvider as string) || null,
        passwordPolicy: {
          minLength: (tenantSettings.passwordMinLength as number) || 12,
          requireUppercase: ((tenantSettings.passwordRequireUppercase as boolean) ?? true),
          requireLowercase: ((tenantSettings.passwordRequireLowercase as boolean) ?? true),
          requireNumbers: ((tenantSettings.passwordRequireNumbers as boolean) ?? true),
          requireSpecialChars: ((tenantSettings.passwordRequireSpecialChars as boolean) ?? true),
          expiryDays: (tenantSettings.passwordExpiryDays as number) || 90,
          preventReuse: (tenantSettings.passwordPreventReuse as number) || 5,
        },
        sessionTimeout: (tenantSettings.sessionTimeout as number) || 30,
        maxConcurrentSessions: (tenantSettings.maxConcurrentSessions as number) || 3,
      },
      accessControl: {
        ipWhitelist: (tenantSettings.ipWhitelist as string[]) || [],
        ipBlacklist: (tenantSettings.ipBlacklist as string[]) || [],
        allowedCountries: (tenantSettings.allowedCountries as string[]) || [],
        vpnDetection: ((tenantSettings.vpnDetection as boolean) ?? true),
      },
      dataProtection: {
        encryptionAtRest: ((tenantSettings.encryptionAtRest as boolean) ?? true),
        encryptionInTransit: ((tenantSettings.encryptionInTransit as boolean) ?? true),
        dataRetentionDays: (tenantSettings.dataRetentionDays as number) || 365,
        anonymizeOnDelete: ((tenantSettings.anonymizeOnDelete as boolean) ?? true),
        auditLogging: ((tenantSettings.auditLogging as boolean) ?? true),
      },
      apiSecurity: {
        rateLimiting: ((tenantSettings.rateLimiting as boolean) ?? true),
        requestsPerMinute: (tenantSettings.requestsPerMinute as number) || 100,
        apiKeyRotation: ((tenantSettings.apiKeyRotation as boolean) ?? true),
        rotationDays: (tenantSettings.rotationDays as number) || 90,
      },
      compliance: {
        pciDss: ((tenantSettings.pciDss as boolean) ?? false),
        gdpr: ((tenantSettings.gdpr as boolean) ?? true),
        ccpa: ((tenantSettings.ccpa as boolean) ?? true),
        dataProcessingAgreement: ((tenantSettings.dataProcessingAgreement as boolean) ?? false),
      },
      recentActivity: tenant.auditLogs.map(log => ({
        action: log.action,
        user: log.user?.email || 'System',
        time: log.createdAt.toISOString(),
      })),
      tenantId,
    };

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Error fetching security settings:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch security settings' } },
      { status: 500 }
    );
  }
}

// PUT - Update security settings
export async function PUT(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check - security settings require admin
    if (user.roleName !== 'admin' && !user.permissions.includes('*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only administrators can modify security settings' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const { authentication, accessControl, dataProtection, apiSecurity, compliance } = body;

    // --- Validation ---

    // Validate password policy fields if provided
    if (authentication?.passwordPolicy) {
      const pp = authentication.passwordPolicy;
      if (pp.minLength !== undefined) {
        if (typeof pp.minLength !== 'number' || pp.minLength < 1 || pp.minLength > 128 || !Number.isFinite(pp.minLength)) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'passwordPolicy.minLength must be a number between 1 and 128' } },
            { status: 400 }
          );
        }
      }
      if (pp.expiryDays !== undefined) {
        if (typeof pp.expiryDays !== 'number' || pp.expiryDays < 0 || !Number.isFinite(pp.expiryDays)) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'passwordPolicy.expiryDays must be a non-negative number' } },
            { status: 400 }
          );
        }
      }
      if (pp.preventReuse !== undefined) {
        if (typeof pp.preventReuse !== 'number' || pp.preventReuse < 0 || !Number.isInteger(pp.preventReuse)) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'passwordPolicy.preventReuse must be a non-negative integer' } },
            { status: 400 }
          );
        }
      }
      if (pp.requireUppercase !== undefined && typeof pp.requireUppercase !== 'boolean') {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'passwordPolicy.requireUppercase must be a boolean' } },
          { status: 400 }
        );
      }
      if (pp.requireLowercase !== undefined && typeof pp.requireLowercase !== 'boolean') {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'passwordPolicy.requireLowercase must be a boolean' } },
          { status: 400 }
        );
      }
      if (pp.requireNumbers !== undefined && typeof pp.requireNumbers !== 'boolean') {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'passwordPolicy.requireNumbers must be a boolean' } },
          { status: 400 }
        );
      }
      if (pp.requireSpecialChars !== undefined && typeof pp.requireSpecialChars !== 'boolean') {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'passwordPolicy.requireSpecialChars must be a boolean' } },
          { status: 400 }
        );
      }
    }

    // Validate session timeout is a positive number
    if (authentication?.sessionTimeout !== undefined) {
      if (typeof authentication.sessionTimeout !== 'number' || authentication.sessionTimeout <= 0 || !Number.isFinite(authentication.sessionTimeout)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'sessionTimeout must be a positive number' } },
          { status: 400 }
        );
      }
    }

    // Validate maxConcurrentSessions
    if (authentication?.maxConcurrentSessions !== undefined) {
      if (typeof authentication.maxConcurrentSessions !== 'number' || authentication.maxConcurrentSessions < 1 || !Number.isInteger(authentication.maxConcurrentSessions)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'maxConcurrentSessions must be a positive integer' } },
          { status: 400 }
        );
      }
    }

    // Validate dataRetentionDays
    if (dataProtection?.dataRetentionDays !== undefined) {
      if (typeof dataProtection.dataRetentionDays !== 'number' || dataProtection.dataRetentionDays < 1 || !Number.isFinite(dataProtection.dataRetentionDays)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'dataRetentionDays must be a positive number' } },
          { status: 400 }
        );
      }
    }

    // Validate requestsPerMinute
    if (apiSecurity?.requestsPerMinute !== undefined) {
      if (typeof apiSecurity.requestsPerMinute !== 'number' || apiSecurity.requestsPerMinute < 1 || !Number.isFinite(apiSecurity.requestsPerMinute)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'requestsPerMinute must be a positive number' } },
          { status: 400 }
        );
      }
    }

    // Validate rotationDays
    if (apiSecurity?.rotationDays !== undefined) {
      if (typeof apiSecurity.rotationDays !== 'number' || apiSecurity.rotationDays < 1 || !Number.isFinite(apiSecurity.rotationDays)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'rotationDays must be a positive number' } },
          { status: 400 }
        );
      }
    }

    // Only allow known top-level keys to prevent arbitrary data storage
    const allowedKeys = ['authentication', 'accessControl', 'dataProtection', 'apiSecurity', 'compliance'];
    const bodyKeys = Object.keys(body);
    const unknownKeys = bodyKeys.filter(k => !allowedKeys.includes(k));
    if (unknownKeys.length > 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Unknown settings keys: ${unknownKeys.join(', ')}` } },
        { status: 400 }
      );
    }

    // Get tenant
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId, deletedAt: null },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } },
        { status: 404 }
      );
    }

    // Build new settings object
    const currentSettings = tenant.settings ? JSON.parse(tenant.settings) : {};
    const newSettings = {
      ...currentSettings,
      // Authentication
      mfaEnabled: authentication?.mfaEnabled,
      mfaMethod: authentication?.mfaMethod,
      ssoEnabled: authentication?.ssoEnabled,
      ssoProvider: authentication?.ssoProvider,
      passwordMinLength: authentication?.passwordPolicy?.minLength,
      passwordRequireUppercase: authentication?.passwordPolicy?.requireUppercase,
      passwordRequireLowercase: authentication?.passwordPolicy?.requireLowercase,
      passwordRequireNumbers: authentication?.passwordPolicy?.requireNumbers,
      passwordRequireSpecialChars: authentication?.passwordPolicy?.requireSpecialChars,
      passwordExpiryDays: authentication?.passwordPolicy?.expiryDays,
      passwordPreventReuse: authentication?.passwordPolicy?.preventReuse,
      sessionTimeout: authentication?.sessionTimeout,
      maxConcurrentSessions: authentication?.maxConcurrentSessions,
      // Access Control
      ipWhitelist: accessControl?.ipWhitelist,
      ipBlacklist: accessControl?.ipBlacklist,
      allowedCountries: accessControl?.allowedCountries,
      vpnDetection: accessControl?.vpnDetection,
      // Data Protection
      encryptionAtRest: dataProtection?.encryptionAtRest,
      encryptionInTransit: dataProtection?.encryptionInTransit,
      dataRetentionDays: dataProtection?.dataRetentionDays,
      anonymizeOnDelete: dataProtection?.anonymizeOnDelete,
      auditLogging: dataProtection?.auditLogging,
      // API Security
      rateLimiting: apiSecurity?.rateLimiting,
      requestsPerMinute: apiSecurity?.requestsPerMinute,
      apiKeyRotation: apiSecurity?.apiKeyRotation,
      rotationDays: apiSecurity?.rotationDays,
      // Compliance
      pciDss: compliance?.pciDss,
      gdpr: compliance?.gdpr,
      ccpa: compliance?.ccpa,
      dataProcessingAgreement: compliance?.dataProcessingAgreement,
    };

    // Update tenant settings
    await db.tenant.update({
      where: { id: tenantId },
      data: {
        settings: JSON.stringify(newSettings),
      },
    });

    // Log audit
    try {
      await logSettings(request, 'settings_update', 'security_settings', undefined, {
        authentication: authentication ? 'updated' : 'skipped',
        accessControl: accessControl ? 'updated' : 'skipped',
        dataProtection: dataProtection ? 'updated' : 'skipped',
        apiSecurity: apiSecurity ? 'updated' : 'skipped',
        compliance: compliance ? 'updated' : 'skipped',
      }, { tenantId: user.tenantId, userId: user.id });
    } catch (auditError) {
      console.error('Audit log failed (non-blocking):', auditError);
    }

    return NextResponse.json({
      success: true,
      data: { tenantId, authentication, accessControl, dataProtection, apiSecurity, compliance },
      message: 'Security settings updated successfully',
    });
  } catch (error) {
    console.error('Error updating security settings:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update security settings' } },
      { status: 500 }
    );
  }
}
