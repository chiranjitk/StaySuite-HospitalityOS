'use client';
import { lazy } from 'react';

// All wifi sub-components use `export default`, so just import directly
const WifiSessions = lazy(() => import('@/components/wifi/sessions'));
const WifiVouchers = lazy(() => import('@/components/wifi/vouchers'));
const WifiPlans = lazy(() => import('@/components/wifi/plans'));
const UsageLogs = lazy(() => import('@/components/wifi/usage-logs'));
const GatewayIntegration = lazy(() => import('@/components/wifi/gateway-integration'));
const AAAConfig = lazy(() => import('@/components/wifi/aaa-config'));
const DhcpPage = lazy(() => import('@/components/wifi/dhcp-page'));
const NetworkPage = lazy(() => import('@/components/wifi/network-page'));
const PortalPage = lazy(() => import('@/components/wifi/portal-page'));
const FirewallPage = lazy(() => import('@/components/wifi/firewall-page'));
const ReportsPage = lazy(() => import('@/components/wifi/reports-page'));
const WifiAccessPage = lazy(() => import('@/components/wifi/wifi-access-page'));
const GatewayRadiusPage = lazy(() => import('@/components/wifi/gateway-radius-page'));
const DnsPage = lazy(() => import('@/components/wifi/dns-page'));
const ConcurrentSessions = lazy(() => import('@/components/wifi/concurrent-sessions'));
const ProvisioningLogs = lazy(() => import('@/components/wifi/provisioning-logs'));
const BandwidthScheduler = lazy(() => import('@/components/wifi/bandwidth-scheduler'));
const ContentFilter = lazy(() => import('@/components/wifi/content-filter'));
const MacAuth = lazy(() => import('@/components/wifi/mac-auth'));
const PortalWhitelist = lazy(() => import('@/components/wifi/portal-whitelist'));
const AuthLogs = lazy(() => import('@/components/wifi/auth-logs'));
const PrintCard = lazy(() => import('@/components/wifi/print-card'));
const EventWifi = lazy(() => import('@/components/wifi/event-wifi'));
const LiveSessions = lazy(() => import('@/components/wifi/live-sessions'));
const CoaAudit = lazy(() => import('@/components/wifi/coa-audit'));
const FapPolicies = lazy(() => import('@/components/wifi/fap-policies'));
const WebCategories = lazy(() => import('@/components/wifi/web-categories'));
const UserStatusHistory = lazy(() => import('@/components/wifi/user-status-history'));
const NasHealth = lazy(() => import('@/components/wifi/nas-health'));
const BwPolicyDetails = lazy(() => import('@/components/wifi/bw-policy-details'));

export const wifiSections: Record<string, React.LazyExoticComponent<any>> = {
  WifiSessions,
  WifiVouchers,
  WifiPlans,
  UsageLogs,
  GatewayIntegration,
  AAAConfig,
  NetworkPage,
  DhcpPage,
  PortalPage,
  FirewallPage,
  ReportsPage,
  WifiAccessPage,
  GatewayRadiusPage,
  DnsPage,
  ConcurrentSessions,
  ProvisioningLogs,
  BandwidthScheduler,
  ContentFilter,
  MacAuth,
  PortalWhitelist,
  AuthLogs,
  PrintCard,
  EventWifi,
  LiveSessions,
  CoaAudit,
  FapPolicies,
  WebCategories,
  UserStatusHistory,
  NasHealth,
  BwPolicyDetails,
};
