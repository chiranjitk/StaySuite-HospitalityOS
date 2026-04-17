'use client';
import { lazy } from 'react';

const StockItems = lazy(() => import('@/components/inventory/stock-items').then(m => ({ default: m.StockItems })));
const ConsumptionLogs = lazy(() => import('@/components/inventory/consumption-logs').then(m => ({ default: m.ConsumptionLogs })));
const LowStockAlerts = lazy(() => import('@/components/inventory/low-stock-alerts').then(m => ({ default: m.LowStockAlerts })));
const Vendors = lazy(() => import('@/components/inventory/vendors').then(m => ({ default: m.Vendors })));
const PurchaseOrders = lazy(() => import('@/components/inventory/purchase-orders').then(m => ({ default: m.PurchaseOrders })));

export const inventorySections: Record<string, React.LazyExoticComponent<any>> = {
  StockItems,
  ConsumptionLogs,
  LowStockAlerts,
  Vendors,
  PurchaseOrders,
};
