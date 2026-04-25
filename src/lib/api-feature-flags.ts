// API Feature Protection Utility
// Use this in API routes to check if features are enabled

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { FEATURES, PLAN_FEATURES, getFeatureForMenuItem } from '@/lib/feature-flags';

/**
 * Check if a feature is enabled for a tenant
 * @param featureId - The feature ID to check
 * @param tenantId - The tenant ID (defaults to 'tenant-1')
 * @returns boolean indicating if feature is enabled
 */
export async function isFeatureEnabledForTenant(
  featureId: string,
  tenantId: string = 'tenant-1'
): Promise<boolean> {
  try {
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId, deletedAt: null },
      select: { plan: true, features: true },
    });

    if (!tenant) return false;

    // Parse tenant feature overrides
    let tenantFeatures: Record<string, boolean> = {};
    try {
      tenantFeatures = tenant.features ? JSON.parse(tenant.features) : {};
    } catch {
      tenantFeatures = {};
    }

    // Check for explicit tenant override
    if (tenantFeatures[featureId] !== undefined) {
      return Boolean(tenantFeatures[featureId]);
    }

    // Fall back to plan defaults
    const planFeatures = PLAN_FEATURES[tenant.plan] || PLAN_FEATURES.trial;
    return planFeatures.includes(featureId);
  } catch (error) {
    console.error('Error checking feature flag:', error);
    return false;
  }
}

/**
 * Get all enabled features for a tenant
 * @param tenantId - The tenant ID
 * @returns Array of enabled feature IDs
 */
export async function getEnabledFeaturesForTenant(
  tenantId: string = 'tenant-1'
): Promise<string[]> {
  try {
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId, deletedAt: null },
      select: { plan: true, features: true },
    });

    if (!tenant) return PLAN_FEATURES.trial;

    let tenantFeatures: Record<string, boolean> = {};
    try {
      tenantFeatures = tenant.features ? JSON.parse(tenant.features) : {};
    } catch {
      tenantFeatures = {};
    }

    const planFeatures = PLAN_FEATURES[tenant.plan] || PLAN_FEATURES.trial;
    
    // Merge plan defaults with tenant overrides
    const enabled = new Set(planFeatures);
    
    for (const [key, enabled_flag] of Object.entries(tenantFeatures)) {
      if (enabled_flag) {
        enabled.add(key);
      } else {
        enabled.delete(key);
      }
    }

    return Array.from(enabled);
  } catch (error) {
    console.error('Error getting enabled features:', error);
    return PLAN_FEATURES.trial;
  }
}

/**
 * Check if a menu item should be visible
 * @param menuItem - The menu item ID
 * @param tenantId - The tenant ID
 * @returns boolean indicating if menu item is visible
 */
export async function isMenuItemVisibleForTenant(
  menuItem: string,
  tenantId: string = 'tenant-1'
): Promise<boolean> {
  const featureId = getFeatureForMenuItem(menuItem);
  if (!featureId) return true; // If no feature controls it, show by default
  return isFeatureEnabledForTenant(featureId, tenantId);
}

/**
 * API middleware to check feature flags
 * Returns null if feature is enabled, or a NextResponse with error if disabled
 * 
 * @example
 * export async function GET(request: NextRequest) {
 *   const featureCheck = await requireFeature('ai_features');
 *   if (featureCheck) return featureCheck; // Returns error response if disabled
 *   // Continue with normal logic...
 * }
 */
export async function requireFeature(
  featureId: string,
  tenantId: string = 'tenant-1'
): Promise<NextResponse | null> {
  const isEnabled = await isFeatureEnabledForTenant(featureId, tenantId);
  
  if (!isEnabled) {
    const feature = FEATURES[featureId];
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FEATURE_DISABLED',
          message: `${feature?.name || featureId} is not enabled for your current plan`,
          featureId,
          featureName: feature?.name,
          upgradeUrl: '#settings-features'
        }
      },
      { status: 403 }
    );
  }
  
  return null; // Feature is enabled, proceed
}

/**
 * Check if an API route is accessible for a tenant
 * @param route - The API route path
 * @param tenantId - The tenant ID
 * @returns boolean indicating if route is accessible
 */
export async function isApiRouteAccessible(
  route: string,
  tenantId: string = 'tenant-1'
): Promise<boolean> {
  const enabledFeatures = await getEnabledFeaturesForTenant(tenantId);
  
  // Check if any enabled feature controls this route
  for (const featureId of enabledFeatures) {
    const config = FEATURES[featureId];
    if (config?.apiRoutes.some(r => route.startsWith(r))) {
      return true;
    }
  }
  
  // Check if route is controlled by any feature
  for (const config of Object.values(FEATURES)) {
    if (config.apiRoutes.some(r => route.startsWith(r))) {
      return false; // Route is controlled but feature not enabled
    }
  }
  
  return true; // Route not controlled by any feature
}
