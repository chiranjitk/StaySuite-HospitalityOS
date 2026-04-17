const sectionMap: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  'reports-revenue': () => import('@/components/reports/revenue-reports'),
  'reports-occupancy': () => import('@/components/reports/occupancy-reports'),
  'reports-adr': () => import('@/components/reports/adr-revpar'),
  'reports-revpar': () => import('@/components/reports/adr-revpar'),
  'reports-guest': () => import('@/components/reports/guest-analytics-reports'),
  'reports-guests': () => import('@/components/reports/guest-analytics-reports'),
  'reports-staff': () => import('@/components/reports/staff-performance'),
  'reports-scheduled': () => import('@/components/reports/scheduled-reports'),
};

export const reportsMap = sectionMap;
