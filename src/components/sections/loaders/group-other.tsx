// Group: Other (wifi, parking, iot, notifications, webhooks, ai, help, profile, ads, automation, integrations, gdpr, ui)
export default async function loadOtherSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  const prefix = section.split('-')[0];
  switch (prefix) {
    case 'wifi':
      return (await import('./load-wifi')).default(section);
    case 'parking':
      return (await import('./load-parking')).default(section);
    case 'iot':
      return (await import('./load-iot')).default(section);
    case 'notifications':
      return (await import('./load-notifications')).default(section);
    case 'webhooks':
      return (await import('./load-webhooks')).default(section);
    case 'ai':
      return (await import('./load-ai')).default(section);
    case 'help':
      return (await import('./load-help')).default(section);
    case 'profile':
      return (await import('./load-profile')).default(section);
    case 'ads':
      return (await import('./load-ads')).default(section);
    case 'automation':
      return (await import('./load-automation')).default(section);
    case 'integrations':
      return (await import('./load-integrations')).default(section);
    case 'gdpr':
      return (await import('./load-gdpr')).default(section);
    case 'ui':
      return (await import('./load-ui')).default(section);
    default:
      throw new Error(`Unknown other section: ${section}`);
  }
}
