// Category loader: Billing
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'billing-folios':
      return import('@/components/billing/folios');
    case 'billing-invoices':
      return import('@/components/billing/invoices');
    case 'billing-payments':
      return import('@/components/billing/payments');
    case 'billing-refunds':
      return import('@/components/billing/refunds');
    case 'billing-discounts':
      return import('@/components/billing/discounts');
    case 'billing-cancellation-policies':
      return import('@/components/billing/cancellation-policies');
    case 'billing-saas-plans':
    case 'saas-plans':
      return import('@/components/billing/saas-plans');
    case 'billing-saas-subs':
    case 'saas-subscriptions':
      return import('@/components/billing/subscriptions');
    case 'billing-saas-usage':
    case 'saas-usage':
      return import('@/components/billing/usage-billing');
    case 'folio-transfer':
      return import('@/components/billing/folio-transfer');
    case 'payment-plans':
      return import('@/components/billing/payment-plans');
    case 'credit-notes':
      return import('@/components/billing/credit-notes');
    case 'multi-currency':
      return import('@/components/billing/multi-currency');
    default:
      throw new Error(`Unknown billing section: ${section}`);
  }
}
