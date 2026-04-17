const sectionMap: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  'chain-brands': () => import('@/components/chain/brand-management'),
  'chain-dashboard': () => import('@/components/chain/chain-dashboard'),
  'chain-analytics': () => import('@/components/chain/cross-property-analytics'),
};

export const chainMap = sectionMap;
