'use client';
import { lazy } from 'react';

const ServiceRequests = lazy(() => import('@/components/experience/service-requests').then(m => ({ default: m.ServiceRequests })));
const GuestChat = lazy(() => import('@/components/experience/guest-chat').then(m => ({ default: m.GuestChat })));
const DigitalKeys = lazy(() => import('@/components/experience/digital-keys').then(m => ({ default: m.DigitalKeys })));
const InRoomPortal = lazy(() => import('@/components/experience/in-room-portal').then(m => ({ default: m.InRoomPortal })));
const GuestAppControls = lazy(() => import('@/components/experience/guest-app-controls').then(m => ({ default: m.GuestAppControls })));
const UnifiedInbox = lazy(() => import('@/components/communication/unified-inbox').then(m => ({ default: m.UnifiedInbox })));
const ParkingSlots = lazy(() => import('@/components/parking/slots').then(m => ({ default: m.ParkingSlots })));
const VehicleTracking = lazy(() => import('@/components/parking/vehicle-tracking').then(m => ({ default: m.VehicleTracking })));

export const experienceSections: Record<string, React.LazyExoticComponent<any>> = {
  ServiceRequests,
  GuestChat,
  DigitalKeys,
  InRoomPortal,
  GuestAppControls,
  UnifiedInbox,
  ParkingSlots,
  VehicleTracking,
};
