const sectionMap: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  'inventory-stock': () => import('@/components/inventory/stock-items'),
  'inventory-consumption': () => import('@/components/inventory/consumption-logs'),
  'inventory-alerts': () => import('@/components/inventory/low-stock-alerts'),
  'inventory-vendors': () => import('@/components/inventory/vendors'),
  'inventory-purchase-orders': () => import('@/components/inventory/purchase-orders'),
  'inventory-po': () => import('@/components/inventory/purchase-orders'),
};

export const inventoryMap = sectionMap;
