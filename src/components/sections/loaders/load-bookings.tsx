// Category loader: Bookings
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'bookings-list':
      return import('@/components/bookings/bookings-list');
    case 'bookings-calendar':
      return import('@/components/bookings/bookings-calendar-list');
    case 'bookings-groups':
    case 'group-bookings':
      return import('@/components/bookings/group-bookings');
    case 'bookings-waitlist':
      return import('@/components/bookings/waitlist');
    case 'bookings-audit':
      return import('@/components/bookings/audit-logs');
    case 'bookings-conflicts':
      return import('@/components/bookings/conflicts');
    case 'bookings-no-show':
      return import('@/components/bookings/no-show-automation');
    default:
      throw new Error(`Unknown bookings section: ${section}`);
  }
}
