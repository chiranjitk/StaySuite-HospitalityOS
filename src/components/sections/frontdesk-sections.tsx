'use client';
import { lazy } from 'react';

const CheckIn = lazy(() => import('@/components/frontdesk/check-in').then(m => ({ default: m.CheckIn })));
const CheckOut = lazy(() => import('@/components/frontdesk/check-out').then(m => ({ default: m.CheckOut })));
const WalkIn = lazy(() => import('@/components/frontdesk/walk-in').then(m => ({ default: m.WalkIn })));
const RoomGrid = lazy(() => import('@/components/frontdesk/room-grid').then(m => ({ default: m.RoomGrid })));
const RoomAssignment = lazy(() => import('@/components/frontdesk/room-assignment').then(m => ({ default: m.RoomAssignment })));

export const frontdeskSections: Record<string, React.LazyExoticComponent<any>> = {
  CheckIn,
  CheckOut,
  WalkIn,
  RoomGrid,
  RoomAssignment,
};
