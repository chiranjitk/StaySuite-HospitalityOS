// Category loader: Integrations
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'integrations-payment':
    case 'integrations-payments':
      return import('@/components/integrations/payment-gateways-page');
    case 'integrations-wifi':
      return import('@/components/integrations/wifi-gateways');
    case 'integrations-pos':
      return import('@/components/integrations/pos-systems');
    case 'integrations-apis':
      return import('@/components/integrations/third-party-apis');
    default:
      throw new Error(`Unknown integrations section: ${section}`);
  }
}
