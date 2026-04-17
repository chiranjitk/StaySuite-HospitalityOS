// Category loader: Admin
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'admin-tenants':
      return import('@/components/admin/tenant-management');
    case 'admin-tenant-lifecycle':
    case 'admin-lifecycle':
      return import('@/components/admin/tenant-lifecycle');
    case 'admin-users':
      return import('@/components/admin/user-management');
    case 'admin-usage':
      return import('@/components/admin/usage-tracking');
    case 'admin-revenue':
      return import('@/components/admin/revenue-analytics');
    case 'admin-health':
      return import('@/components/admin/system-health');
    case 'admin-roles':
      return import('@/components/admin/role-permissions');
    default:
      throw new Error(`Unknown admin section: ${section}`);
  }
}
