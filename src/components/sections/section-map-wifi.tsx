const sectionMap: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  'wifi-sessions': () => import('@/components/wifi/sessions'),
  'wifi-vouchers': () => import('@/components/wifi/vouchers'),
  'wifi-plans': () => import('@/components/wifi/plans'),
  'wifi-logs': () => import('@/components/wifi/usage-logs'),
  'wifi-gateway': () => import('@/components/wifi/gateway-integration'),
  'wifi-aaa': () => import('@/components/wifi/aaa-config'),
  'wifi-network': () => import('@/components/wifi/network-page'),
  'wifi-dhcp': () => import('@/components/wifi/dhcp-page'),
  'wifi-portal': () => import('@/components/wifi/portal-page'),
  'wifi-firewall': () => import('@/components/wifi/firewall-page'),
  'wifi-reports': () => import('@/components/wifi/reports-page'),
  'wifi-access': () => import('@/components/wifi/wifi-access-page'),
  'wifi-gateway-radius': () => import('@/components/wifi/gateway-radius-page'),
  'wifi-dns': () => import('@/components/wifi/dns-page'),
};

export const wifiMap = sectionMap;
