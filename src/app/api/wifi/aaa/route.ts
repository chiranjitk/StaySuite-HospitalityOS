/**
 * WiFi AAA Configuration API Route
 * 
 * Manages RADIUS AAA configuration per property
 * Includes credential policy (username/password generation rules)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, tenantWhere, resolvePropertyId } from '@/lib/auth/tenant-context';

// Credential policy fields shared between GET default and POST
const CREDENTIAL_DEFAULTS = {
  usernameFormat: 'room_random',
  usernamePrefix: null,
  usernameCase: 'lowercase',
  usernameMinLength: 4,
  usernameMaxLength: 32,
  passwordFormat: 'random_alphanumeric',
  passwordFixedValue: null,
  passwordLength: 8,
  passwordIncludeUppercase: true,
  passwordIncludeNumbers: true,
  passwordIncludeSymbols: false,
  credentialSeparator: '_',
  credentialPrintOnVoucher: true,
  credentialShowInPortal: true,
  duplicateUsernameAction: 'append_random',
};

// GET /api/wifi/aaa - Get AAA config for property
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = await resolvePropertyId(user, searchParams.get('propertyId'));
    if (!propertyId) {
      return NextResponse.json({ success: false, error: 'No property found. Please create a property first.' }, { status: 400 });
    }

    const config = await db.wiFiAAAConfig.findUnique({
      where: { propertyId },
      include: {
        defaultPlan: true,
      },
    });

    if (!config) {
      // Return default config with credential policy defaults
      return NextResponse.json({
        success: true,
        data: {
          propertyId,
          defaultDownloadSpeed: 10,
          defaultUploadSpeed: 10,
          defaultSessionLimit: null,
          defaultDataLimit: null,
          autoProvisionOnCheckin: true,
          autoDeprovisionOnCheckout: true,
          autoDeprovisionDelay: 0,
          authMethod: 'pap',
          allowMacAuth: false,
          accountingSyncInterval: 5,
          maxConcurrentSessions: 3,
          sessionTimeoutPolicy: 'hard',
          portalEnabled: true,
          status: 'active',
          ...CREDENTIAL_DEFAULTS,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Error fetching AAA config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch AAA config' },
      { status: 500 }
    );
  }
}

// POST /api/wifi/aaa - Create or update AAA config
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    console.log('[AAA] Save request - propertyId:', body.propertyId, 'defaultPlanId:', body.defaultPlanId, 'tenantId:', body.tenantId);
    const propertyId = await resolvePropertyId(user, body.propertyId);
    if (!propertyId) {
      return NextResponse.json({ success: false, error: 'No property found. Please create a property first.' }, { status: 400 });
    }
    const {
      tenantId,
      defaultPlanId,
      defaultDownloadSpeed,
      defaultUploadSpeed,
      defaultSessionLimit,
      defaultDataLimit,
      autoProvisionOnCheckin,
      autoDeprovisionOnCheckout,
      autoDeprovisionDelay,
      authMethod,
      allowMacAuth,
      accountingSyncInterval,
      maxConcurrentSessions,
      sessionTimeoutPolicy,
      portalEnabled,
      portalTitle,
      portalLogo,
      portalTerms,
      portalRedirectUrl,
      portalBrandColor,
      // Credential policy fields
      usernameFormat,
      usernamePrefix,
      usernameCase,
      usernameMinLength,
      usernameMaxLength,
      passwordFormat,
      passwordFixedValue,
      passwordLength,
      passwordIncludeUppercase,
      passwordIncludeNumbers,
      passwordIncludeSymbols,
      credentialSeparator,
      credentialPrintOnVoucher,
      credentialShowInPortal,
      duplicateUsernameAction,
    } = body;

    // Validate tenantId — frontend may send 'default' which is not a real tenant ID
    // Always prefer the authenticated user's tenantId from context
    const resolvedTenantId = user.tenantId;

    const config = await db.wiFiAAAConfig.upsert({
      where: { propertyId },
      update: {
        tenantId: resolvedTenantId,
        defaultPlanId,
        defaultDownloadSpeed,
        defaultUploadSpeed,
        defaultSessionLimit,
        defaultDataLimit,
        autoProvisionOnCheckin,
        autoDeprovisionOnCheckout,
        autoDeprovisionDelay,
        authMethod,
        allowMacAuth,
        accountingSyncInterval,
        maxConcurrentSessions,
        sessionTimeoutPolicy,
        portalEnabled,
        portalTitle,
        portalLogo,
        portalTerms,
        portalRedirectUrl,
        portalBrandColor,
        // Credential policy
        usernameFormat,
        usernamePrefix,
        usernameCase,
        usernameMinLength,
        usernameMaxLength,
        passwordFormat,
        passwordFixedValue,
        passwordLength,
        passwordIncludeUppercase,
        passwordIncludeNumbers,
        passwordIncludeSymbols,
        credentialSeparator,
        credentialPrintOnVoucher,
        credentialShowInPortal,
        duplicateUsernameAction,
      },
      create: {
        tenantId: resolvedTenantId,
        propertyId,
        defaultPlanId,
        defaultDownloadSpeed: defaultDownloadSpeed || 10,
        defaultUploadSpeed: defaultUploadSpeed || 10,
        defaultSessionLimit,
        defaultDataLimit,
        autoProvisionOnCheckin: autoProvisionOnCheckin ?? true,
        autoDeprovisionOnCheckout: autoDeprovisionOnCheckout ?? true,
        autoDeprovisionDelay: autoDeprovisionDelay || 0,
        authMethod: authMethod || 'pap',
        allowMacAuth: allowMacAuth ?? false,
        accountingSyncInterval: accountingSyncInterval || 5,
        maxConcurrentSessions: maxConcurrentSessions || 3,
        sessionTimeoutPolicy: sessionTimeoutPolicy || 'hard',
        portalEnabled: portalEnabled ?? true,
        portalTitle,
        portalLogo,
        portalTerms,
        portalRedirectUrl,
        portalBrandColor: portalBrandColor || '#0d9488',
        // Credential policy
        usernameFormat: usernameFormat || CREDENTIAL_DEFAULTS.usernameFormat,
        usernamePrefix,
        usernameCase: usernameCase || CREDENTIAL_DEFAULTS.usernameCase,
        usernameMinLength: usernameMinLength || CREDENTIAL_DEFAULTS.usernameMinLength,
        usernameMaxLength: usernameMaxLength || CREDENTIAL_DEFAULTS.usernameMaxLength,
        passwordFormat: passwordFormat || CREDENTIAL_DEFAULTS.passwordFormat,
        passwordFixedValue,
        passwordLength: passwordLength || CREDENTIAL_DEFAULTS.passwordLength,
        passwordIncludeUppercase: passwordIncludeUppercase ?? CREDENTIAL_DEFAULTS.passwordIncludeUppercase,
        passwordIncludeNumbers: passwordIncludeNumbers ?? CREDENTIAL_DEFAULTS.passwordIncludeNumbers,
        passwordIncludeSymbols: passwordIncludeSymbols ?? CREDENTIAL_DEFAULTS.passwordIncludeSymbols,
        credentialSeparator: credentialSeparator || CREDENTIAL_DEFAULTS.credentialSeparator,
        credentialPrintOnVoucher: credentialPrintOnVoucher ?? CREDENTIAL_DEFAULTS.credentialPrintOnVoucher,
        credentialShowInPortal: credentialShowInPortal ?? CREDENTIAL_DEFAULTS.credentialShowInPortal,
        duplicateUsernameAction: duplicateUsernameAction || CREDENTIAL_DEFAULTS.duplicateUsernameAction,
      },
    });

    return NextResponse.json({
      success: true,
      data: config,
      message: 'AAA configuration saved successfully',
    });
  } catch (error) {
    console.error('Error saving AAA config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save AAA config' },
      { status: 500 }
    );
  }
}
