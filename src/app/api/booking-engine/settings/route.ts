import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/booking-engine/settings - Get booking engine configuration
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'bookings.view');
    if (auth instanceof NextResponse) return auth;

    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');

    // Get properties for this tenant
    const where: Record<string, unknown> = { tenantId: auth.tenantId, deletedAt: null };
    if (propertyId) where.id = propertyId;

    const properties = await db.property.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        website: true,
        primaryColor: true,
        secondaryColor: true,
        currency: true,
      },
      take: 1,
    });

    const property = properties[0];

    // Check for booking engine integration config
    const integration = await db.integration.findFirst({
      where: {
        tenantId: auth.tenantId,
        type: 'booking_engine',
      },
    });

    // Parse integration config if exists
    let engineConfig: Record<string, unknown> = {};
    if (integration?.config) {
      try {
        engineConfig = JSON.parse(integration.config);
      } catch {
        engineConfig = {};
      }
    }

    const settings = {
      enabled: integration?.status === 'active' ? true : (engineConfig.enabled as boolean | undefined) ?? true,
      domain: (engineConfig.domain as string) || (property ? `book.staysuite.com/${property.slug}` : 'book.staysuite.com/hotel'),
      customDomain: (engineConfig.customDomain as string | null) || null,
      primaryColor: property?.primaryColor || '#0d9488',
      secondaryColor: property?.secondaryColor || '#f0fdfa',
      logo: property?.logo || null,
      showPrices: (engineConfig.showPrices as boolean | undefined) ?? true,
      requirePayment: (engineConfig.requirePayment as boolean | undefined) ?? false,
      depositPercentage: (engineConfig.depositPercentage as number | undefined) ?? 20,
      cancellationPolicy: (engineConfig.cancellationPolicy as string) || 'free_24h',
      termsUrl: (engineConfig.termsUrl as string | null) || null,
      privacyUrl: (engineConfig.privacyUrl as string | null) || null,
      googleAnalyticsId: (engineConfig.googleAnalyticsId as string | null) || null,
      facebookPixelId: (engineConfig.facebookPixelId as string | null) || null,
      propertyId: property?.id || null,
      propertyName: property?.name || null,
    };

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Error fetching booking engine settings:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch booking engine settings' } },
      { status: 500 }
    );
  }
}

// PUT /api/booking-engine/settings - Update booking engine configuration
export async function PUT(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'bookings.manage');
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const {
      enabled,
      domain,
      customDomain,
      primaryColor,
      secondaryColor,
      showPrices,
      requirePayment,
      depositPercentage,
      cancellationPolicy,
      termsUrl,
      privacyUrl,
      googleAnalyticsId,
      facebookPixelId,
      propertyId,
    } = body;

    // Build config object
    const config: Record<string, unknown> = {};
    if (domain !== undefined) config.domain = domain;
    if (customDomain !== undefined) config.customDomain = customDomain || null;
    if (showPrices !== undefined) config.showPrices = showPrices;
    if (requirePayment !== undefined) config.requirePayment = requirePayment;
    if (depositPercentage !== undefined) config.depositPercentage = depositPercentage;
    if (cancellationPolicy !== undefined) config.cancellationPolicy = cancellationPolicy;
    if (termsUrl !== undefined) config.termsUrl = termsUrl || null;
    if (privacyUrl !== undefined) config.privacyUrl = privacyUrl || null;
    if (googleAnalyticsId !== undefined) config.googleAnalyticsId = googleAnalyticsId || null;
    if (facebookPixelId !== undefined) config.facebookPixelId = facebookPixelId || null;
    config.enabled = enabled !== undefined ? enabled : true;

    // Upsert the booking engine integration
    const existing = await db.integration.findFirst({
      where: { tenantId: auth.tenantId, type: 'booking_engine' },
    });

    let integration;
    if (existing) {
      // Merge with existing config
      let existingConfig: Record<string, unknown> = {};
      try {
        existingConfig = JSON.parse(existing.config);
      } catch {
        existingConfig = {};
      }

      integration = await db.integration.update({
        where: { id: existing.id },
        data: {
          config: JSON.stringify({ ...existingConfig, ...config }),
          status: enabled !== undefined ? (enabled ? 'active' : 'inactive') : existing.status,
        },
      });
    } else {
      integration = await db.integration.create({
        data: {
          tenantId: auth.tenantId,
          type: 'booking_engine',
          provider: 'staysuite',
          name: 'StaySuite Booking Engine',
          config: JSON.stringify(config),
          status: enabled !== undefined ? (enabled ? 'active' : 'inactive') : 'active',
        },
      });
    }

    // Update property if provided
    if (propertyId && (primaryColor || secondaryColor || customDomain)) {
      const propertyData: Record<string, unknown> = {};
      if (primaryColor) propertyData.primaryColor = primaryColor;
      if (secondaryColor) propertyData.secondaryColor = secondaryColor;
      if (customDomain) propertyData.website = customDomain;

      // Verify property belongs to tenant
      const property = await db.property.findFirst({
        where: { id: propertyId, tenantId: auth.tenantId },
      });

      if (property) {
        await db.property.update({
          where: { id: propertyId },
          data: propertyData,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        integrationId: integration.id,
        status: integration.status,
      },
      message: 'Booking engine settings saved successfully',
    });
  } catch (error) {
    console.error('Error saving booking engine settings:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to save booking engine settings' } },
      { status: 500 }
    );
  }
}
