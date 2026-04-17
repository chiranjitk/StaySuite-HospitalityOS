const sectionMap: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  'staff-shifts': () => import('@/components/staff/shift-scheduling'),
  'staff-attendance': () => import('@/components/staff/attendance-tracking'),
  'staff-tasks': () => import('@/components/staff/task-assignment'),
  'staff-communication': () => import('@/components/staff/internal-communication'),
  'staff-performance': () => import('@/components/reports/staff-performance'),
  'staff-skills': () => import('@/components/staff/skills-management'),
};

export const staffMap = sectionMap;
