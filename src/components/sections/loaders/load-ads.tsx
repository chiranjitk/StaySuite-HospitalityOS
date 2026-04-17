// Category loader: Ads
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'ads-campaigns':
      return import('@/components/ads/ad-campaigns');
    case 'ads-google':
      return import('@/components/ads/google-hotel-ads');
    case 'ads-performance':
      return import('@/components/ads/performance-tracking');
    case 'ads-roi':
      return import('@/components/ads/roi-analytics');
    default:
      throw new Error(`Unknown ads section: ${section}`);
  }
}
