'use client';

import { useTranslations, useLocale, useFormatter, useNow, useTimeZone } from 'next-intl';
import { locales, type Locale, defaultLocale, languages, getLanguageInfo, isRTL } from './config';

// Re-export the hooks from next-intl for convenience
export { useTranslations, useLocale, useFormatter, useNow, useTimeZone };

// Hook to get current locale information
export function useCurrentLocale() {
  const locale = useLocale() as Locale;
  const languageInfo = getLanguageInfo(locale);
  
  return {
    locale,
    languageInfo,
    isRtl: isRTL(locale),
    isDefault: locale === defaultLocale,
  };
}

// Hook to get all available languages with current selection
export function useAvailableLanguages() {
  const currentLocale = useLocale() as Locale;
  
  return {
    currentLocale,
    languages,
    indianLanguages: languages.filter(l => l.group === 'indian'),
    globalLanguages: languages.filter(l => l.group === 'global'),
    defaultLocale,
  };
}

// Hook for date formatting with locale awareness
export function useLocaleDate() {
  const locale = useLocale();
  const format = useFormatter();
  const now = useNow();
  
  return {
    format: (date: Date | string, options?: Intl.DateTimeFormatOptions) => {
      const d = typeof date === 'string' ? new Date(date) : date;
       
      return (format.dateTime as any)(d, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        ...options,
      });
    },
    formatTime: (date: Date | string, options?: Intl.DateTimeFormatOptions) => {
      const d = typeof date === 'string' ? new Date(date) : date;
       
      return (format.dateTime as any)(d, {
        hour: '2-digit',
        minute: '2-digit',
        ...options,
      });
    },
    formatDateTime: (date: Date | string, options?: Intl.DateTimeFormatOptions) => {
      const d = typeof date === 'string' ? new Date(date) : date;
       
      return (format.dateTime as any)(d, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        ...options,
      });
    },
    formatRelative: (date: Date | string) => {
      const d = typeof date === 'string' ? new Date(date) : date;
      return format.relativeTime(d, now);
    },
  };
}

// Hook for number formatting with locale awareness
export function useLocaleNumber() {
  const format = useFormatter();
  
  return {
    format: (value: number, options?: Intl.NumberFormatOptions) => {
       
      return (format.number as any)(value, options);
    },
    formatCurrency: (value: number, currency: string = 'INR', options?: Intl.NumberFormatOptions) => {
       
      return (format.number as any)(value, {
        style: 'currency',
        currency,
        ...options,
      });
    },
    formatPercent: (value: number, options?: Intl.NumberFormatOptions) => {
       
      return (format.number as any)(value, {
        style: 'percent',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
        ...options,
      });
    },
  };
}

// Hook for common translations used throughout the app
export function useCommonTranslations() {
  const t = useTranslations('common');
  
  return {
    // Actions
    save: t('save'),
    cancel: t('cancel'),
    delete: t('delete'),
    edit: t('edit'),
    add: t('add'),
    create: t('create'),
    update: t('update'),
    search: t('search'),
    filter: t('filter'),
    export: t('export'),
    import: t('import'),
    refresh: t('refresh'),
    
    // Status
    loading: t('loading'),
    noData: t('noData'),
    confirm: t('confirm'),
    
    // Navigation
    back: t('back'),
    next: t('next'),
    previous: t('previous'),
    
    // Form actions
    submit: t('submit'),
    reset: t('reset'),
    clear: t('clear'),
    close: t('close'),
    
    // View actions
    view: t('view'),
    download: t('download'),
    upload: t('upload'),
    copy: t('copy'),
    copied: t('copied'),
    
    // Selection
    select: t('select'),
    selectAll: t('selectAll'),
    deselectAll: t('deselectAll'),
    
    // Labels
    actions: t('actions'),
    status: t('status'),
    details: t('details'),
    settings: t('settings'),
    help: t('help'),
    
    // Feedback
    error: t('error'),
    success: t('success'),
    warning: t('warning'),
    info: t('info'),
    
    // Boolean
    yes: t('yes'),
    no: t('no'),
    all: t('all'),
    none: t('none'),
    
    // State
    enabled: t('enabled'),
    disabled: t('disabled'),
    active: t('active'),
    inactive: t('inactive'),
  };
}

// Hook for navigation translations
export function useNavigationTranslations() {
  const t = useTranslations('navigation');
  
  return {
    dashboard: t('dashboard'),
    overview: t('overview'),
    commandCenter: t('commandCenter'),
    alerts: t('alerts'),
    
    // PMS
    pms: t('pms'),
    properties: t('properties'),
    roomTypes: t('roomTypes'),
    rooms: t('rooms'),
    inventoryCalendar: t('inventoryCalendar'),
    pricing: t('pricing'),
    availability: t('availability'),
    locking: t('locking'),
    overbooking: t('overbooking'),
    
    // Bookings
    bookings: t('bookings'),
    allBookings: t('allBookings'),
    groupBookings: t('groupBookings'),
    waitlist: t('waitlist'),
    auditLogs: t('auditLogs'),
    conflicts: t('conflicts'),
    
    // Guests
    guests: t('guests'),
    guestProfiles: t('guestProfiles'),
    kycManagement: t('kycManagement'),
    preferences: t('preferences'),
    stayHistory: t('stayHistory'),
    loyalty: t('loyalty'),
    
    // Front Desk
    frontDesk: t('frontDesk'),
    checkIn: t('checkIn'),
    checkOut: t('checkOut'),
    walkIn: t('walkIn'),
    roomGrid: t('roomGrid'),
    roomAssignment: t('roomAssignment'),
    
    // WiFi
    wifi: t('wifi'),
    sessions: t('sessions'),
    vouchers: t('vouchers'),
    plans: t('plans'),
    usageLogs: t('usageLogs'),
    gateway: t('gateway'),
    
    // Billing
    billing: t('billing'),
    folios: t('folios'),
    invoices: t('invoices'),
    payments: t('payments'),
    refunds: t('refunds'),
    discounts: t('discounts'),
    
    // SaaS
    saasPlans: t('saasPlans'),
    subscriptions: t('subscriptions'),
    usageBilling: t('usageBilling'),
    
    // Inventory
    inventory: t('inventory'),
    stockItems: t('stockItems'),
    consumptionLogs: t('consumptionLogs'),
    lowStockAlerts: t('lowStockAlerts'),
    vendors: t('vendors'),
    purchaseOrders: t('purchaseOrders'),
    
    // Housekeeping
    housekeeping: t('housekeeping'),
    tasks: t('tasks'),
    kanbanBoard: t('kanbanBoard'),
    roomStatus: t('roomStatus'),
    maintenance: t('maintenance'),
    assets: t('assets'),
    
    // POS
    pos: t('pos'),
    orders: t('orders'),
    tables: t('tables'),
    kitchenDisplay: t('kitchenDisplay'),
    menuManagement: t('menuManagement'),
    
    // Experience
    experience: t('experience'),
    serviceRequests: t('serviceRequests'),
    guestChat: t('guestChat'),
    digitalKeys: t('digitalKeys'),
    inRoomPortal: t('inRoomPortal'),
    guestApp: t('guestApp'),
    
    // Parking
    parking: t('parking'),
    parkingSlots: t('parkingSlots'),
    vehicleTracking: t('vehicleTracking'),
    
    // Security
    security: t('security'),
    liveCamera: t('liveCamera'),
    incidents: t('incidents'),
    
    // CRM
    crm: t('crm'),
    segments: t('segments'),
    campaigns: t('campaigns'),
    loyaltyPrograms: t('loyaltyPrograms'),
    feedbackReviews: t('feedbackReviews'),
    retentionAnalytics: t('retentionAnalytics'),
    
    // Automation
    automation: t('automation'),
    workflowBuilder: t('workflowBuilder'),
    rulesEngine: t('rulesEngine'),
    templates: t('templates'),
    executionLogs: t('executionLogs'),
    
    // Reports
    reports: t('reports'),
    revenueReports: t('revenueReports'),
    occupancyReports: t('occupancyReports'),
    adrRevpar: t('adrRevpar'),
    guestAnalytics: t('guestAnalytics'),
    staffPerformance: t('staffPerformance'),
    scheduledReports: t('scheduledReports'),
    
    // Revenue
    revenue: t('revenue'),
    pricingRules: t('pricingRules'),
    demandForecasting: t('demandForecasting'),
    competitorPricing: t('competitorPricing'),
    aiSuggestions: t('aiSuggestions'),
    
    // Channels
    channels: t('channels'),
    otaConnections: t('otaConnections'),
    inventorySync: t('inventorySync'),
    rateSync: t('rateSync'),
    bookingSync: t('bookingSync'),
    restrictions: t('restrictions'),
    channelMapping: t('channelMapping'),
    syncLogs: t('syncLogs'),
    crs: t('crs'),
    
    // Integrations
    integrations: t('integrations'),
    paymentGateways: t('paymentGateways'),
    wifiGateways: t('wifiGateways'),
    posSystems: t('posSystems'),
    thirdPartyApis: t('thirdPartyApis'),
    
    // Notifications
    notifications: t('notifications'),
    notificationTemplates: t('notificationTemplates'),
    deliveryLogs: t('deliveryLogs'),
    notificationSettings: t('notificationSettings'),
    
    // Webhooks
    webhooks: t('webhooks'),
    webhookEvents: t('webhookEvents'),
    webhookDelivery: t('webhookDelivery'),
    retryQueue: t('retryQueue'),
    
    // AI
    ai: t('ai'),
    aiCopilot: t('aiCopilot'),
    aiProviderSettings: t('aiProviderSettings'),
    aiInsights: t('aiInsights'),
    
    // Admin
    admin: t('admin'),
    tenantManagement: t('tenantManagement'),
    userManagement: t('userManagement'),
    usageTracking: t('usageTracking'),
    revenueAnalytics: t('revenueAnalytics'),
    systemHealth: t('systemHealth'),
    
    // Settings
    generalSettings: t('generalSettings'),
    taxCurrency: t('taxCurrency'),
    localization: t('localization'),
    featureFlags: t('featureFlags'),
    securitySettings: t('securitySettings'),
  };
}

// Hook for status translations
export function useStatusTranslations() {
  const t = useTranslations('status');
  
  return {
    active: t('active'),
    inactive: t('inactive'),
    pending: t('pending'),
    confirmed: t('confirmed'),
    checkedIn: t('checkedIn'),
    checkedOut: t('checkedOut'),
    cancelled: t('cancelled'),
    noShow: t('noShow'),
    available: t('available'),
    occupied: t('occupied'),
    maintenance: t('maintenance'),
    outOfOrder: t('outOfOrder'),
    dirty: t('dirty'),
    clean: t('clean'),
    inspected: t('inspected'),
    processing: t('processing'),
    completed: t('completed'),
    failed: t('failed'),
    draft: t('draft'),
    published: t('published'),
    expired: t('expired'),
    trial: t('trial'),
    suspended: t('suspended'),
    verified: t('verified'),
    rejected: t('rejected'),
  };
}

// Hook for dashboard translations
export function useDashboardTranslations() {
  const t = useTranslations('dashboard');
  
  return {
    title: t('title'),
    welcome: t('welcome'),
    totalRevenue: t('totalRevenue'),
    occupancyRate: t('occupancyRate'),
    activeBookings: t('activeBookings'),
    totalGuests: t('totalGuests'),
    availableRooms: t('availableRooms'),
    pendingTasks: t('pendingTasks'),
    recentActivity: t('recentActivity'),
    upcomingArrivals: t('upcomingArrivals'),
    upcomingDepartures: t('upcomingDepartures'),
    todaysStats: t('todaysStats'),
    quickActions: t('quickActions'),
    newBooking: t('newBooking'),
    newGuest: t('newGuest'),
    newCheckIn: t('newCheckIn'),
    newCheckOut: t('newCheckOut'),
    runReport: t('runReport'),
    alerts: t('alerts'),
    criticalAlerts: t('criticalAlerts'),
    warnings: t('warnings'),
    informational: t('informational'),
  };
}

// Hook for message translations
export function useMessageTranslations() {
  const t = useTranslations('messages');
  
  return {
    saveSuccess: t('saveSuccess'),
    saveError: t('saveError'),
    deleteConfirm: t('deleteConfirm'),
    deleteSuccess: t('deleteSuccess'),
    deleteError: t('deleteError'),
    createSuccess: t('createSuccess'),
    createError: t('createError'),
    updateSuccess: t('updateSuccess'),
    updateError: t('updateError'),
    copySuccess: t('copySuccess'),
    copyError: t('copyError'),
    uploadSuccess: t('uploadSuccess'),
    uploadError: t('uploadError'),
    exportSuccess: t('exportSuccess'),
    exportError: t('exportError'),
    importSuccess: t('importSuccess'),
    importError: t('importError'),
    networkError: t('networkError'),
    sessionExpired: t('sessionExpired'),
    unauthorized: t('unauthorized'),
    validationError: t('validationError'),
  };
}

// Hook for form translations
export function useFormTranslations() {
  const t = useTranslations('forms');
  
  return {
    required: t('required'),
    optional: t('optional'),
    firstName: t('firstName'),
    lastName: t('lastName'),
    email: t('email'),
    phone: t('phone'),
    address: t('address'),
    city: t('city'),
    country: t('country'),
    postalCode: t('postalCode'),
    dateOfBirth: t('dateOfBirth'),
    nationality: t('nationality'),
    idType: t('idType'),
    idNumber: t('idNumber'),
    checkInDate: t('checkInDate'),
    checkOutDate: t('checkOutDate'),
    roomType: t('roomType'),
    roomNumber: t('roomNumber'),
    numberOfGuests: t('numberOfGuests'),
    adults: t('adults'),
    children: t('children'),
    infants: t('infants'),
    specialRequests: t('specialRequests'),
    notes: t('notes'),
    amount: t('amount'),
    currency: t('currency'),
    paymentMethod: t('paymentMethod'),
    reference: t('reference'),
    description: t('description'),
    name: t('name'),
    code: t('code'),
    price: t('price'),
    quantity: t('quantity'),
    total: t('total'),
    subtotal: t('subtotal'),
    tax: t('tax'),
    discount: t('discount'),
    startDate: t('startDate'),
    endDate: t('endDate'),
    status: t('status'),
    priority: t('priority'),
    assignedTo: t('assignedTo'),
    createdAt: t('createdAt'),
    updatedAt: t('updatedAt'),
    createdBy: t('createdBy'),
    updatedBy: t('updatedBy'),
  };
}

// Hook for settings translations
export function useSettingsTranslations() {
  const t = useTranslations('settings');
  
  return {
    general: t('general'),
    propertyInfo: t('propertyInfo'),
    businessInfo: t('businessInfo'),
    contactDetails: t('contactDetails'),
    operationalSettings: t('operationalSettings'),
    taxSettings: t('taxSettings'),
    currencySettings: t('currencySettings'),
    languageSettings: t('languageSettings'),
    timezoneSettings: t('timezoneSettings'),
    dateFormat: t('dateFormat'),
    timeFormat: t('timeFormat'),
    defaultLanguage: t('defaultLanguage'),
    guestFacingLanguage: t('guestFacingLanguage'),
    autoTranslate: t('autoTranslate'),
    featureSettings: t('featureSettings'),
    securitySettings: t('securitySettings'),
    twoFactorAuth: t('twoFactorAuth'),
    sessionTimeout: t('sessionTimeout'),
    passwordPolicy: t('passwordPolicy'),
    auditLogging: t('auditLogging'),
  };
}

// Hook for auth translations
export function useAuthTranslations() {
  const t = useTranslations('auth');
  
  return {
    login: t('login'),
    logout: t('logout'),
    email: t('email'),
    password: t('password'),
    rememberMe: t('rememberMe'),
    forgotPassword: t('forgotPassword'),
    resetPassword: t('resetPassword'),
    newPassword: t('newPassword'),
    confirmPassword: t('confirmPassword'),
    changePassword: t('changePassword'),
    loginError: t('loginError'),
    logoutSuccess: t('logoutSuccess'),
    sessionExpired: t('sessionExpired'),
    unauthorized: t('unauthorized'),
  };
}

// Hook for language translations
export function useLanguageTranslations() {
  const t = useTranslations('language');
  
  return {
    title: t('title'),
    selectLanguage: t('selectLanguage'),
    currentLanguage: t('currentLanguage'),
    changeLanguage: t('changeLanguage'),
    languageChanged: t('languageChanged'),
    english: t('english'),
    spanish: t('spanish'),
    french: t('french'),
  };
}

// Combined hook that provides all translation namespaces
export function useAllTranslations() {
  return {
    common: useCommonTranslations(),
    navigation: useNavigationTranslations(),
    status: useStatusTranslations(),
    dashboard: useDashboardTranslations(),
    messages: useMessageTranslations(),
    forms: useFormTranslations(),
    settings: useSettingsTranslations(),
    auth: useAuthTranslations(),
    language: useLanguageTranslations(),
    locale: useCurrentLocale(),
    date: useLocaleDate(),
    number: useLocaleNumber(),
  };
}
