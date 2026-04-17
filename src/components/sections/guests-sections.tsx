'use client';
import { lazy } from 'react';

const GuestsList = lazy(() => import('@/components/guests/guests-list').then(m => ({ default: m.GuestsList })));
const GuestProfile = lazy(() => import('@/components/guests/guest-profile').then(m => ({ default: m.GuestProfile })));
const KYCManagement = lazy(() => import('@/components/guests/kyc-management').then(m => ({ default: m.KYCManagement })));
const PreferencesManagement = lazy(() => import('@/components/guests/preferences-management').then(m => ({ default: m.PreferencesManagement })));
const StayHistoryManagement = lazy(() => import('@/components/guests/stay-history-management').then(m => ({ default: m.StayHistoryManagement })));
const LoyaltyManagement = lazy(() => import('@/components/guests/loyalty-management').then(m => ({ default: m.LoyaltyManagement })));

export const guestsSections: Record<string, React.LazyExoticComponent<any>> = {
  GuestsList,
  GuestProfile,
  KYCManagement,
  PreferencesManagement,
  StayHistoryManagement,
  LoyaltyManagement,
};
