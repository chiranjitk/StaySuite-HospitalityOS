'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const UserManagement = dynamic(
  () => import('@/components/admin/user-management').then(mod => {
    const Component = mod.default || mod.UserManagement;
    if (!Component) {
      throw new Error('UserManagement component not found in module');
    }
    return { default: Component };
  }),
  {
    loading: () => (
      <div className="flex flex-col items-center justify-center h-64 space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        <p className="text-sm text-muted-foreground">Loading User Management...</p>
      </div>
    ),
    ssr: false,
  }
);

export default function UserManagementWrapper() {
  return <UserManagement />;
}
