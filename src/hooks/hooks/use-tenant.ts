'use client';

import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook to get the current tenant ID from auth context
 * Returns null if not authenticated
 */
export function useTenant(): string | null {
  const { user, isAuthenticated } = useAuth();
  
  if (!isAuthenticated || !user) {
    return null;
  }
  
  return user.tenantId;
}

/**
 * Hook to get tenant info with fallback for demo mode
 * Use this for components that need to work in demo mode without auth
 */
export function useTenantWithFallback(): { tenantId: string; isAuthenticated: boolean } {
  const { user, isAuthenticated } = useAuth();
  
  if (isAuthenticated && user?.tenantId) {
    return { tenantId: user.tenantId, isAuthenticated: true };
  }
  
  // Fallback for demo mode - should not be used in production
  return { tenantId: 'demo-tenant', isAuthenticated: false };
}

/**
 * Hook that provides tenant context for API calls
 * Returns headers object with tenant ID for API requests
 */
export function useTenantHeaders(): Record<string, string> {
  const { user, isAuthenticated } = useAuth();
  
  if (isAuthenticated && user?.tenantId) {
    return {
      'X-Tenant-ID': user.tenantId,
    };
  }
  
  return {};
}
