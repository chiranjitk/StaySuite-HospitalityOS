const sectionMap: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  'revenue-pricing': () => import('@/components/pms/rate-plans-pricing-rules'),
  'revenue-rules': () => import('@/components/pms/rate-plans-pricing-rules'),
  'revenue-forecast': () => import('@/components/revenue/demand-forecasting-page'),
  'revenue-demand': () => import('@/components/revenue/demand-forecasting-page'),
  'revenue-forecasting': () => import('@/components/revenue/demand-forecasting-page'),
  'revenue-competitor': () => import('@/components/revenue/competitor-pricing'),
  'revenue-compset': () => import('@/components/revenue/competitor-pricing'),
  'revenue-ai': () => import('@/components/revenue/ai-suggestions'),
  'revenue-suggestions': () => import('@/components/revenue/ai-suggestions'),
};

export const revenueMap = sectionMap;
