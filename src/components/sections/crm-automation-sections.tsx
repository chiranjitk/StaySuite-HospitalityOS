'use client';
import { lazy } from 'react';

const GuestSegments = lazy(() => import('@/components/crm/guest-segments').then(m => ({ default: m.GuestSegments })));
const Campaigns = lazy(() => import('@/components/crm/campaigns').then(m => ({ default: m.Campaigns })));
const LoyaltyPrograms = lazy(() => import('@/components/crm/loyalty-programs').then(m => ({ default: m.LoyaltyPrograms })));
const FeedbackReviews = lazy(() => import('@/components/crm/feedback-reviews').then(m => ({ default: m.FeedbackReviews })));
const RetentionAnalytics = lazy(() => import('@/components/crm/retention-analytics').then(m => ({ default: m.RetentionAnalytics })));
const WorkflowBuilder = lazy(() => import('@/components/automation/workflow-builder').then(m => ({ default: m.WorkflowBuilder })));
const RulesEngine = lazy(() => import('@/components/automation/rules-engine').then(m => ({ default: m.RulesEngine })));
const Templates = lazy(() => import('@/components/automation/templates').then(m => ({ default: m.Templates })));
const ExecutionLogs = lazy(() => import('@/components/automation/execution-logs').then(m => ({ default: m.ExecutionLogs })));

export const crmAutomationSections: Record<string, React.LazyExoticComponent<any>> = {
  GuestSegments,
  Campaigns,
  LoyaltyPrograms,
  FeedbackReviews,
  RetentionAnalytics,
  WorkflowBuilder,
  RulesEngine,
  Templates,
  ExecutionLogs,
};
