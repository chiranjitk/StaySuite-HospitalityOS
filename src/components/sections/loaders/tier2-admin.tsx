// Tier 2: Admin & security
export default async function loadAdmin(section: string): Promise<{ default: React.ComponentType<any> }> {
  const prefix = section.split('-')[0];
  switch (prefix) {
    case 'admin':
      return (await import('./load-admin')).default(section);
    case 'settings':
      return (await import('./load-settings')).default(section);
    case 'security':
    case 'surveillance':
      return (await import('./load-security')).default(section);
    case 'chain':
      return (await import('./load-chain')).default(section);
    case 'channel':
      return (await import('./load-channels')).default(section);
    default:
      throw new Error(`Unknown admin section: ${section}`);
  }
}
