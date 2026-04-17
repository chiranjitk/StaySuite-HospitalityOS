// Category loader: Dashboard
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'overview':
    case 'dashboard-overview':
      return import('@/components/dashboard/overview-dashboard');
    case 'dashboard-operations':
      return import('@/components/dashboard/frontdesk-dashboard');
    case 'dashboard-housekeeping':
      return import('@/components/dashboard/housekeeping-dashboard');
    case 'dashboard-command-center':
      return import('@/components/dashboard/command-center');
    case 'dashboard-alerts':
      return import('@/components/notifications/notification-center-page');
    case 'dashboard-kpi':
      return import('@/components/dashboard/kpi-dashboard-enhanced');
    default:
      throw new Error(`Unknown dashboard section: ${section}`);
  }
}
