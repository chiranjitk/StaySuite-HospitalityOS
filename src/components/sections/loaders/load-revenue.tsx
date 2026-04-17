// Category loader: Revenue
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'revenue-pricing':
    case 'revenue-rules':
    case 'revenue-rates':
      return import('@/components/pms/rate-plans-pricing-rules');
    case 'revenue-forecast':
    case 'revenue-demand':
    case 'revenue-forecasting':
      return import('@/components/revenue/demand-forecasting-page');
    case 'revenue-competitor':
    case 'revenue-compset':
      return import('@/components/revenue/competitor-pricing');
    case 'revenue-ai':
    case 'revenue-suggestions':
      return import('@/components/revenue/ai-suggestions');
    default:
      throw new Error(`Unknown revenue section: ${section}`);
  }
}
