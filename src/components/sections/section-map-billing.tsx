const sectionMap: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  'billing-folios': () => import('@/components/billing/folios'),
  'billing-invoices': () => import('@/components/billing/invoices'),
  'billing-payments': () => import('@/components/billing/payments'),
  'billing-refunds': () => import('@/components/billing/refunds'),
  'billing-discounts': () => import('@/components/billing/discounts'),
  'billing-cancellation-policies': () => import('@/components/billing/cancellation-policies'),
  'billing-saas-plans': () => import('@/components/billing/saas-plans'),
  'saas-plans': () => import('@/components/billing/saas-plans'),
  'billing-saas-subs': () => import('@/components/billing/subscriptions'),
  'saas-subscriptions': () => import('@/components/billing/subscriptions'),
  'billing-saas-usage': () => import('@/components/billing/usage-billing'),
  'saas-usage': () => import('@/components/billing/usage-billing'),
};

export const billingMap = sectionMap;
