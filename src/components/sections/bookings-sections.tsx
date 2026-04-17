'use client';
import { lazy } from 'react';

const BookingsCalendarList = lazy(() => import('@/components/bookings/bookings-calendar-list').then(m => ({ default: m.BookingsCalendarList })));
const GroupBookings = lazy(() => import('@/components/bookings/group-bookings').then(m => ({ default: m.GroupBookings })));
const Waitlist = lazy(() => import('@/components/bookings/waitlist').then(m => ({ default: m.Waitlist })));
const AuditLogs = lazy(() => import('@/components/bookings/audit-logs').then(m => ({ default: m.AuditLogs })));
const Conflicts = lazy(() => import('@/components/bookings/conflicts').then(m => ({ default: m.Conflicts })));
const NoShowAutomation = lazy(() => import('@/components/bookings/no-show-automation').then(m => ({ default: m.NoShowAutomation })));

export const bookingsSections: Record<string, React.LazyExoticComponent<any>> = {
  BookingsCalendarList,
  GroupBookings,
  Waitlist,
  AuditLogs,
  Conflicts,
  NoShowAutomation,
};
