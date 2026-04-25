'use client';
import { lazy } from 'react';

const DeviceManagement = lazy(() => import('@/components/iot/device-management').then(m => ({ default: m.DeviceManagement })));
const RoomControls = lazy(() => import('@/components/iot/room-controls').then(m => ({ default: m.RoomControls })));
const EnergyDashboard = lazy(() => import('@/components/iot/energy-dashboard').then(m => ({ default: m.EnergyDashboard })));
const ShiftScheduling = lazy(() => import('@/components/staff/shift-scheduling').then(m => ({ default: m.ShiftScheduling })));
const AttendanceTracking = lazy(() => import('@/components/staff/attendance-tracking').then(m => ({ default: m.AttendanceTracking })));
const TaskAssignment = lazy(() => import('@/components/staff/task-assignment').then(m => ({ default: m.TaskAssignment })));
const InternalCommunication = lazy(() => import('@/components/staff/internal-communication').then(m => ({ default: m.InternalCommunication })));
const SkillsManagement = lazy(() => import('@/components/staff/skills-management').then(m => ({ default: m.SkillsManagement })));
const HelpCenterLanding = lazy(() => import('@/components/help/help-center-landing').then(m => ({ default: m.HelpCenterLanding })));
const ArticlesLibrary = lazy(() => import('@/components/help/articles-library').then(m => ({ default: m.ArticlesLibrary })));
const TutorialProgressPage = lazy(() => import('@/components/help/tutorial-progress-page').then(m => ({ default: m.TutorialProgressPage })));
const ArticleViewer = lazy(() => import('@/components/help/article-viewer').then(m => ({ default: m.ArticleViewer })));
const UserProfile = lazy(() => import('@/components/profile/user-profile').then(m => ({ default: m.UserProfile })));
const UIStyleShowcase = lazy(() => import('@/components/showcase/ui-style-showcase').then(m => ({ default: m.UIStyleShowcase })));
const GDPRManager = lazy(() => import('@/components/gdpr/gdpr-manager').then(m => ({ default: m.GDPRManager })));
const AdCampaigns = lazy(() => import('@/components/ads/ad-campaigns').then(m => ({ default: m.AdCampaigns })));
const GoogleHotelAds = lazy(() => import('@/components/ads/google-hotel-ads').then(m => ({ default: m.GoogleHotelAds })));
const PerformanceTracking = lazy(() => import('@/components/ads/performance-tracking').then(m => ({ default: m.PerformanceTracking })));
const ROIAnalytics = lazy(() => import('@/components/ads/roi-analytics').then(m => ({ default: m.ROIAnalytics })));

export const iotStaffHelpAdsSections: Record<string, React.LazyExoticComponent<any>> = {
  DeviceManagement,
  RoomControls,
  EnergyDashboard,
  ShiftScheduling,
  AttendanceTracking,
  TaskAssignment,
  InternalCommunication,
  SkillsManagement,
  HelpCenterLanding,
  ArticlesLibrary,
  TutorialProgressPage,
  ArticleViewer,
  UserProfile,
  UIStyleShowcase,
  GDPRManager,
  AdCampaigns,
  GoogleHotelAds,
  PerformanceTracking,
  ROIAnalytics,
};
