// Category loader: Staff
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'staff-shifts':
    case 'staff-management':
      return import('@/components/staff/shift-scheduling');
    case 'staff-attendance':
      return import('@/components/staff/attendance-tracking');
    case 'staff-tasks':
      return import('@/components/staff/task-assignment');
    case 'staff-communication':
      return import('@/components/staff/internal-communication');
    case 'staff-performance':
      return import('@/components/reports/staff-performance');
    case 'staff-skills':
      return import('@/components/staff/skills-management');
    default:
      throw new Error(`Unknown staff section: ${section}`);
  }
}
