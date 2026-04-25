// Category loader: Events
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'events-spaces':
    case 'events-list':
      return import('@/components/events/event-spaces');
    case 'events-calendar':
      return import('@/components/events/event-calendar');
    case 'events-booking':
      return import('@/components/events/event-booking');
    case 'events-resources':
      return import('@/components/events/event-resources');
    default:
      throw new Error(`Unknown events section: ${section}`);
  }
}
