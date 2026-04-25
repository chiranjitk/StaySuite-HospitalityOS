'use client';
import { lazy } from 'react';

const PropertiesList = lazy(() => import('@/components/pms/properties-list').then(m => ({ default: m.PropertiesList })));
const RoomTypesManager = lazy(() => import('@/components/pms/room-types-manager').then(m => ({ default: m.RoomTypesManager })));
const RoomsManager = lazy(() => import('@/components/pms/rooms-manager').then(m => ({ default: m.RoomsManager })));
const FloorPlans = lazy(() => import('@/components/pms/floor-plans').then(m => ({ default: m.FloorPlans })));
const InventoryCalendar = lazy(() => import('@/components/pms/inventory-calendar').then(m => ({ default: m.InventoryCalendar })));
const AvailabilityControl = lazy(() => import('@/components/pms/availability-control').then(m => ({ default: m.AvailabilityControl })));
const InventoryLocking = lazy(() => import('@/components/pms/inventory-locking').then(m => ({ default: m.InventoryLocking })));
const RatePlansPricingRules = lazy(() => import('@/components/pms/rate-plans-pricing-rules').then(m => ({ default: m.RatePlansPricingRules })));
const OverbookingSettings = lazy(() => import('@/components/pms/overbooking-settings').then(m => ({ default: m.OverbookingSettings })));
const BulkPriceUpdate = lazy(() => import('@/components/pms/bulk-price-update').then(m => ({ default: m.BulkPriceUpdate })));
const RevenueDashboard = lazy(() => import('@/components/pms/revenue-dashboard').then(m => ({ default: m.RevenueDashboard })));

export const pmsSections: Record<string, React.LazyExoticComponent<any>> = {
  PropertiesList,
  RoomTypesManager,
  RoomsManager,
  FloorPlans,
  InventoryCalendar,
  AvailabilityControl,
  InventoryLocking,
  RatePlansPricingRules,
  OverbookingSettings,
  BulkPriceUpdate,
  RevenueDashboard,
};
