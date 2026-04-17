const sectionMap: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  'housekeeping-tasks': () => import('@/components/housekeeping/tasks-list'),
  'housekeeping-kanban': () => import('@/components/housekeeping/kanban-board'),
  'housekeeping-status': () => import('@/components/housekeeping/room-status'),
  'housekeeping-maintenance': () => import('@/components/housekeeping/maintenance'),
  'housekeeping-preventive': () => import('@/components/housekeeping/maintenance'),
  'housekeeping-assets': () => import('@/components/housekeeping/assets'),
  'housekeeping-automation': () => import('@/components/housekeeping/housekeeping-automation'),
  'housekeeping-inspections': () => import('@/components/housekeeping/inspection-checklists'),
};

export const housekeepingMap = sectionMap;
