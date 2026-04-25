// Tier 2: Core operations
export default async function loadCore(section: string): Promise<{ default: React.ComponentType<any> }> {
  const prefix = section.split('-')[0];
  switch (prefix) {
    case 'dashboard':
    case 'overview':
      return (await import('./load-dashboard')).default(section);
    case 'pms':
    case 'rooms':
    case 'room':
      if (section === 'room-move') {
        return (await import('./load-frontdesk')).default(section);
      }
      return (await import('./load-pms')).default(section);
    case 'bookings':
    case 'group':
      return (await import('./load-bookings')).default(section);
    case 'frontdesk':
    case 'front':
    case 'registration':
    case 'express':
      return (await import('./load-frontdesk')).default(section);
    case 'revenue':
      return (await import('./load-revenue')).default(section);
    default:
      throw new Error(`Unknown core section: ${section}`);
  }
}
