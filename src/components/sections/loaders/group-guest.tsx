// Group: Guest experience (guests, experience, crm, marketing, events)
export default async function loadGuestSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  const prefix = section.split('-')[0];
  switch (prefix) {
    case 'guests':
      return (await import('./load-guests')).default(section);
    case 'experience':
      return (await import('./load-experience')).default(section);
    case 'crm':
      return (await import('./load-crm')).default(section);
    case 'marketing':
      return (await import('./load-marketing')).default(section);
    case 'events':
      return (await import('./load-events')).default(section);
    default:
      throw new Error(`Unknown guest section: ${section}`);
  }
}
