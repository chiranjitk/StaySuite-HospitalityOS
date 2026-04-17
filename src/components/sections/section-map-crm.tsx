const sectionMap: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  'crm-segments': () => import('@/components/crm/guest-segments'),
  'crm-campaigns': () => import('@/components/crm/campaigns'),
  'crm-loyalty': () => import('@/components/crm/loyalty-programs'),
  'crm-feedback': () => import('@/components/crm/feedback-reviews'),
  'crm-retention': () => import('@/components/crm/retention-analytics'),
};

export const crmMap = sectionMap;
