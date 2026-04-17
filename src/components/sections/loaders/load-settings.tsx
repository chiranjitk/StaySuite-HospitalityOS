// Category loader: Settings
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'settings-general':
      return import('@/components/settings/general');
    case 'settings-tax':
      return import('@/components/settings/tax-currency');
    case 'settings-localization':
      return import('@/components/settings/localization');
    case 'settings-features':
      return import('@/components/settings/feature-flags');
    case 'settings-security':
      return import('@/components/settings/security');
    case 'settings-integrations':
      return import('@/components/settings/system-integrations');
    case 'settings-gdpr':
      return import('@/components/gdpr/gdpr-manager');
    default:
      throw new Error(`Unknown settings section: ${section}`);
  }
}
