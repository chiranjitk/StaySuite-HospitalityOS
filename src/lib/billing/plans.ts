/**
 * Server-side SaaS Plan Configuration
 * 
 * Single source of truth for plan definitions, pricing, and limits.
 * All billing calculations and plan management MUST use this module.
 * Plans are validated server-side — never trust client-side values.
 */

export interface PlanFeature {
  name: string;
  included: boolean;
  limit?: string;
}

export interface SaaSPlanConfig {
  id: string;
  name: string;
  displayName: string;
  description: string;
  price: number;
  currency: string;
  billingPeriod: 'monthly' | 'yearly';
  maxProperties: number;
  maxUsers: number;
  maxRooms: number;
  storageLimitMb: number;
  features: PlanFeature[];
  isPopular?: boolean;
  isCustom?: boolean;
}

// Default plan configurations — authoritative source
const defaultPlans: SaaSPlanConfig[] = [
  {
    id: 'trial',
    name: 'trial',
    displayName: 'Trial',
    description: 'Try StaySuite free for 14 days',
    price: 0,
    currency: 'USD',
    billingPeriod: 'monthly',
    maxProperties: 1,
    maxUsers: 3,
    maxRooms: 20,
    storageLimitMb: 500,
    features: [
      { name: 'Basic PMS features', included: true },
      { name: 'Front Desk operations', included: true },
      { name: 'Guest management', included: true },
      { name: 'Basic reports', included: true },
      { name: 'Channel manager', included: false },
      { name: 'Advanced analytics', included: false },
      { name: 'API access', included: false },
      { name: 'Custom branding', included: false },
    ],
  },
  {
    id: 'starter',
    name: 'starter',
    displayName: 'Starter',
    description: 'Perfect for small properties',
    price: 99,
    currency: 'USD',
    billingPeriod: 'monthly',
    maxProperties: 1,
    maxUsers: 5,
    maxRooms: 50,
    storageLimitMb: 1000,
    features: [
      { name: 'Full PMS features', included: true },
      { name: 'Front Desk operations', included: true },
      { name: 'Guest management', included: true },
      { name: 'All reports', included: true },
      { name: 'Channel manager', included: true },
      { name: 'Email support', included: true },
      { name: 'Advanced analytics', included: false },
      { name: 'API access', included: false },
      { name: 'Custom branding', included: false },
    ],
  },
  {
    id: 'professional',
    name: 'professional',
    displayName: 'Professional',
    description: 'For growing hospitality businesses',
    price: 499,
    currency: 'USD',
    billingPeriod: 'monthly',
    maxProperties: 5,
    maxUsers: 25,
    maxRooms: 200,
    storageLimitMb: 5000,
    isPopular: true,
    features: [
      { name: 'Everything in Starter', included: true },
      { name: 'Multi-property support', included: true },
      { name: 'Advanced analytics', included: true },
      { name: 'API access', included: true },
      { name: 'Custom integrations', included: true },
      { name: 'Priority support', included: true },
      { name: 'Mobile app access', included: true },
      { name: 'Custom branding', included: false },
      { name: 'Dedicated account manager', included: false },
    ],
  },
  {
    id: 'enterprise',
    name: 'enterprise',
    displayName: 'Enterprise',
    description: 'Custom solutions for large organizations',
    price: 1999,
    currency: 'USD',
    billingPeriod: 'monthly',
    maxProperties: 999,
    maxUsers: 999,
    maxRooms: 9999,
    storageLimitMb: 50000,
    isCustom: true,
    features: [
      { name: 'Everything in Professional', included: true },
      { name: 'Unlimited properties', included: true },
      { name: 'Custom branding', included: true },
      { name: 'Dedicated account manager', included: true },
      { name: 'SLA guarantee', included: true },
      { name: 'On-premise option', included: true },
      { name: 'Custom development', included: true },
      { name: '24/7 phone support', included: true },
    ],
  },
];

// In-memory plan registry — can be extended with DB persistence
let planRegistry: SaaSPlanConfig[] = [...defaultPlans];

/**
 * Get all plan configurations
 */
export function getPlans(): SaaSPlanConfig[] {
  return [...planRegistry];
}

/**
 * Get a single plan by ID (or plan name)
 */
export function getPlan(planId: string): SaaSPlanConfig | undefined {
  return planRegistry.find(p => p.id === planId || p.name === planId);
}

/**
 * Get plan price by plan name — used for revenue calculations
 */
export function getPlanPrice(planName: string): number {
  const plan = getPlan(planName);
  return plan?.price ?? 0;
}

/**
 * Create a new plan configuration
 */
export function createPlan(config: SaaSPlanConfig): SaaSPlanConfig {
  if (planRegistry.some(p => p.id === config.id || p.name === config.name)) {
    throw new Error(`Plan with id "${config.id}" or name "${config.name}" already exists`);
  }
  planRegistry.push(config);
  return config;
}

/**
 * Update an existing plan configuration
 */
export function updatePlan(planId: string, updates: Partial<Omit<SaaSPlanConfig, 'id' | 'name'>>): SaaSPlanConfig | undefined {
  const index = planRegistry.findIndex(p => p.id === planId);
  if (index === -1) return undefined;
  planRegistry[index] = { ...planRegistry[index], ...updates };
  return planRegistry[index];
}

/**
 * Soft-delete a plan by marking it inactive (remove from registry)
 * Returns the removed plan or undefined
 */
export function deletePlan(planId: string): SaaSPlanConfig | undefined {
  const index = planRegistry.findIndex(p => p.id === planId);
  if (index === -1) return undefined;
  const [removed] = planRegistry.splice(index, 1);
  return removed;
}

/**
 * Validate plan update payload server-side
 */
export function validatePlanPayload(payload: Record<string, unknown>): { valid: boolean; error?: string } {
  if (typeof payload.displayName !== 'string' || payload.displayName.trim().length === 0) {
    return { valid: false, error: 'displayName is required' };
  }
  if (payload.price !== undefined && (typeof payload.price !== 'number' || payload.price < 0)) {
    return { valid: false, error: 'price must be a non-negative number' };
  }
  if (payload.maxProperties !== undefined && (typeof payload.maxProperties !== 'number' || payload.maxProperties < 1)) {
    return { valid: false, error: 'maxProperties must be a positive integer' };
  }
  if (payload.maxUsers !== undefined && (typeof payload.maxUsers !== 'number' || payload.maxUsers < 1)) {
    return { valid: false, error: 'maxUsers must be a positive integer' };
  }
  if (payload.maxRooms !== undefined && (typeof payload.maxRooms !== 'number' || payload.maxRooms < 1)) {
    return { valid: false, error: 'maxRooms must be a positive integer' };
  }
  if (payload.storageLimitMb !== undefined && (typeof payload.storageLimitMb !== 'number' || payload.storageLimitMb < 100)) {
    return { valid: false, error: 'storageLimitMb must be at least 100' };
  }
  return { valid: true };
}

/**
 * Get usage-based billing rates per plan
 * These rates are applied server-side for overage calculations
 */
export interface OverageRates {
  apiCallOveragePerUnit: number;    // per API call over limit
  storageOveragePerMb: number;       // per MB over storage limit
  messageOveragePerUnit: number;     // per message over limit
}

export function getOverageRates(planName: string): OverageRates {
  switch (planName) {
    case 'enterprise':
      return { apiCallOveragePerUnit: 0.0005, storageOveragePerMb: 0.05, messageOveragePerUnit: 0.005 };
    case 'professional':
      return { apiCallOveragePerUnit: 0.001, storageOveragePerMb: 0.10, messageOveragePerUnit: 0.01 };
    case 'starter':
      return { apiCallOveragePerUnit: 0.002, storageOveragePerMb: 0.15, messageOveragePerUnit: 0.02 };
    default:
      return { apiCallOveragePerUnit: 0.001, storageOveragePerMb: 0.10, messageOveragePerUnit: 0.01 };
  }
}

/**
 * Calculate API call limit for a given plan
 */
export function getApiCallLimit(planName: string): number {
  const plan = getPlan(planName);
  if (!plan) return 5000;
  switch (planName) {
    case 'enterprise': return 500000;
    case 'professional': return 100000;
    case 'starter': return 25000;
    default: return 5000;
  }
}

/**
 * Calculate message limit for a given plan
 */
export function getMessageLimit(planName: string): number {
  switch (planName) {
    case 'enterprise': return 100000;
    case 'professional': return 50000;
    case 'starter': return 10000;
    default: return 5000;
  }
}
