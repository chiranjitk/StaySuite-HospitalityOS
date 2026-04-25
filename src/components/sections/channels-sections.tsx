'use client';
import { lazy } from 'react';

const OTAConnections = lazy(() => import('@/components/channels/ota-connections').then(m => ({ default: m.OTAConnections })));
const InventorySync = lazy(() => import('@/components/channels/inventory-sync').then(m => ({ default: m.InventorySync })));
const RateSync = lazy(() => import('@/components/channels/rate-sync').then(m => ({ default: m.RateSync })));
const BookingSync = lazy(() => import('@/components/channels/booking-sync').then(m => ({ default: m.BookingSync })));
const Restrictions = lazy(() => import('@/components/channels/restrictions').then(m => ({ default: m.Restrictions })));
const ChannelMapping = lazy(() => import('@/components/channels/mapping').then(m => ({ default: m.ChannelMapping })));
const SyncLogs = lazy(() => import('@/components/channels/sync-logs').then(m => ({ default: m.SyncLogs })));
const CRS = lazy(() => import('@/components/channels/crs').then(m => ({ default: m.CRS })));

export const channelsSections: Record<string, React.LazyExoticComponent<any>> = {
  OTAConnections,
  InventorySync,
  RateSync,
  BookingSync,
  Restrictions,
  ChannelMapping,
  SyncLogs,
  CRS,
};
