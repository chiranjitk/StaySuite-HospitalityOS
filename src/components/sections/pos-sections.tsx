'use client';
import { lazy } from 'react';

const Orders = lazy(() => import('@/components/pos/orders').then(m => ({ default: m.Orders })));
const Tables = lazy(() => import('@/components/pos/tables').then(m => ({ default: m.Tables })));
const KitchenDisplay = lazy(() => import('@/components/pos/kitchen-display').then(m => ({ default: m.KitchenDisplay })));
const MenuManagement = lazy(() => import('@/components/pos/menu-management').then(m => ({ default: m.MenuManagement })));
const POSBilling = lazy(() => import('@/components/pos/billing'));

export const posSections: Record<string, React.LazyExoticComponent<any>> = {
  Orders,
  Tables,
  KitchenDisplay,
  MenuManagement,
  POSBilling,
};
