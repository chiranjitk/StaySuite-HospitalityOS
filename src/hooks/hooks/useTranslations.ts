'use client';

import { useTranslations } from 'next-intl';

// Custom hook for translations with fallback
export function useAppTranslations() {
  const common = useTranslations('common');
  const navigation = useTranslations('navigation');
  const status = useTranslations('status');
  const dashboard = useTranslations('dashboard');
  const messages = useTranslations('messages');
  const language = useTranslations('language');
  const settings = useTranslations('settings');
  const auth = useTranslations('auth');
  const forms = useTranslations('forms');

  return {
    common: {
      save: common('save'),
      cancel: common('cancel'),
      delete: common('delete'),
      edit: common('edit'),
      add: common('add'),
      create: common('create'),
      update: common('update'),
      search: common('search'),
      filter: common('filter'),
      export: common('export'),
      import: common('import'),
      refresh: common('refresh'),
      loading: common('loading'),
      noData: common('noData'),
      confirm: common('confirm'),
      back: common('back'),
      next: common('next'),
      previous: common('previous'),
      submit: common('submit'),
      reset: common('reset'),
      clear: common('clear'),
      close: common('close'),
      view: common('view'),
      download: common('download'),
      upload: common('upload'),
      copy: common('copy'),
      copied: common('copied'),
      select: common('select'),
      selectAll: common('selectAll'),
      actions: common('actions'),
      status: common('status'),
      details: common('details'),
      settings: common('settings'),
      help: common('help'),
      error: common('error'),
      success: common('success'),
      warning: common('warning'),
      info: common('info'),
      yes: common('yes'),
      no: common('no'),
      all: common('all'),
      enabled: common('enabled'),
      disabled: common('disabled'),
      active: common('active'),
      inactive: common('inactive'),
    },
    nav: {
      dashboard: navigation('dashboard'),
      overview: navigation('overview'),
      commandCenter: navigation('commandCenter'),
      alerts: navigation('alerts'),
      pms: navigation('pms'),
      properties: navigation('properties'),
      roomTypes: navigation('roomTypes'),
      rooms: navigation('rooms'),
      bookings: navigation('bookings'),
      allBookings: navigation('allBookings'),
      guests: navigation('guests'),
      frontDesk: navigation('frontDesk'),
      checkIn: navigation('checkIn'),
      checkOut: navigation('checkOut'),
      billing: navigation('billing'),
      invoices: navigation('invoices'),
      payments: navigation('payments'),
      housekeeping: navigation('housekeeping'),
      tasks: navigation('tasks'),
      pos: navigation('pos'),
      orders: navigation('orders'),
      experience: navigation('experience'),
      serviceRequests: navigation('serviceRequests'),
      parking: navigation('parking'),
      security: navigation('security'),
      reports: navigation('reports'),
      admin: navigation('admin'),
      settings: navigation('settings'),
      generalSettings: navigation('generalSettings'),
      localization: navigation('localization'),
    },
    status: {
      active: status('active'),
      inactive: status('inactive'),
      pending: status('pending'),
      confirmed: status('confirmed'),
      checkedIn: status('checkedIn'),
      checkedOut: status('checkedOut'),
      cancelled: status('cancelled'),
      noShow: status('noShow'),
      available: status('available'),
      occupied: status('occupied'),
      maintenance: status('maintenance'),
      clean: status('clean'),
      dirty: status('dirty'),
    },
    dashboard: {
      title: dashboard('title'),
      welcome: dashboard('welcome'),
      totalRevenue: dashboard('totalRevenue'),
      occupancyRate: dashboard('occupancyRate'),
      activeBookings: dashboard('activeBookings'),
      totalGuests: dashboard('totalGuests'),
      availableRooms: dashboard('availableRooms'),
      pendingTasks: dashboard('pendingTasks'),
      quickActions: dashboard('quickActions'),
      upcomingArrivals: dashboard('upcomingArrivals'),
      upcomingDepartures: dashboard('upcomingDepartures'),
    },
    msg: {
      saveSuccess: messages('saveSuccess'),
      saveError: messages('saveError'),
      deleteSuccess: messages('deleteSuccess'),
      deleteError: messages('deleteError'),
      createSuccess: messages('createSuccess'),
      updateSuccess: messages('updateSuccess'),
    },
    lang: {
      title: language('title'),
      selectLanguage: language('selectLanguage'),
      changeLanguage: language('changeLanguage'),
      languageChanged: language('languageChanged'),
      indianLanguages: language('indianLanguages'),
      globalLanguages: language('globalLanguages'),
    },
    settings: {
      general: settings('general'),
      languageSettings: settings('languageSettings'),
    },
    auth: {
      login: auth('login'),
      logout: auth('logout'),
      email: auth('email'),
      password: auth('password'),
    },
    forms: {
      firstName: forms('firstName'),
      lastName: forms('lastName'),
      email: forms('email'),
      phone: forms('phone'),
      checkInDate: forms('checkInDate'),
      checkOutDate: forms('checkOutDate'),
      roomType: forms('roomType'),
      roomNumber: forms('roomNumber'),
      numberOfGuests: forms('numberOfGuests'),
      adults: forms('adults'),
      children: forms('children'),
      specialRequests: forms('specialRequests'),
      notes: forms('notes'),
      amount: forms('amount'),
      status: forms('status'),
    },
  };
}

// Export individual namespace hooks for targeted use
export function useCommonTranslations() {
  return useTranslations('common');
}

export function useNavigationTranslations() {
  return useTranslations('navigation');
}

export function useStatusTranslations() {
  return useTranslations('status');
}

export function useDashboardTranslations() {
  return useTranslations('dashboard');
}

export function useMessageTranslations() {
  return useTranslations('messages');
}
