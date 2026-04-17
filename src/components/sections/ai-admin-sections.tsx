'use client';
import { lazy } from 'react';

const AICopilot = lazy(() => import('@/components/ai/copilot').then(m => ({ default: m.AICopilot })));
const AIProviderSettings = lazy(() => import('@/components/ai/provider-settings').then(m => ({ default: m.AIProviderSettings })));
const AIInsights = lazy(() => import('@/components/ai/insights').then(m => ({ default: m.AIInsights })));
const TenantManagement = lazy(() => import('@/components/admin/tenant-management').then(m => ({ default: m.TenantManagement })));
const TenantLifecycle = lazy(() => import('@/components/admin/tenant-lifecycle').then(m => ({ default: m.TenantLifecycle })));
const UserManagement = lazy(() => import('@/components/admin/user-management').then(m => ({ default: m.UserManagement })));
const UsageTracking = lazy(() => import('@/components/admin/usage-tracking').then(m => ({ default: m.UsageTracking })));
const RevenueAnalytics = lazy(() => import('@/components/admin/revenue-analytics').then(m => ({ default: m.RevenueAnalytics })));
const SystemHealth = lazy(() => import('@/components/admin/system-health').then(m => ({ default: m.SystemHealth })));
const RolePermissions = lazy(() => import('@/components/admin/role-permissions').then(m => ({ default: m.RolePermissions })));
const GeneralSettingsComponent = lazy(() => import('@/components/settings/general').then(m => ({ default: m.GeneralSettingsComponent })));
const TaxCurrencySettings = lazy(() => import('@/components/settings/tax-currency').then(m => ({ default: m.TaxCurrencySettings })));
const LocalizationSettings = lazy(() => import('@/components/settings/localization').then(m => ({ default: m.LocalizationSettings })));
const FeatureFlags = lazy(() => import('@/components/settings/feature-flags').then(m => ({ default: m.FeatureFlags })));
const SecuritySettings = lazy(() => import('@/components/settings/security').then(m => ({ default: m.SecuritySettings })));
const SystemIntegrations = lazy(() => import('@/components/settings/system-integrations').then(m => ({ default: m.SystemIntegrations })));

export const aiAdminSections: Record<string, React.LazyExoticComponent<any>> = {
  AICopilot,
  AIProviderSettings,
  AIInsights,
  TenantManagement,
  TenantLifecycle,
  UserManagement,
  UsageTracking,
  RevenueAnalytics,
  SystemHealth,
  RolePermissions,
  GeneralSettingsComponent,
  TaxCurrencySettings,
  LocalizationSettings,
  FeatureFlags,
  SecuritySettings,
  SystemIntegrations,
};
