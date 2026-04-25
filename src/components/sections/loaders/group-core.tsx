// Group: Core operations (dashboard, pms, bookings, frontdesk, revenue)
export default async function loadCoreSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  const prefix = section.split('-')[0];
  switch (prefix) {
    case 'dashboard':
    case 'overview':
      return (await import('./load-dashboard')).default(section);
    case 'pms':
      return (await import('./load-pms')).default(section);
    case 'bookings':
      return (await import('./load-bookings')).default(section);
    case 'frontdesk':
      return (await import('./load-frontdesk')).default(section);
    case 'revenue':
      return (await import('./load-revenue')).default(section);
    default:
      throw new Error(`Unknown core section: ${section}`);
  }
}
