'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { locales, languages, type Locale } from '@/i18n/config';

// Translation structure
interface Translations {
  common: Record<string, string>;
  navigation: Record<string, string>;
  status: Record<string, string>;
  dashboard: Record<string, string>;
  forms: Record<string, string>;
  messages: Record<string, string>;
  language: Record<string, string>;
  settings: Record<string, string>;
  auth: Record<string, string>;
}

// Context type
interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translations;
  isLoading: boolean;
  // Helper functions
  tCommon: (key: string) => string;
  tNav: (key: string) => string;
  tStatus: (key: string) => string;
  tDashboard: (key: string) => string;
  tForms: (key: string) => string;
  tMessages: (key: string) => string;
  tSettings: (key: string) => string;
  tAuth: (key: string) => string;
}

const defaultTranslations: Translations = {
  common: {
    save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', add: 'Add',
    create: 'Create', update: 'Update', search: 'Search', filter: 'Filter',
    loading: 'Loading...', noData: 'No data available', confirm: 'Confirm',
    actions: 'Actions', status: 'Status', settings: 'Settings', help: 'Help',
    yes: 'Yes', no: 'No', all: 'All', enabled: 'Enabled', disabled: 'Disabled',
    active: 'Active', inactive: 'Inactive', back: 'Back', next: 'Next',
    previous: 'Previous', submit: 'Submit', reset: 'Reset', close: 'Close',
    view: 'View', download: 'Download', upload: 'Upload', copy: 'Copy',
    profile: 'Profile', notifications: 'Notifications', language: 'Language',
    theme: 'Theme', logout: 'Logout', login: 'Login', email: 'Email',
    password: 'Password', name: 'Name', description: 'Description',
    quickActions: 'Quick Actions', markAllRead: 'Mark all read',
    noNotifications: 'No new notifications', allCaughtUp: 'All caught up!',
    viewAll: 'View all', searchAnything: 'Search anything...',
    toggleMenu: 'Toggle menu', selectLanguage: 'Select language',
    pending: 'Pending', inProgress: 'In Progress', completed: 'Completed',
  },
  navigation: {
    // Sections
    dashboard: 'Dashboard', pms: 'Property Management', bookings: 'Bookings',
    frontDesk: 'Front Desk', guests: 'Guests', housekeeping: 'Housekeeping',
    billing: 'Billing', experience: 'Experience', pos: 'Restaurant & POS',
    inventory: 'Inventory', parking: 'Parking', surveillance: 'Surveillance',
    iot: 'Smart Hotel / IoT', wifi: 'WiFi', revenue: 'Revenue Management',
    channels: 'Channel Manager', crm: 'CRM & Marketing', crmMarketing: 'CRM & Marketing', marketing: 'Marketing',
    reports: 'Reports & BI', events: 'Events / MICE', staffManagement: 'Staff Management',
    securityCenter: 'Security Center', integrations: 'Integrations', automation: 'Automation',
    aiAssistant: 'AI Assistant', admin: 'Admin', chainManagement: 'Chain Management',
    saasBilling: 'SaaS Billing', notifications: 'Notifications', webhooks: 'Webhooks',
    settings: 'Settings', helpSupport: 'Help & Support',
    
    // Dashboard items
    'dashboard-overview': 'Overview', 'dashboard-command-center': 'Command Center',
    'dashboard-alerts': 'Alerts & Notifications', 'dashboard-kpi': 'KPI Cards',
    
    // PMS items
    'pms-properties': 'Properties', 'pms-room-types': 'Room Types', 'pms-rooms': 'Rooms',
    'pms-inventory-calendar': 'Inventory Calendar', 'pms-availability': 'Availability Control',
    'pms-locking': 'Inventory Locking', 'pms-rate-plans-pricing': 'Rate Plans & Pricing',
    'pms-overbooking': 'Overbooking Settings',
    
    // Bookings items
    'bookings-calendar': 'Calendar View',
    'bookings-groups': 'Group Bookings', 'bookings-waitlist': 'Waitlist',
    'bookings-conflicts': 'Conflicts', 'bookings-audit': 'Audit Logs',
    
    // Front Desk items
    'frontdesk-checkin': 'Check-in', 'frontdesk-checkout': 'Check-out',
    'frontdesk-walkin': 'Walk-in Booking', 'frontdesk-room-grid': 'Room Grid',
    'frontdesk-assignment': 'Room Assignment',
    
    // Guests items
    'guests-list': 'Guest List',
    'guests-kyc': 'KYC / Documents', 'guests-preferences': 'Preferences',
    'guests-history': 'Stay History', 'guests-loyalty': 'Loyalty & Points',
    
    // Housekeeping items
    'housekeeping-tasks': 'Tasks', 'housekeeping-kanban': 'Kanban Board',
    'housekeeping-status': 'Room Status', 'housekeeping-maintenance': 'Maintenance Requests',
    'housekeeping-preventive': 'Preventive Maintenance', 'housekeeping-assets': 'Asset Management',
    
    // Billing items
    'billing-folios': 'Folios', 'billing-invoices': 'Invoices',
    'billing-payments': 'Payments', 'billing-refunds': 'Refunds',
    'billing-discounts': 'Discounts',
    
    // Experience items
    'experience-requests': 'Service Requests', 'experience-inbox': 'Unified Inbox',
    'experience-chat': 'Guest Chat', 'experience-portal': 'In-Room Portal',
    'experience-keys': 'Digital Keys', 'experience-app-controls': 'Guest App Controls',
    
    // POS items
    'pos-orders': 'Orders', 'pos-tables': 'Tables',
    'pos-kitchen': 'Kitchen (KDS)', 'pos-menu': 'Menu Management',
    'pos-billing': 'POS Billing',
    
    // Inventory items
    'inventory-stock': 'Stock Items', 'inventory-consumption': 'Consumption Logs',
    'inventory-alerts': 'Low Stock Alerts', 'inventory-vendors': 'Vendors',
    'inventory-po': 'Purchase Orders',
    
    // Parking items
    'parking-slots': 'Parking Slots', 'parking-tracking': 'Vehicle Tracking',
    'parking-mapping': 'Guest Mapping', 'parking-billing': 'Parking Billing',
    
    // Surveillance items
    'security-live': 'Live Camera View', 'security-playback': 'Playback',
    'security-alerts': 'Event Alerts', 'security-incidents': 'Incident Logs',
    
    // IoT items
    'iot-devices': 'Device Management', 'iot-controls': 'Room Controls',
    'iot-energy': 'Energy Dashboard',
    
    // WiFi items
    'wifi-sessions': 'Active Sessions', 'wifi-vouchers': 'Voucher Management',
    'wifi-plans': 'Plans / Bandwidth', 'wifi-logs': 'Usage Logs',
    'wifi-gateway': 'Gateway Integration', 'wifi-aaa': 'AAA Configuration',
    'wifi-users': 'WiFi Users', 'wifi-network': 'Network',
    'wifi-dhcp': 'DHCP Server', 'wifi-portal': 'Captive Portal',
    'wifi-firewall': 'Firewall & Bandwidth', 'wifi-reports': 'WiFi Reports',
    
    // Revenue items
    'revenue-pricing': 'Pricing Rules', 'revenue-forecasting': 'Demand Forecasting',
    'revenue-competitor': 'Competitor Pricing', 'revenue-ai': 'AI Suggestions',
    
    // Channel items
    'channel-ota': 'OTA Connections', 'channel-inventory': 'Inventory Sync',
    'channel-rate': 'Rate Sync', 'channel-booking': 'Booking Sync',
    'channel-restrictions': 'Restrictions', 'channel-mapping': 'Channel Mapping',
    'channel-logs': 'Sync Logs', 'channel-crs': 'CRS',
    
    // CRM items
    'crm-segments': 'Guest Segments', 'crm-campaigns': 'Campaigns',
    'crm-loyalty': 'Loyalty Programs', 'crm-feedback': 'Feedback & Reviews',
    'crm-retention': 'Retention Analytics',
    
    // Marketing items
    'marketing-reputation': 'Reputation Dashboard', 'marketing-sources': 'Review Sources',
    'marketing-booking-engine': 'Direct Booking Engine', 'marketing-promotions': 'Promotions',
    
    // Reports items
    'reports-revenue': 'Revenue Reports', 'reports-occupancy': 'Occupancy Reports',
    'reports-adr': 'ADR / RevPAR', 'reports-guests': 'Guest Analytics',
    'reports-staff': 'Staff Performance', 'reports-scheduled': 'Scheduled Reports',
    
    // Events items
    'events-spaces': 'Event Spaces', 'events-calendar': 'Event Calendar',
    'events-booking': 'Event Bookings', 'events-resources': 'Event Resources',
    
    // Staff items
    'staff-shifts': 'Shift Scheduling', 'staff-attendance': 'Attendance Tracking',
    'staff-tasks': 'Task Assignment', 'staff-communication': 'Internal Communication',
    'staff-performance': 'Performance Metrics',
    
    // Security Center items
    'security-overview': 'Security Overview', 'security-2fa': 'Two-Factor Auth',
    'security-sessions': 'Device Sessions', 'security-sso': 'SSO Configuration',
    
    // Integrations items
    'integrations-payments': 'Payment Gateways', 'integrations-wifi': 'WiFi Gateways',
    'integrations-pos': 'POS Systems', 'integrations-apis': 'Third-party APIs',
    
    // Automation items
    'automation-workflows': 'Workflow Builder', 'automation-rules': 'Rules Engine',
    'automation-templates': 'Templates', 'automation-logs': 'Execution Logs',
    
    // AI items
    'ai-copilot': 'AI Copilot', 'ai-insights': 'AI Insights',
    'ai-settings': 'Provider Settings',
    
    // Admin items
    'admin-tenants': 'Tenant Management', 'admin-lifecycle': 'Tenant Lifecycle',
    'admin-users': 'User Management', 'admin-usage': 'Usage Tracking',
    'admin-revenue': 'Revenue Analytics', 'admin-health': 'System Health',
    
    // Chain items
    'chain-brands': 'Brand Management', 'chain-dashboard': 'Chain Dashboard',
    'chain-analytics': 'Cross-Property Analytics',
    
    // SaaS items
    'saas-plans': 'Plans', 'saas-subscriptions': 'Subscriptions',
    'saas-usage': 'Usage Billing',
    
    // Notifications items
    'notifications-templates': 'Templates', 'notifications-logs': 'Delivery Logs',
    'notifications-settings': 'Channel Settings',
    
    // Webhooks items
    'webhooks-events': 'Event Logs', 'webhooks-delivery': 'Delivery Logs',
    'webhooks-retry': 'Retry Queue',
    
    // Settings items
    'settings-general': 'General Settings', 'settings-tax': 'Tax & Currency',
    'settings-localization': 'Localization', 'settings-features': 'Feature Flags',
    
    // Help items
    'help-center': 'Help Center', 'help-articles': 'Articles',
    'help-tutorials': 'Tutorial Progress',
  },
  status: {
    active: 'Active', inactive: 'Inactive', pending: 'Pending', confirmed: 'Confirmed',
    checkedIn: 'Checked In', checkedOut: 'Checked Out', cancelled: 'Cancelled',
    noShow: 'No Show', available: 'Available', occupied: 'Occupied',
    maintenance: 'Maintenance', outOfOrder: 'Out of Order', dirty: 'Dirty',
    clean: 'Clean', inspected: 'Inspected', processing: 'Processing',
    completed: 'Completed', failed: 'Failed', draft: 'Draft', published: 'Published',
    expired: 'Expired', trial: 'Trial', suspended: 'Suspended', verified: 'Verified',
    rejected: 'Rejected',
  },
  dashboard: {
    title: 'Dashboard', welcome: 'Welcome back!', totalRevenue: 'Total Revenue',
    occupancyRate: 'Occupancy Rate', activeBookings: 'Active Bookings',
    totalGuests: 'Total Guests', availableRooms: 'Available Rooms',
    pendingTasks: 'Pending Tasks', recentActivity: 'Recent Activity',
    upcomingArrivals: 'Upcoming Arrivals', upcomingDepartures: 'Upcoming Departures',
    todaysStats: "Today's Statistics", quickActions: 'Quick Actions',
    newBooking: 'New Booking', newGuest: 'New Guest', newCheckIn: 'New Check-In',
    newCheckOut: 'New Check-Out', runReport: 'Run Report',
    criticalAlerts: 'Critical Alerts', warnings: 'Warnings', informational: 'Info',
    // Additional KPI translations
    vsYesterday: 'vs yesterday', vsLastWeek: 'vs last week',
    guests: 'guests', arrivalsToday: 'arrivals today',
    guestsOnProperty: 'Guests On Property', checkedIn: 'checked in',
    arrivingToday: 'arriving today', adr: 'ADR', averageDailyRate: 'average daily rate',
    revpar: 'RevPAR', revenuePerRoom: 'revenue per room',
    wifiSessions: 'WiFi Sessions', activeNow: 'active now',
    serviceRequests: 'Service Requests',
  },
  forms: {
    required: 'Required', optional: 'Optional', firstName: 'First Name',
    lastName: 'Last Name', email: 'Email', phone: 'Phone', address: 'Address',
    city: 'City', country: 'Country', postalCode: 'Postal Code',
    dateOfBirth: 'Date of Birth', nationality: 'Nationality', idType: 'ID Type',
    idNumber: 'ID Number', checkInDate: 'Check-In Date', checkOutDate: 'Check-Out Date',
    roomType: 'Room Type', roomNumber: 'Room Number', numberOfGuests: 'Number of Guests',
    adults: 'Adults', children: 'Children', infants: 'Infants',
    specialRequests: 'Special Requests', notes: 'Notes', amount: 'Amount',
    currency: 'Currency', paymentMethod: 'Payment Method', reference: 'Reference',
    description: 'Description', name: 'Name', code: 'Code', price: 'Price',
    quantity: 'Quantity', total: 'Total', subtotal: 'Subtotal', tax: 'Tax',
    discount: 'Discount', startDate: 'Start Date', endDate: 'End Date',
    priority: 'Priority', assignedTo: 'Assigned To', createdAt: 'Created At',
    updatedAt: 'Updated At',
  },
  messages: {
    saveSuccess: 'Changes saved successfully', saveError: 'Failed to save changes',
    deleteConfirm: 'Are you sure you want to delete this item?',
    deleteSuccess: 'Item deleted successfully', deleteError: 'Failed to delete item',
    createSuccess: 'Item created successfully', createError: 'Failed to create item',
    updateSuccess: 'Item updated successfully', updateError: 'Failed to update item',
    copySuccess: 'Copied to clipboard', copyError: 'Failed to copy',
    uploadSuccess: 'File uploaded successfully', uploadError: 'Failed to upload file',
    exportSuccess: 'Data exported successfully', exportError: 'Failed to export data',
    importSuccess: 'Data imported successfully', importError: 'Failed to import data',
    networkError: 'Network error. Please try again.',
    sessionExpired: 'Your session has expired. Please log in again.',
    unauthorized: 'You are not authorized to perform this action',
    validationError: 'Please check your input and try again',
  },
  language: {
    title: 'Language', selectLanguage: 'Select Language', currentLanguage: 'Current Language',
    changeLanguage: 'Change Language', languageChanged: 'Language changed successfully',
  },
  settings: {
    general: 'General Settings', propertyInfo: 'Property Information',
    businessInfo: 'Business Information', contactDetails: 'Contact Details',
    operationalSettings: 'Operational Settings', taxSettings: 'Tax Settings',
    currencySettings: 'Currency Settings', languageSettings: 'Language Settings',
    timezoneSettings: 'Timezone Settings', dateFormat: 'Date Format',
    timeFormat: 'Time Format', defaultLanguage: 'Default Language',
    guestFacingLanguage: 'Guest-Facing Language', autoTranslate: 'Auto-translate',
    featureSettings: 'Feature Settings', securitySettings: 'Security Settings',
    twoFactorAuth: 'Two-Factor Authentication', sessionTimeout: 'Session Timeout',
    passwordPolicy: 'Password Policy', auditLogging: 'Audit Logging',
  },
  auth: {
    login: 'Login', logout: 'Logout', email: 'Email', password: 'Password',
    rememberMe: 'Remember me', forgotPassword: 'Forgot password?',
    resetPassword: 'Reset Password', newPassword: 'New Password',
    confirmPassword: 'Confirm Password', changePassword: 'Change Password',
    loginError: 'Invalid email or password', logoutSuccess: 'Logged out successfully',
    sessionExpired: 'Session expired', unauthorized: 'Unauthorized access',
  },
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [translations, setTranslations] = useState<Translations>(defaultTranslations);
  const [isLoading, setIsLoading] = useState(false);

  // Load locale from cookie on mount
  useEffect(() => {
    const loadLocale = async () => {
      try {
        const response = await fetch('/api/settings/locale');
        if (response.ok) {
          const data = await response.json();
          if (data.locale && locales.includes(data.locale)) {
            setLocaleState(data.locale);
          }
        }
      } catch (error) {
        console.error('Failed to load locale:', error);
      }
    };
    loadLocale();
  }, []);

  // Load translations when locale changes
  useEffect(() => {
    const loadTranslations = async () => {
      if (locale === 'en') {
        // Create a new object reference for English to ensure React detects the change
        setTranslations({
          common: { ...defaultTranslations.common },
          navigation: { ...defaultTranslations.navigation },
          status: { ...defaultTranslations.status },
          dashboard: { ...defaultTranslations.dashboard },
          forms: { ...defaultTranslations.forms },
          messages: { ...defaultTranslations.messages },
          language: { ...defaultTranslations.language },
          settings: { ...defaultTranslations.settings },
          auth: { ...defaultTranslations.auth },
        });
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(`/api/translations?locale=${locale}`);
        if (response.ok) {
          const data = await response.json();
          setTranslations({
            common: { ...defaultTranslations.common, ...data.common },
            navigation: { ...defaultTranslations.navigation, ...data.navigation },
            status: { ...defaultTranslations.status, ...data.status },
            dashboard: { ...defaultTranslations.dashboard, ...data.dashboard },
            forms: { ...defaultTranslations.forms, ...data.forms },
            messages: { ...defaultTranslations.messages, ...data.messages },
            language: { ...defaultTranslations.language, ...data.language },
            settings: { ...defaultTranslations.settings, ...data.settings },
            auth: { ...defaultTranslations.auth, ...data.auth },
          });
        }
      } catch (error) {
        console.error('Failed to load translations:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadTranslations();
  }, [locale]);

  const setLocale = useCallback(async (newLocale: Locale) => {
    setLocaleState(newLocale);
    
    // Save to cookie via API
    try {
      await fetch('/api/settings/locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: newLocale }),
      });
    } catch (error) {
      console.error('Failed to save locale:', error);
    }
  }, []);

  // Helper functions with fallback
  const tCommon = useCallback((key: string) => translations.common[key] || key, [translations]);
  const tNav = useCallback((key: string) => translations.navigation[key] || key, [translations]);
  const tStatus = useCallback((key: string) => translations.status[key] || key, [translations]);
  const tDashboard = useCallback((key: string) => translations.dashboard[key] || key, [translations]);
  const tForms = useCallback((key: string) => translations.forms[key] || key, [translations]);
  const tMessages = useCallback((key: string) => translations.messages[key] || key, [translations]);
  const tSettings = useCallback((key: string) => translations.settings[key] || key, [translations]);
  const tAuth = useCallback((key: string) => translations.auth[key] || key, [translations]);

  const value = useMemo(() => ({
    locale,
    setLocale,
    t: translations,
    isLoading,
    tCommon,
    tNav,
    tStatus,
    tDashboard,
    tForms,
    tMessages,
    tSettings,
    tAuth,
  }), [locale, setLocale, translations, isLoading, tCommon, tNav, tStatus, tDashboard, tForms, tMessages, tSettings, tAuth]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

// Export for convenience
export { I18nContext };
