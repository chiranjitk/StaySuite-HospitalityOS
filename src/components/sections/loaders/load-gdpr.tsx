// Category loader: GDPR
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'settings-gdpr':
    case 'admin-gdpr':
    case 'gdpr-compliance':
      return import('@/components/gdpr/gdpr-manager');
    default:
      throw new Error(`Unknown gdpr section: ${section}`);
  }
}
