// Category loader: WiFi
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'wifi-sessions':
      return import('@/components/wifi/sessions');
    case 'wifi-vouchers':
      return import('@/components/wifi/vouchers');
    case 'wifi-plans':
      return import('@/components/wifi/plans');
    case 'wifi-logs':
      return import('@/components/wifi/usage-logs');
    case 'wifi-gateway':
      return import('@/components/wifi/gateway-integration');
    case 'wifi-aaa':
      return import('@/components/wifi/aaa-config');
    case 'wifi-network':
      return import('@/components/wifi/network-page');
    case 'wifi-dhcp':
      return import('@/components/wifi/dhcp-page');
    case 'wifi-portal':
      return import('@/components/wifi/portal-page');
    case 'wifi-firewall':
      return import('@/components/wifi/firewall-page');
    case 'wifi-reports':
      return import('@/components/wifi/reports-page');
    case 'wifi-access':
      return import('@/components/wifi/wifi-access-page');
    case 'wifi-gateway-radius':
      return import('@/components/wifi/gateway-radius-page');
    case 'wifi-dns':
      return import('@/components/wifi/dns-page');
    default:
      throw new Error(`Unknown wifi section: ${section}`);
  }
}
