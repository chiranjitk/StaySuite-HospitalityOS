'use client';
import { lazy } from 'react';

const Folios = lazy(() => import('@/components/billing/folios').then(m => ({ default: m.Folios })));
const Invoices = lazy(() => import('@/components/billing/invoices').then(m => ({ default: m.Invoices })));
const Payments = lazy(() => import('@/components/billing/payments').then(m => ({ default: m.Payments })));
const Refunds = lazy(() => import('@/components/billing/refunds').then(m => ({ default: m.Refunds })));
const Discounts = lazy(() => import('@/components/billing/discounts').then(m => ({ default: m.Discounts })));
const SaaSPlans = lazy(() => import('@/components/billing/saas-plans').then(m => ({ default: m.SaaSPlans })));
const Subscriptions = lazy(() => import('@/components/billing/subscriptions').then(m => ({ default: m.Subscriptions })));
const UsageBilling = lazy(() => import('@/components/billing/usage-billing').then(m => ({ default: m.UsageBilling })));
const CancellationPolicies = lazy(() => import('@/components/billing/cancellation-policies').then(m => ({ default: m.CancellationPolicies })));

export const billingSections: Record<string, React.LazyExoticComponent<any>> = {
  Folios,
  Invoices,
  Payments,
  Refunds,
  Discounts,
  SaaSPlans,
  Subscriptions,
  UsageBilling,
  CancellationPolicies,
};
