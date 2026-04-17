const sectionMap: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  'dashboard-overview': () => import('@/components/dashboard/overview-dashboard'),
  'overview': () => import('@/components/dashboard/overview-dashboard'),
  'dashboard-operations': () => import('@/components/dashboard/frontdesk-dashboard'),
  'dashboard-housekeeping': () => import('@/components/dashboard/housekeeping-dashboard'),
  'dashboard-command-center': () => import('@/components/dashboard/command-center'),
  'dashboard-alerts': () => import('@/components/notifications/notification-center-page'),
  'dashboard-kpi': () => import('@/components/dashboard/kpi-dashboard-enhanced'),
};

export const dashboardMap = sectionMap;
