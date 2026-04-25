// Category loader: Profile
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'profile':
    case 'profile-user':
      return import('@/components/profile/user-profile');
    default:
      throw new Error(`Unknown profile section: ${section}`);
  }
}
