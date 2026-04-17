'use client';
import { lazy } from 'react';

const KPICards = lazy(() => import('@/components/dashboard/kpi-cards').then(m => ({ default: m.KPICards })));
const KPIDashboardEnhanced = lazy(() => import('@/components/dashboard/kpi-dashboard-enhanced').then(m => ({ default: m.KPIDashboardEnhanced })));
const OverviewDashboard = lazy(() => import('@/components/dashboard/overview-dashboard').then(m => ({ default: m.OverviewDashboard })));
const CommandCenter = lazy(() => import('@/components/dashboard/command-center').then(m => ({ default: m.CommandCenter })));
const AlertsPanel = lazy(() => import('@/components/dashboard/alerts-panel').then(m => ({ default: m.AlertsPanel })));
const HousekeepingDashboard = lazy(() => import('@/components/dashboard/housekeeping-dashboard').then(m => ({ default: m.HousekeepingDashboard })));
const FrontDeskDashboard = lazy(() => import('@/components/dashboard/frontdesk-dashboard').then(m => ({ default: m.FrontDeskDashboard })));

export const dashboardSections: Record<string, React.LazyExoticComponent<any>> = {
  KPICards,
  KPIDashboardEnhanced,
  OverviewDashboard,
  CommandCenter,
  AlertsPanel,
  HousekeepingDashboard,
  FrontDeskDashboard,
};
