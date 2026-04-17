'use client';
import { lazy } from 'react';

const BrandManagement = lazy(() => import('@/components/chain/brand-management').then(m => ({ default: m.BrandManagement })));
const ChainDashboard = lazy(() => import('@/components/chain/chain-dashboard').then(m => ({ default: m.ChainDashboard })));
const CrossPropertyAnalytics = lazy(() => import('@/components/chain/cross-property-analytics').then(m => ({ default: m.CrossPropertyAnalytics })));
const ReputationDashboard = lazy(() => import('@/components/marketing/reputation-dashboard').then(m => ({ default: m.ReputationDashboard })));
const ReviewSources = lazy(() => import('@/components/marketing/review-sources').then(m => ({ default: m.ReviewSources })));
const DirectBookingEngine = lazy(() => import('@/components/marketing/direct-booking-engine').then(m => ({ default: m.DirectBookingEngine })));
const EventSpaces = lazy(() => import('@/components/events/event-spaces').then(m => ({ default: m.EventSpaces })));
const EventCalendar = lazy(() => import('@/components/events/event-calendar').then(m => ({ default: m.EventCalendar })));
const EventBooking = lazy(() => import('@/components/events/event-booking').then(m => ({ default: m.EventBooking })));
const EventResources = lazy(() => import('@/components/events/event-resources').then(m => ({ default: m.EventResources })));

export const chainMarketingEventsSections: Record<string, React.LazyExoticComponent<any>> = {
  BrandManagement,
  ChainDashboard,
  CrossPropertyAnalytics,
  ReputationDashboard,
  ReviewSources,
  DirectBookingEngine,
  EventSpaces,
  EventCalendar,
  EventBooking,
  EventResources,
};
