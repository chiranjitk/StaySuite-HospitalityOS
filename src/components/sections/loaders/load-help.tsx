// Category loader: Help
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'help-center':
      return import('@/components/help/help-center-landing');
    case 'help-articles':
      return import('@/components/help/articles-library');
    case 'help-tutorials':
      return import('@/components/help/tutorial-progress-page');
    default:
      throw new Error(`Unknown help section: ${section}`);
  }
}
