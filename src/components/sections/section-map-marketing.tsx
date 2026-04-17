const sectionMap: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  'marketing-reputation': () => import('@/components/marketing/reputation-dashboard'),
  'marketing-reviews': () => import('@/components/marketing/review-sources'),
  'marketing-sources': () => import('@/components/marketing/review-sources'),
  'marketing-promotions': () => import('@/components/crm/campaigns'),
  'marketing-booking-engine': () => import('@/components/marketing/direct-booking-engine'),
};

export const marketingMap = sectionMap;
