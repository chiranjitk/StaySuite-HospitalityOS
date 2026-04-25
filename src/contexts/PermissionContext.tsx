'use client';

import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  hasMenuAccess,
  checkMenuPermission as checkPermission,
  hasAnyPermission as checkAnyPermission,
  hasAllPermissions as checkAllPermissions,
  getMenuPermissions,
} from '@/config/permissions';
import { menuPermissions } from '@/config/permissions';

interface PermissionContextType {
  // Check if user has a specific permission
  hasPermission: (permission: string) => boolean;
  // Check if user has any of the specified permissions
  hasAnyPermission: (permissions: string[]) => boolean;
  // Check if user has all of the specified permissions
  hasAllPermissions: (permissions: string[]) => boolean;
  // Check if user can access a menu item
  canAccessMenu: (menuItemId: string) => boolean;
  // Get all accessible menu items for the user
  getAccessibleMenus: () => string[];
  // Get user's current permissions
  permissions: string[];
  // Check if user is admin
  isAdmin: boolean;
  // Get user's role name
  roleName: string;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const permissions = useMemo(() => {
    if (!user) return [];
    return user.permissions || [];
  }, [user]);

  const roleName = useMemo(() => {
    if (!user) return '';
    return user.roleName || '';
  }, [user]);

  const isAdmin = useMemo(() => {
    return roleName === 'admin' || permissions.includes('*');
  }, [roleName, permissions]);

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!user) return false;
      return checkPermission(permissions, permission);
    },
    [user, permissions]
  );

  const hasAnyPermission = useCallback(
    (perms: string[]): boolean => {
      if (!user) return false;
      return checkAnyPermission(permissions, perms);
    },
    [user, permissions]
  );

  const hasAllPermissions = useCallback(
    (perms: string[]): boolean => {
      if (!user) return false;
      return checkAllPermissions(permissions, perms);
    },
    [user, permissions]
  );

  const canAccessMenu = useCallback(
    (menuItemId: string): boolean => {
      if (!user) return false;
      // Platform admin has access to everything
      if (user.isPlatformAdmin) return true;
      // SaaS menus are exclusive to platform admin
      if (menuItemId.startsWith('saas-')) return false;
      // Admin role or wildcard permission has access to everything
      if (isAdmin || permissions.includes('*')) return true;
      return hasMenuAccess(permissions, menuItemId);
    },
    [user, permissions, isAdmin]
  );

  const getAccessibleMenus = useCallback((): string[] => {
    if (!user) return [];
    // Platform admin has access to all menus
    if (user.isPlatformAdmin) return Object.keys(menuPermissions);
    // SaaS menus are exclusive to platform admin
    if (isAdmin || permissions.includes('*')) {
      return Object.keys(menuPermissions).filter(id => !id.startsWith('saas-'));
    }
    return Object.keys(menuPermissions).filter(menuId =>
      hasMenuAccess(permissions, menuId)
    );
  }, [user, permissions, isAdmin]);

  // Get required permissions for a menu item
  const getMenuRequiredPermissions = useCallback((menuItemId: string): string[] => {
    return getMenuPermissions(menuItemId);
  }, []);

  const value = useMemo(
    () => ({
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      canAccessMenu,
      getAccessibleMenus,
      permissions,
      isAdmin,
      roleName,
    }),
    [
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      canAccessMenu,
      getAccessibleMenus,
      permissions,
      isAdmin,
      roleName,
    ]
  );

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
}

// Higher-order component for permission-based rendering
interface WithPermissionProps {
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function WithPermission({
  permission,
  permissions,
  requireAll = false,
  fallback = null,
  children,
}: WithPermissionProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  if (permission) {
    if (!hasPermission(permission)) return <>{fallback}</>;
  } else if (permissions && permissions.length > 0) {
    if (requireAll) {
      if (!hasAllPermissions(permissions)) return <>{fallback}</>;
    } else {
      if (!hasAnyPermission(permissions)) return <>{fallback}</>;
    }
  }

  return <>{children}</>;
}

// Hook for checking menu access in components
export function useMenuAccess() {
  const { canAccessMenu, permissions, isAdmin } = usePermissions();

  const filterMenuItems = useCallback(
    (items: { id: string; [key: string]: unknown }[]): { id: string; [key: string]: unknown }[] => {
      return items.filter(item => canAccessMenu(item.id));
    },
    [canAccessMenu]
  );

  return {
    canAccessMenu,
    filterMenuItems,
    permissions,
    isAdmin,
  };
}
