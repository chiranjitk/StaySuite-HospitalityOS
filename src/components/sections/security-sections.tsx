'use client';
import { lazy } from 'react';

const LiveCamera = lazy(() => import('@/components/security/live-camera').then(m => ({ default: m.LiveCamera })));
const CameraPlayback = lazy(() => import('@/components/security/camera-playback').then(m => ({ default: m.CameraPlayback })));
const Incidents = lazy(() => import('@/components/security/incidents').then(m => ({ default: m.Incidents })));
const TwoFactorSetup = lazy(() => import('@/components/security/two-factor-setup').then(m => ({ default: m.TwoFactorSetup })));
const DeviceSessions = lazy(() => import('@/components/security/device-sessions').then(m => ({ default: m.DeviceSessions })));
const SecurityOverview = lazy(() => import('@/components/security/security-overview').then(m => ({ default: m.SecurityOverview })));
const SSOConfig = lazy(() => import('@/components/security/sso-config').then(m => ({ default: m.SSOConfig })));
const AuditLogsViewer = lazy(() => import('@/components/audit/audit-logs-viewer').then(m => ({ default: m.AuditLogsViewer })));

export const securitySections: Record<string, React.LazyExoticComponent<any>> = {
  LiveCamera,
  CameraPlayback,
  Incidents,
  TwoFactorSetup,
  DeviceSessions,
  SecurityOverview,
  SSOConfig,
  AuditLogsViewer,
};
