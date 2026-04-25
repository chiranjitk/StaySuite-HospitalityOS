const sectionMap: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  'pos-orders': () => import('@/components/pos/orders'),
  'pos-tables': () => import('@/components/pos/tables'),
  'pos-kitchen': () => import('@/components/pos/kitchen-display'),
  'pos-menu': () => import('@/components/pos/menu-management'),
  'pos-billing': () => import('@/components/pos/billing'),
};

export const posMap = sectionMap;
