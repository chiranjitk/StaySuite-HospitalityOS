// Category loader: UI Showcase
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'ui-showcase':
      return import('@/components/showcase/ui-style-showcase');
    default:
      throw new Error(`Unknown ui section: ${section}`);
  }
}
