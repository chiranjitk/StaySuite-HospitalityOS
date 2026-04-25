'use client';

import { useMemo } from 'react';
import { navigationConfig, NavSection, NavItem } from '@/config/navigation';
import { useI18n } from '@/contexts/I18nContext';

// Hook that returns translated navigation using I18n context with stable IDs
export function useTranslatedNavigation(): NavSection[] {
  const { t, locale } = useI18n();
  
  // Translate navigation config - memoize with translations object dependency for reactivity
  // We use t.navigation as dependency to ensure re-render when translations change
  return useMemo(() => {
    return navigationConfig.map(section => {
      const sectionTitle = t.navigation[section.id] || section.title;
      return {
        ...section,
        title: sectionTitle,
        items: section.items.map(item => {
          // Try kebab-case ID first, then camelCase fallback, then item.title
          const camelCaseId = item.id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          const itemTitle = t.navigation[item.id] || t.navigation[camelCaseId] || item.title;
          return {
            ...item,
            title: itemTitle,
          };
        }),
      };
    });
  }, [t.navigation, locale]);
}

// Hook for common translations - uses I18n context
export function useCommonTranslation() {
  const { tCommon, tNav, tDashboard, tMessages, tStatus, locale } = useI18n();
  
  return useMemo(() => ({
    // Common
    save: tCommon('save'),
    cancel: tCommon('cancel'),
    delete: tCommon('delete'),
    edit: tCommon('edit'),
    add: tCommon('add'),
    create: tCommon('create'),
    update: tCommon('update'),
    search: tCommon('search'),
    filter: tCommon('filter'),
    loading: tCommon('loading'),
    noData: tCommon('noData'),
    confirm: tCommon('confirm'),
    actions: tCommon('actions'),
    status: tCommon('status'),
    settings: tCommon('settings'),
    yes: tCommon('yes'),
    no: tCommon('no'),
    all: tCommon('all'),
    enabled: tCommon('enabled'),
    disabled: tCommon('disabled'),
    active: tCommon('active'),
    inactive: tCommon('inactive'),
    
    // Navigation shortcuts
    dashboard: tNav('dashboard'),
    bookings: tNav('bookings'),
    guests: tNav('guests'),
    settingsNav: tCommon('settings'),
    
    // Dashboard
    dashboardTitle: tDashboard('title'),
    welcome: tDashboard('welcome'),
    totalRevenue: tDashboard('totalRevenue'),
    occupancyRate: tDashboard('occupancyRate'),
    activeBookings: tDashboard('activeBookings'),
    totalGuests: tDashboard('totalGuests'),
    availableRooms: tDashboard('availableRooms'),
    
    // Messages
    saveSuccess: tMessages('saveSuccess'),
    deleteSuccess: tMessages('deleteSuccess'),
    createSuccess: tMessages('createSuccess'),
    updateSuccess: tMessages('updateSuccess'),
    
    // Status
    statusActive: tStatus('active'),
    statusInactive: tStatus('inactive'),
    statusPending: tStatus('pending'),
    statusConfirmed: tStatus('confirmed'),
    statusCancelled: tStatus('cancelled'),
  }), [tCommon, tNav, tDashboard, tMessages, tStatus, locale]);
}
