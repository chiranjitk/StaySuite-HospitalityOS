// Category loader: Chain
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'chain-brands':
      return import('@/components/chain/brand-management');
    case 'chain-dashboard':
      return import('@/components/chain/chain-dashboard');
    case 'chain-analytics':
      return import('@/components/chain/cross-property-analytics');
    default:
      throw new Error(`Unknown chain section: ${section}`);
  }
}
