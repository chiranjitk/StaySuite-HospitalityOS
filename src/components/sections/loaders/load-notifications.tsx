// Category loader: Notifications
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'notifications-templates':
      return import('@/components/notifications/templates');
    case 'notifications-logs':
      return import('@/components/notifications/delivery-logs');
    case 'notifications-settings':
      return import('@/components/notifications/settings');
    default:
      throw new Error(`Unknown notifications section: ${section}`);
  }
}
