/**
 * WiFi AAA Configuration API Route
 * 
 * Manages FreeRADIUS configuration per property
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, tenantWhere } from '@/lib/auth/tenant-context';

// GET /api/wifi/aaa/config - Get AAA config for property
export async function GET(request: NextRequest) {
  const context = await requirePermission(request, 'wifi.manage');
  if (context instanceof NextResponse) return context;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: 'propertyId is required' },
        { status: 400 }
      );
    }

    const config = await db.wiFiAAAConfig.findUnique({
      where: { propertyId },
      include: {
        defaultPlan: true,
      },
    });

    if (!config) {
      // Return default config
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

// POST /api/wifi/aaa/config - Create or update AAA config
export async function POST(request: NextRequest) {
  const context = await requirePermission(request, 'wifi.manage');
  if (context instanceof NextResponse) return context;

  try {
    const body = await request.json();
    const {
      propertyId,
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
    } = body;

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: 'propertyId is required' },
        { status: 400 }
      );
    }

    const config = await db.wiFiAAAConfig.upsert({
      where: { propertyId },
      update: {
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
      },
      create: {
        tenantId: context.tenantId,
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
