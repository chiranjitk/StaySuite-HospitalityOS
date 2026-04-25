import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// Default AI providers
const defaultProviders = [
  {
    id: 'openai',
    name: 'OpenAI',
    enabled: true,
    model: 'gpt-4',
    apiKey: '',
    temperature: 0.7,
    maxTokens: 2000,
    usage: { total: 0, limit: 500000, period: 'month' },
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    enabled: false,
    model: 'claude-3-sonnet',
    apiKey: '',
    temperature: 0.7,
    maxTokens: 2000,
    usage: { total: 0, limit: 300000, period: 'month' },
  },
  {
    id: 'azure',
    name: 'Azure OpenAI',
    enabled: false,
    model: 'gpt-4',
    endpoint: '',
    apiKey: '',
    temperature: 0.7,
    maxTokens: 2000,
    usage: { total: 0, limit: 400000, period: 'month' },
  },
];

// GET - Get AI provider settings
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

    // Permission check - admin only for provider settings
    if (!hasPermission(user, 'ai.settings') && user.roleName !== 'admin') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
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

    // Parse AI-specific settings
    const aiSettings = (tenantSettings.ai as Record<string, unknown>) || {};

    // Get provider-specific settings
    const providers = defaultProviders.map(provider => {
      const providerSettings = (aiSettings.providers as Record<string, Record<string, unknown>>)?.[provider.id] || {};
      return {
        ...provider,
        enabled: providerSettings.enabled !== undefined ? Boolean(providerSettings.enabled) : provider.enabled,
        model: (providerSettings.model as string) || provider.model,
        temperature: (providerSettings.temperature as number) || provider.temperature,
        maxTokens: (providerSettings.maxTokens as number) || provider.maxTokens,
        apiKey: '••••••••••••', // Don't expose actual API keys
        usage: {
          total: (providerSettings.usageTotal as number) || 0,
          limit: (providerSettings.usageLimit as number) || provider.usage.limit,
          period: 'month',
        },
      };
    });

    // Get AI features from tenant features
    let tenantFeatures: Record<string, unknown> = {};
    try {
      tenantFeatures = tenant.features ? JSON.parse(tenant.features) : {};
    } catch {
      tenantFeatures = {};
    }

    const settings = {
      providers,
      features: {
        copilotEnabled: ((tenantFeatures.ai_copilot as boolean) ?? true),
        insightsEnabled: ((aiSettings.insightsEnabled as boolean) ?? true),
        recommendationsEnabled: ((aiSettings.recommendationsEnabled as boolean) ?? true),
        autoTagging: ((aiSettings.autoTagging as boolean) ?? false),
        sentimentAnalysis: ((aiSettings.sentimentAnalysis as boolean) ?? true),
      },
      defaultProvider: (aiSettings.defaultProvider as string) || 'openai',
      tenantId,
    };

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Error fetching AI provider settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch AI provider settings' },
      { status: 500 }
    );
  }
}

// PUT - Update AI provider settings
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

    // Permission check - admin only for provider settings
    if (!hasPermission(user, 'ai.settings') && user.roleName !== 'admin') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const { providers, features, defaultProvider } = body;

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

    // Get current settings
    const currentSettings = tenant.settings ? JSON.parse(tenant.settings) : {};
    const currentFeatures = tenant.features ? JSON.parse(tenant.features) : {};

    // Build AI settings
    const aiSettings: Record<string, unknown> = {
      ...(currentSettings.ai as Record<string, unknown> || {}),
      defaultProvider,
      insightsEnabled: features?.insightsEnabled,
      recommendationsEnabled: features?.recommendationsEnabled,
      autoTagging: features?.autoTagging,
      sentimentAnalysis: features?.sentimentAnalysis,
    };

    // Build provider-specific settings
    if (providers) {
      const providersMap: Record<string, Record<string, unknown>> = {};
      providers.forEach((p: { id: string; enabled: boolean; model: string; temperature: number; maxTokens: number; apiKey?: string }) => {
        providersMap[p.id] = {
          enabled: p.enabled,
          model: p.model,
          temperature: p.temperature,
          maxTokens: p.maxTokens,
          // Only store API key if provided and not masked
          ...(p.apiKey && p.apiKey !== '••••••••••••' && { apiKey: p.apiKey }),
        };
      });
      aiSettings.providers = providersMap;
    }

    // Update tenant features for AI copilot
    const newFeatures = {
      ...currentFeatures,
      ai_copilot: features?.copilotEnabled,
    };

    // Update tenant
    await db.tenant.update({
      where: { id: tenantId },
      data: {
        settings: JSON.stringify({
          ...currentSettings,
          ai: aiSettings,
        }),
        features: JSON.stringify(newFeatures),
      },
    });

    return NextResponse.json({
      success: true,
      data: { tenantId, providers, features, defaultProvider },
      message: 'AI settings saved successfully',
    });
  } catch (error) {
    console.error('Error updating AI provider settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update AI provider settings' },
      { status: 500 }
    );
  }
}
