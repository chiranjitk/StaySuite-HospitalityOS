// Category loader: PMS
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'pms-properties':
      return import('@/components/pms/properties-list');
    case 'pms-room-types':
      return import('@/components/pms/room-types-manager');
    case 'pms-rooms':
    case 'rooms-list':
      return import('@/components/pms/rooms-manager');
    case 'pms-floor-plans':
      return import('@/components/pms/floor-plans');
    case 'pms-inventory-calendar':
      return import('@/components/pms/inventory-calendar');
    case 'pms-pricing-rules':
    case 'pms-rate-plans':
    case 'pms-rate-plans-pricing':
      return import('@/components/pms/rate-plans-pricing-rules');
    case 'pms-availability':
      return import('@/components/pms/availability-control');
    case 'pms-locking':
      return import('@/components/pms/inventory-locking');
    case 'pms-overbooking':
      return import('@/components/pms/overbooking-settings');
    case 'pms-bulk-price':
      return import('@/components/pms/bulk-price-update');
    case 'pms-revenue':
      return import('@/components/pms/revenue-dashboard');
    default:
      throw new Error(`Unknown pms section: ${section}`);
  }
}
