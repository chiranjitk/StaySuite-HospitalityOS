const sectionMap: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  'pms-properties': () => import('@/components/pms/properties-list'),
  'pms-room-types': () => import('@/components/pms/room-types-manager'),
  'pms-rooms': () => import('@/components/pms/rooms-manager'),
  'pms-floor-plans': () => import('@/components/pms/floor-plans'),
  'pms-inventory-calendar': () => import('@/components/pms/inventory-calendar'),
  'pms-pricing-rules': () => import('@/components/pms/rate-plans-pricing-rules'),
  'pms-rate-plans': () => import('@/components/pms/rate-plans-pricing-rules'),
  'pms-rate-plans-pricing': () => import('@/components/pms/rate-plans-pricing-rules'),
  'pms-availability': () => import('@/components/pms/availability-control'),
  'pms-locking': () => import('@/components/pms/inventory-locking'),
  'pms-overbooking': () => import('@/components/pms/overbooking-settings'),
  'pms-bulk-price': () => import('@/components/pms/bulk-price-update'),
  'pms-revenue': () => import('@/components/pms/revenue-dashboard'),
};

export const pmsMap = sectionMap;
