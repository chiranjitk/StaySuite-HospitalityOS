// Category loader: POS
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'pos-orders':
      return import('@/components/pos/orders');
    case 'pos-tables':
      return import('@/components/pos/tables');
    case 'pos-kitchen':
      return import('@/components/pos/kitchen-display');
    case 'pos-menu':
      return import('@/components/pos/menu-management');
    case 'pos-billing':
      return import('@/components/pos/billing');
    default:
      throw new Error(`Unknown pos section: ${section}`);
  }
}
