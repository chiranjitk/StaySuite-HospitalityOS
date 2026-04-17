'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
  phone: string | null;
  jobTitle: string | null;
  department: string | null;
  twoFactorEnabled: boolean;
  roleId: string | null;
  roleName: string;
  permissions: string[];
  tenantId: string;
  isPlatformAdmin: boolean;
  tenant: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    status: string;
  };
}

interface LoginResult {
  success: boolean;
  error?: string;
  requireTwoFactor?: boolean;
  tempToken?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isPlatformAdmin: boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<LoginResult>;
  completeTwoFactorLogin: (email: string, tempToken: string, code: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const fetchSession = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session');
      const data = await response.json();

      if (data?.success && data?.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Failed to fetch session:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  /**
   * @deprecated Use usePermissions() from @/contexts/PermissionContext instead
   */
  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!user) return false;
      // Platform admin has all permissions
      if (user.isPlatformAdmin) return true;
      // Admin has all permissions
      if (user.roleName === 'admin' || user.permissions.includes('*')) return true;
      // Check wildcard permissions (e.g., 'bookings.*' matches 'bookings.view')
      const hasWildcard = user.permissions.some(
        (p: string) => p === '*' || p === `${permission.split('.')[0]}.*`
      );
      if (hasWildcard) return true;
      return user.permissions.includes(permission);
    },
    [user]
  );

  /**
   * @deprecated Use usePermissions() from @/contexts/PermissionContext instead
   */
  const hasAnyPermission = useCallback(
    (permissions: string[]): boolean => {
      if (!user) return false;
      // Platform admin has all permissions
      if (user.isPlatformAdmin) return true;
      if (user.roleName === 'admin' || user.permissions.includes('*')) return true;
      return permissions.some((p) => {
        if (user.permissions.includes(p)) return true;
        // Check module wildcard (e.g., 'bookings.*' matches 'bookings.view')
        const [module] = p.split('.');
        if (user.permissions.includes(`${module}.*`)) return true;
        return false;
      });
    },
    [user]
  );

  /**
   * @deprecated Use usePermissions() from @/contexts/PermissionContext instead
   */
  const hasAllPermissions = useCallback(
    (permissions: string[]): boolean => {
      if (!user) return false;
      // Platform admin has all permissions
      if (user.isPlatformAdmin) return true;
      if (user.roleName === 'admin' || user.permissions.includes('*')) return true;
      return permissions.every((p) => {
        if (user.permissions.includes(p)) return true;
        // Check module wildcard (e.g., 'bookings.*' matches 'bookings.view')
        const [module] = p.split('.');
        if (user.permissions.includes(`${module}.*`)) return true;
        return false;
      });
    },
    [user]
  );

  const login = useCallback(
    async (email: string, password: string, rememberMe?: boolean): Promise<LoginResult> => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, rememberMe }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          if (data.requireTwoFactor) {
            return {
              success: true,
              requireTwoFactor: true,
              tempToken: data.tempToken,
            };
          }
          setUser(data.user);
          router.push('/');
          return { success: true };
        }

        return { success: false, error: data.error || 'Invalid email or password' };
      } catch (error) {
        console.error('Login error:', error);
        return { success: false, error: 'An error occurred during login' };
      } finally {
        setIsLoading(false);
      }
    },
    [router]
  );

  const completeTwoFactorLogin = useCallback(
    async (email: string, tempToken: string, code: string, rememberMe?: boolean): Promise<{ success: boolean; error?: string }> => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            tempToken,
            twoFactorCode: code,
            rememberMe,
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setUser(data.user);
          router.push('/');
          return { success: true };
        }

        return { success: false, error: data.error || 'Invalid verification code' };
      } catch (error) {
        console.error('2FA login error:', error);
        return { success: false, error: 'An error occurred during verification' };
      } finally {
        setIsLoading(false);
      }
    },
    [router]
  );

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, [router]);

  const refreshUser = useCallback(async () => {
    await fetchSession();
  }, [fetchSession]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isPlatformAdmin: !!user?.isPlatformAdmin,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        login,
        completeTwoFactorLogin,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
