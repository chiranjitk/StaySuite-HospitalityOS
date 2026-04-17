// Category loader: Webhooks
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'webhooks-events':
      return import('@/components/webhooks/events');
    case 'webhooks-delivery':
      return import('@/components/webhooks/delivery');
    case 'webhooks-retry':
      return import('@/components/webhooks/retry-queue');
    default:
      throw new Error(`Unknown webhooks section: ${section}`);
  }
}
