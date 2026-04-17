import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { getCurrencySymbol } from '@/lib/currencies';

// GET - Get localization settings
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'settings.view')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;

    // Get tenant
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId, deletedAt: null },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
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

    // Parse features from tenant
    let tenantFeatures: Record<string, unknown> = {};
    try {
      tenantFeatures = tenant.features ? JSON.parse(tenant.features) : {};
    } catch {
      tenantFeatures = {};
    }

    const settings = {
      language: {
        default: tenant.language || 'en',
        available: (tenantSettings.availableLanguages as Array<{ code: string; name: string; native: string; enabled: boolean }>) || [
          { code: 'en', name: 'English', native: 'English', enabled: true },
          { code: 'hi', name: 'Hindi', native: 'हिंदी', enabled: true },
          { code: 'bn', name: 'Bengali', native: 'বাংলা', enabled: true },
          { code: 'es', name: 'Spanish', native: 'Español', enabled: true },
          { code: 'fr', name: 'French', native: 'Français', enabled: true },
          { code: 'de', name: 'German', native: 'Deutsch', enabled: false },
          { code: 'ar', name: 'Arabic', native: 'العربية', enabled: false },
        ],
      },
      region: {
        timezone: tenant.timezone || 'Asia/Kolkata',
        country: tenant.country || 'IN',
        locale: (tenantSettings.locale as string) || 'en-IN',
      },
      formats: {
        dateFormat: (tenantSettings.dateFormat as string) || 'DD/MM/YYYY',
        timeFormat: (tenantSettings.timeFormat as string) || '12h',
        firstDayOfWeek: (tenantSettings.firstDayOfWeek as number) || 1, // Monday
        numberFormat: {
          decimal: '.',
          thousand: ',',
          currency: getCurrencySymbol(tenant.currency || 'INR'),
        },
      },
      translations: {
        autoTranslate: ((tenantSettings.autoTranslate as boolean) ?? false),
        provider: (tenantSettings.translationProvider as string) || 'google',
        defaultSourceLanguage: tenant.language || 'en',
      },
      guestFacing: {
        languageDetection: (tenantSettings.languageDetection as string) || 'browser',
        rememberPreference: ((tenantSettings.rememberLanguagePreference as boolean) ?? true),
        showLanguageSelector: ((tenantSettings.showLanguageSelector as boolean) ?? true),
      },
      tenantId,
    };

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Error fetching localization settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch localization settings' },
      { status: 500 }
    );
  }
}

// PUT - Update localization settings
export async function PUT(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'settings.edit')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const { language, region, formats, translations, guestFacing } = body;

    // Input validation
    if (language && typeof language !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid language data' },
        { status: 400 }
      );
    }
    if (language?.default && typeof language.default !== 'string') {
      return NextResponse.json(
        { success: false, error: 'language.default must be a string' },
        { status: 400 }
      );
    }
    if (region && typeof region !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid region data' },
        { status: 400 }
      );
    }
    if (formats && typeof formats !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid formats data' },
        { status: 400 }
      );
    }
    if (translations && typeof translations !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid translations data' },
        { status: 400 }
      );
    }
    if (guestFacing && typeof guestFacing !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid guestFacing data' },
        { status: 400 }
      );
    }

    // Validate timezone if provided
    if (region?.timezone && typeof region.timezone === 'string') {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: region.timezone });
      } catch {
        return NextResponse.json(
          { success: false, error: 'Invalid timezone' },
          { status: 400 }
        );
      }
    }

    // Validate country if provided
    if (region?.country && typeof region.country === 'string') {
      if (!/^[A-Z]{2}$/.test(region.country)) {
        return NextResponse.json(
          { success: false, error: 'Country must be a valid 2-letter ISO code' },
          { status: 400 }
        );
      }
    }

    // Get tenant
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId, deletedAt: null },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Update tenant with new settings
    const currentSettings = tenant.settings ? JSON.parse(tenant.settings) : {};
    const newSettings = {
      ...currentSettings,
      availableLanguages: language?.available,
      locale: region?.locale,
      dateFormat: formats?.dateFormat,
      timeFormat: formats?.timeFormat,
      firstDayOfWeek: formats?.firstDayOfWeek,
      autoTranslate: translations?.autoTranslate,
      translationProvider: translations?.provider,
      languageDetection: guestFacing?.languageDetection,
      rememberLanguagePreference: guestFacing?.rememberPreference,
      showLanguageSelector: guestFacing?.showLanguageSelector,
    };

    await db.tenant.update({
      where: { id: tenantId },
      data: {
        language: language?.default,
        timezone: region?.timezone,
        country: region?.country,
        settings: JSON.stringify(newSettings),
      },
    });

    return NextResponse.json({
      success: true,
      data: { tenantId, language, region, formats, translations, guestFacing },
      message: 'Localization settings updated successfully',
    });
  } catch (error) {
    console.error('Error updating localization settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update localization settings' },
      { status: 500 }
    );
  }
}
