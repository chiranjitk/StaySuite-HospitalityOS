'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveTenantStore } from '@/store';

export interface TenantOption {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
}

const STORAGE_KEY = 'activeTenantId';

/**
 * Hook for platform admins to switch between tenants.
 * Stores the active tenant ID in localStorage and a Zustand store
 * so other components can read it without re-fetching.
 */
export function useTenantSwitcher() {
  const { user, isAuthenticated } = useAuth();
  const { activeTenantId, setActiveTenantId } = useActiveTenantStore();

  const [availableTenants, setAvailableTenants] = useState<TenantOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const isPlatformAdmin = isAuthenticated && !!user?.isPlatformAdmin;

  // Fetch available tenants when platform admin is detected
  useEffect(() => {
    if (!isPlatformAdmin) {
      setAvailableTenants([]);
      return;
    }

    let cancelled = false;

    async function fetchTenants() {
      setIsLoading(true);
      try {
        const res = await fetch('/api/tenants');
        if (!res.ok) throw new Error('Failed to fetch tenants');
        const json = await res.json();
        if (cancelled) return;

        const tenants: TenantOption[] = (json.data?.tenants ?? []).map(
          (t: { id: string; name: string; slug: string; plan: string; status: string }) => ({
            id: t.id,
            name: t.name,
            slug: t.slug,
            plan: t.plan,
            status: t.status,
          })
        );
        setAvailableTenants(tenants);
      } catch (err) {
        console.error('Failed to load tenants:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchTenants();
    return () => {
      cancelled = true;
    };
  }, [isPlatformAdmin]);

  // Persist activeTenantId to localStorage whenever it changes (Zustand handles persistence too)
  useEffect(() => {
    if (activeTenantId) {
      localStorage.setItem(STORAGE_KEY, activeTenantId);
    }
  }, [activeTenantId]);

  const switchTenant = useCallback(
    (tenantId: string) => {
      setActiveTenantId(tenantId);
      localStorage.setItem(STORAGE_KEY, tenantId);
    },
    [setActiveTenantId]
  );

  // The effective tenant ID is the activeTenantId (for platform admins) or the user's own tenantId
  const effectiveTenantId = isPlatformAdmin
    ? activeTenantId || user?.tenantId || null
    : user?.tenantId || null;

  // Find the selected tenant object
  const activeTenant = availableTenants.find((t) => t.id === effectiveTenantId) ?? null;

  return {
    isPlatformAdmin,
    availableTenants,
    activeTenantId: effectiveTenantId,
    activeTenant,
    switchTenant,
    isLoading,
  };
}
