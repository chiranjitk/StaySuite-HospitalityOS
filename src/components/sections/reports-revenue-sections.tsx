'use client';
import { lazy } from 'react';

const RevenueReports = lazy(() => import('@/components/reports/revenue-reports').then(m => ({ default: m.RevenueReports })));
const OccupancyReports = lazy(() => import('@/components/reports/occupancy-reports').then(m => ({ default: m.OccupancyReports })));
const ADRRevPAR = lazy(() => import('@/components/reports/adr-revpar').then(m => ({ default: m.ADRRevPAR })));
const GuestAnalyticsReports = lazy(() => import('@/components/reports/guest-analytics-reports').then(m => ({ default: m.GuestAnalyticsReports })));
const StaffPerformance = lazy(() => import('@/components/reports/staff-performance').then(m => ({ default: m.StaffPerformance })));
const ScheduledReports = lazy(() => import('@/components/reports/scheduled-reports').then(m => ({ default: m.ScheduledReports })));
const DemandForecastingPage = lazy(() => import('@/components/revenue/demand-forecasting-page').then(m => ({ default: m.default })));
const CompetitorPricing = lazy(() => import('@/components/revenue/competitor-pricing').then(m => ({ default: m.CompetitorPricing })));
const AISuggestions = lazy(() => import('@/components/revenue/ai-suggestions').then(m => ({ default: m.AISuggestions })));

export const reportsRevenueSections: Record<string, React.LazyExoticComponent<any>> = {
  RevenueReports,
  OccupancyReports,
  ADRRevPAR,
  GuestAnalyticsReports,
  StaffPerformance,
  ScheduledReports,
  DemandForecastingPage,
  CompetitorPricing,
  AISuggestions,
};
