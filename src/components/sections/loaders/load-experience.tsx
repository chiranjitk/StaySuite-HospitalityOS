// Category loader: Experience
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'experience-requests':
      return import('@/components/experience/service-requests');
    case 'experience-inbox':
      return import('@/components/communication/unified-inbox');
    case 'experience-chat':
      return import('@/components/experience/guest-chat');
    case 'experience-keys':
      return import('@/components/experience/digital-keys');
    case 'experience-portal':
      return import('@/components/experience/in-room-portal');
    case 'experience-app':
    case 'experience-app-controls':
      return import('@/components/experience/guest-app-controls');
    default:
      throw new Error(`Unknown experience section: ${section}`);
  }
}
