import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  FEATURES,
  PLAN_FEATURES,
  FEATURE_CATEGORIES,
} from '@/lib/feature-flags';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET - Get feature flags for tenant
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

    // Note: All authenticated users can read feature flags (needed for menu visibility)
    // Only admins can modify feature flags (see PUT handler)

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

    // Get default features for plan
    const planKey = tenant.plan || 'trial';
    const defaultFeatures = PLAN_FEATURES[planKey] || PLAN_FEATURES.trial;

    // Parse tenant-specific feature overrides from database
    let tenantOverrides: Record<string, boolean> = {};
    try {
      if (tenant.features) {
        tenantOverrides = JSON.parse(tenant.features);
      }
    } catch {
      tenantOverrides = {};
    }

    // Build features list - merge defaults with tenant overrides
    const allFeatureKeys = [...new Set([...defaultFeatures, ...Object.keys(FEATURES)])];
    
    const features = allFeatureKeys.map(key => {
      const config = FEATURES[key as keyof typeof FEATURES];
      const isDefaultEnabled = defaultFeatures.includes(key);
      const tenantOverride = tenantOverrides[key];
      
      return {
        id: key,
        key: key,
        name: config?.name || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        description: config?.description || '',
        enabled: tenantOverride !== undefined ? tenantOverride : isDefaultEnabled,
        category: config?.category || 'standard',
        isCore: config?.category === 'addons',
      };
    });

    // Group by category for UI
    const categories = Object.entries(FEATURE_CATEGORIES).map(([key, info]) => ({
      id: key,
      name: info.name,
      description: info.description,
      color: info.color,
      features: features.filter(f => f.category === key),
    }));

    // Return only enabled feature keys for the context
    const enabledFeatureKeys = features.filter(f => f.enabled).map(f => f.key);

    const featureFlags = {
      features,
      categories,
      enabledFeatures: enabledFeatureKeys,
      plan: planKey,
      tenantId,
    };

    return NextResponse.json({
      success: true,
      data: featureFlags,
    });
  } catch (error) {
    console.error('Error fetching feature flags:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch feature flags' },
      { status: 500 }
    );
  }
}

// PUT - Update feature flags for tenant
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

    // Permission check - only admins can modify feature flags
    if (user.roleName !== 'admin' && !user.permissions.includes('*')) {
      return NextResponse.json(
        { success: false, error: 'Only administrators can modify feature flags' },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const { features } = body;

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

    // Build features map from the request
    const featuresMap: Record<string, boolean> = {};
    
    if (Array.isArray(features)) {
      features.forEach((f: { key: string; enabled: boolean }) => {
        featuresMap[f.key] = f.enabled;
      });
    }

    // Get existing features and merge
    let existingFeatures: Record<string, boolean> = {};
    try {
      if (tenant.features) {
        existingFeatures = JSON.parse(tenant.features);
      }
    } catch {
      existingFeatures = {};
    }

    // Merge with new values
    const updatedFeatures = { ...existingFeatures, ...featuresMap };

    // Update tenant features
    await db.tenant.update({
      where: { id: tenantId },
      data: {
        features: JSON.stringify(updatedFeatures),
      },
    });

    // Get plan defaults
    const planKey = tenant.plan || 'trial';
    const defaultFeatures = PLAN_FEATURES[planKey] || PLAN_FEATURES.trial;

    // Build response
    const allFeatureKeys = [...new Set([...defaultFeatures, ...Object.keys(FEATURES)])];
    const enabledFeatures = allFeatureKeys.filter(key => {
      const override = updatedFeatures[key];
      if (override !== undefined) return override;
      return defaultFeatures.includes(key);
    });

    return NextResponse.json({
      success: true,
      data: { 
        tenantId, 
        features: Array.isArray(features) ? features : [],
        enabledFeatures,
      },
      message: 'Feature flags updated successfully',
    });
  } catch (error) {
    console.error('Error updating feature flags:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update feature flags' },
      { status: 500 }
    );
  }
}
