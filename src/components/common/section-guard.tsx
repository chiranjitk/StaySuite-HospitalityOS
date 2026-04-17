'use client';

import { usePermissions } from '@/contexts/PermissionContext';
import { ShieldX } from 'lucide-react';

interface SectionGuardProps {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function SectionGuard({ permission, children, fallback }: SectionGuardProps) {
  const { hasPermission } = usePermissions();

  if (!hasPermission(permission)) {
    if (fallback) return <>{fallback}</>;
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20">
          <ShieldX className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-foreground">Access Denied</h2>
          <p className="text-muted-foreground max-w-md">
            You don&apos;t have permission to access this section.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
