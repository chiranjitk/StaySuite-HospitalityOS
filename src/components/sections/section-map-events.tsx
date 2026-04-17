const sectionMap: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  'events-spaces': () => import('@/components/events/event-spaces'),
  'events-calendar': () => import('@/components/events/event-calendar'),
  'events-booking': () => import('@/components/events/event-booking'),
  'events-resources': () => import('@/components/events/event-resources'),
};

export const eventsMap = sectionMap;
