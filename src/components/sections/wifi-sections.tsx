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
};
