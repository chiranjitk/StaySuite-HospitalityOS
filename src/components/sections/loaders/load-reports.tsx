// Category loader: Reports
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'reports-revenue':
      return import('@/components/reports/revenue-reports');
    case 'reports-occupancy':
      return import('@/components/reports/occupancy-reports');
    case 'reports-adr':
    case 'reports-revpar':
      return import('@/components/reports/adr-revpar');
    case 'reports-guest':
    case 'reports-guests':
      return import('@/components/reports/guest-analytics-reports');
    case 'reports-staff':
      return import('@/components/reports/staff-performance');
    case 'reports-scheduled':
      return import('@/components/reports/scheduled-reports');
    default:
      throw new Error(`Unknown reports section: ${section}`);
  }
}
