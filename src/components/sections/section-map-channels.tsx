const sectionMap: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  'channel-ota': () => import('@/components/channels/ota-connections'),
  'channel-inventory': () => import('@/components/channels/inventory-sync'),
  'channel-rate': () => import('@/components/channels/rate-sync'),
  'channel-booking': () => import('@/components/channels/booking-sync'),
  'channel-restrictions': () => import('@/components/channels/restrictions'),
  'channel-mapping': () => import('@/components/channels/mapping'),
  'channel-logs': () => import('@/components/channels/sync-logs'),
  'channel-crs': () => import('@/components/channels/crs'),
};

export const channelsMap = sectionMap;
