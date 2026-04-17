// Category loader: Channels
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'channel-ota':
    case 'channel-connections':
      return import('@/components/channels/ota-connections');
    case 'channel-inventory':
      return import('@/components/channels/inventory-sync');
    case 'channel-rate':
      return import('@/components/channels/rate-sync');
    case 'channel-booking':
      return import('@/components/channels/booking-sync');
    case 'channel-restrictions':
      return import('@/components/channels/restrictions');
    case 'channel-mapping':
      return import('@/components/channels/mapping');
    case 'channel-logs':
      return import('@/components/channels/sync-logs');
    case 'channel-crs':
      return import('@/components/channels/crs');
    default:
      throw new Error(`Unknown channel section: ${section}`);
  }
}
