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
    case 'wifi-concurrent-sessions':
      return import('@/components/wifi/concurrent-sessions');
    case 'wifi-provisioning-logs':
      return import('@/components/wifi/provisioning-logs');
    case 'wifi-bandwidth-scheduler':
      return import('@/components/wifi/bandwidth-scheduler');
    case 'wifi-content-filter':
      return import('@/components/wifi/content-filter');
    case 'wifi-mac-auth':
      return import('@/components/wifi/mac-auth');
    case 'wifi-portal-whitelist':
      return import('@/components/wifi/portal-whitelist');
    case 'wifi-auth-logs':
      return import('@/components/wifi/auth-logs');
    case 'wifi-print-card':
      return import('@/components/wifi/print-card');
    case 'wifi-event-wifi':
      return import('@/components/wifi/event-wifi');
    case 'wifi-live-sessions':
      return import('@/components/wifi/live-sessions');
    case 'wifi-coa-audit':
      return import('@/components/wifi/coa-audit');
    case 'wifi-fap-policies':
      return import('@/components/wifi/fap-policies');
    case 'wifi-web-categories':
      return import('@/components/wifi/web-categories');
    case 'wifi-user-status-history':
      return import('@/components/wifi/user-status-history');
    case 'wifi-nas-health':
      return import('@/components/wifi/nas-health');
    case 'wifi-bw-policy-details':
      return import('@/components/wifi/bw-policy-details');
    default:
      throw new Error(`Unknown wifi section: ${section}`);
  }
}
