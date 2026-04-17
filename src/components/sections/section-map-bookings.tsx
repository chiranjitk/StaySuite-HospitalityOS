const sectionMap: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  'bookings-calendar': () => import('@/components/bookings/bookings-calendar-list'),
  'bookings-groups': () => import('@/components/bookings/group-bookings'),
  'bookings-waitlist': () => import('@/components/bookings/waitlist'),
  'bookings-audit': () => import('@/components/bookings/audit-logs'),
  'bookings-conflicts': () => import('@/components/bookings/conflicts'),
  'bookings-no-show': () => import('@/components/bookings/no-show-automation'),
};

export const bookingsMap = sectionMap;
