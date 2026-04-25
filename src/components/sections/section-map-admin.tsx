const sectionMap: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  'admin-tenants': () => import('@/components/admin/tenant-management'),
  'admin-tenant-lifecycle': () => import('@/components/admin/tenant-lifecycle'),
  'admin-lifecycle': () => import('@/components/admin/tenant-lifecycle'),
  'admin-users': () => import('@/components/admin/user-management'),
  'admin-usage': () => import('@/components/admin/usage-tracking'),
  'admin-revenue': () => import('@/components/admin/revenue-analytics'),
  'admin-health': () => import('@/components/admin/system-health'),
  'admin-roles': () => import('@/components/admin/role-permissions'),
};

export const adminMap = sectionMap;
