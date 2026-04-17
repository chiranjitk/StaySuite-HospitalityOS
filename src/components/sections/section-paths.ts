// Section resolver — maps section names to component file paths
// No import() calls here! Just string mappings.
// page.tsx will use require() at runtime to load the actual components.

const sectionPaths: Record<string, string> = {
  // Dashboard
  'overview': '@/components/dashboard/overview-dashboard',
  'dashboard-overview': '@/components/dashboard/overview-dashboard',
  'dashboard-operations': '@/components/dashboard/frontdesk-dashboard',
  'dashboard-housekeeping': '@/components/dashboard/housekeeping-dashboard',
  'dashboard-command-center': '@/components/dashboard/command-center',
  'dashboard-alerts': '@/components/notifications/notification-center-page',
  'notifications-center': '@/components/notifications/notification-center-page',
  'dashboard-kpi': '@/components/dashboard/kpi-dashboard-enhanced',

  // Admin
  'admin-tenants': '@/components/admin/tenant-management',
  'admin-tenant-lifecycle': '@/components/admin/tenant-lifecycle',
  'admin-lifecycle': '@/components/admin/tenant-lifecycle',
  'admin-users': '@/components/admin/user-management',
  'admin-usage': '@/components/admin/usage-tracking',
  'admin-revenue': '@/components/admin/revenue-analytics',
  'admin-health': '@/components/admin/system-health',
  'admin-roles': '@/components/admin/role-permissions',

  // PMS
  'pms-properties': '@/components/pms/properties-list',
  'pms-room-types': '@/components/pms/room-types-manager',
  'pms-rooms': '@/components/pms/rooms-manager',
  'pms-floor-plans': '@/components/pms/floor-plans',
  'pms-inventory-calendar': '@/components/pms/inventory-calendar',
  'pms-pricing-rules': '@/components/pms/rate-plans-pricing-rules',
  'pms-rate-plans': '@/components/pms/rate-plans-pricing-rules',
  'pms-rate-plans-pricing': '@/components/pms/rate-plans-pricing-rules',
  'pms-availability': '@/components/pms/availability-control',
  'pms-locking': '@/components/pms/inventory-locking',
  'pms-overbooking': '@/components/pms/overbooking-settings',
  'pms-bulk-price': '@/components/pms/bulk-price-update',
  'pms-revenue': '@/components/pms/revenue-dashboard',

  // Bookings
  'bookings-calendar': '@/components/bookings/bookings-calendar-list',
  'bookings-groups': '@/components/bookings/group-bookings',
  'bookings-waitlist': '@/components/bookings/waitlist',
  'bookings-audit': '@/components/bookings/audit-logs',
  'bookings-conflicts': '@/components/bookings/conflicts',
  'bookings-no-show': '@/components/bookings/no-show-automation',

  // Guests
  'guests-list': '@/components/guests/guests-list',
  'guests-kyc': '@/components/guests/kyc-management',
  'guests-preferences': '@/components/guests/preferences-management',
  'guests-stay-history': '@/components/guests/stay-history-management',
  'guests-history': '@/components/guests/stay-history-management',
  'guests-loyalty': '@/components/guests/loyalty-management',

  // Front Desk
  'frontdesk-checkin': '@/components/frontdesk/check-in',
  'frontdesk-checkout': '@/components/frontdesk/check-out',
  'frontdesk-walkin': '@/components/frontdesk/walk-in',
  'frontdesk-room-grid': '@/components/frontdesk/room-grid',
  'frontdesk-assignment': '@/components/frontdesk/room-assignment',

  // WiFi
  'wifi-sessions': '@/components/wifi/sessions',
  'wifi-vouchers': '@/components/wifi/vouchers',
  'wifi-plans': '@/components/wifi/plans',
  'wifi-logs': '@/components/wifi/usage-logs',
  'wifi-gateway': '@/components/wifi/gateway-integration',
  'wifi-aaa': '@/components/wifi/aaa-config',
  'wifi-network': '@/components/wifi/network-page',
  'wifi-dhcp': '@/components/wifi/dhcp-page',
  'wifi-portal': '@/components/wifi/portal-page',
  'wifi-firewall': '@/components/wifi/firewall-page',
  'wifi-reports': '@/components/wifi/reports-page',
  'wifi-access': '@/components/wifi/wifi-access-page',
  'wifi-gateway-radius': '@/components/wifi/gateway-radius-page',
  'wifi-dns': '@/components/wifi/dns-page',

  // Billing
  'billing-folios': '@/components/billing/folios',
  'billing-invoices': '@/components/billing/invoices',
  'billing-payments': '@/components/billing/payments',
  'billing-refunds': '@/components/billing/refunds',
  'billing-discounts': '@/components/billing/discounts',
  'billing-cancellation-policies': '@/components/billing/cancellation-policies',
  'billing-saas-plans': '@/components/billing/saas-plans',
  'saas-plans': '@/components/billing/saas-plans',
  'billing-saas-subs': '@/components/billing/subscriptions',
  'saas-subscriptions': '@/components/billing/subscriptions',
  'billing-saas-usage': '@/components/billing/usage-billing',
  'saas-usage': '@/components/billing/usage-billing',

  // Inventory
  'inventory-stock': '@/components/inventory/stock-items',
  'inventory-consumption': '@/components/inventory/consumption-logs',
  'inventory-alerts': '@/components/inventory/low-stock-alerts',
  'inventory-vendors': '@/components/inventory/vendors',
  'inventory-purchase-orders': '@/components/inventory/purchase-orders',
  'inventory-po': '@/components/inventory/purchase-orders',

  // Housekeeping
  'housekeeping-tasks': '@/components/housekeeping/tasks-list',
  'housekeeping-kanban': '@/components/housekeeping/kanban-board',
  'housekeeping-status': '@/components/housekeeping/room-status',
  'housekeeping-maintenance': '@/components/housekeeping/maintenance',
  'housekeeping-preventive': '@/components/housekeeping/maintenance',
  'housekeeping-assets': '@/components/housekeeping/assets',
  'housekeeping-automation': '@/components/housekeeping/housekeeping-automation',
  'housekeeping-inspections': '@/components/housekeeping/inspection-checklists',

  // POS
  'pos-orders': '@/components/pos/orders',
  'pos-tables': '@/components/pos/tables',
  'pos-kitchen': '@/components/pos/kitchen-display',
  'pos-menu': '@/components/pos/menu-management',
  'pos-billing': '@/components/pos/billing',

  // Experience
  'experience-requests': '@/components/experience/service-requests',
  'experience-inbox': '@/components/communication/unified-inbox',
  'experience-chat': '@/components/experience/guest-chat',
  'experience-keys': '@/components/experience/digital-keys',
  'experience-portal': '@/components/experience/in-room-portal',
  'experience-app': '@/components/experience/guest-app-controls',
  'experience-app-controls': '@/components/experience/guest-app-controls',

  // Parking
  'parking-slots': '@/components/parking/slots',
  'parking-tracking': '@/components/parking/vehicle-tracking',
  'parking-mapping': '@/components/parking/vehicle-tracking',
  'parking-billing': '@/components/parking/vehicle-tracking',

  // Security
  'security-live': '@/components/security/live-camera',
  'security-playback': '@/components/security/camera-playback',
  'security-alerts': '@/components/security/incidents',
  'security-incidents': '@/components/security/incidents',
  'security-overview': '@/components/security/security-overview',
  'security-audit-logs': '@/components/audit/audit-logs-viewer',
  'security-2fa': '@/components/security/two-factor-setup',
  'security-sessions': '@/components/security/device-sessions',
  'security-sso': '@/components/security/sso-config',

  // Channels
  'channel-ota': '@/components/channels/ota-connections',
  'channel-inventory': '@/components/channels/inventory-sync',
  'channel-rate': '@/components/channels/rate-sync',
  'channel-booking': '@/components/channels/booking-sync',
  'channel-restrictions': '@/components/channels/restrictions',
  'channel-mapping': '@/components/channels/mapping',
  'channel-logs': '@/components/channels/sync-logs',
  'channel-crs': '@/components/channels/crs',

  // Reports
  'reports-revenue': '@/components/reports/revenue-reports',
  'reports-occupancy': '@/components/reports/occupancy-reports',
  'reports-adr': '@/components/reports/adr-revpar',
  'reports-revpar': '@/components/reports/adr-revpar',
  'reports-guest': '@/components/reports/guest-analytics-reports',
  'reports-guests': '@/components/reports/guest-analytics-reports',
  'reports-staff': '@/components/reports/staff-performance',
  'reports-scheduled': '@/components/reports/scheduled-reports',

  // Revenue
  'revenue-pricing': '@/components/pms/rate-plans-pricing-rules',
  'revenue-rules': '@/components/pms/rate-plans-pricing-rules',
  'revenue-forecast': '@/components/revenue/demand-forecasting-page',
  'revenue-demand': '@/components/revenue/demand-forecasting-page',
  'revenue-forecasting': '@/components/revenue/demand-forecasting-page',
  'revenue-competitor': '@/components/revenue/competitor-pricing',
  'revenue-compset': '@/components/revenue/competitor-pricing',
  'revenue-ai': '@/components/revenue/ai-suggestions',
  'revenue-suggestions': '@/components/revenue/ai-suggestions',

  // CRM
  'crm-segments': '@/components/crm/guest-segments',
  'crm-campaigns': '@/components/crm/campaigns',
  'crm-loyalty': '@/components/crm/loyalty-programs',
  'crm-feedback': '@/components/crm/feedback-reviews',
  'crm-retention': '@/components/crm/retention-analytics',

  // Settings
  'settings-general': '@/components/settings/general',
  'settings-tax': '@/components/settings/tax-currency',
  'settings-localization': '@/components/settings/localization',
  'settings-features': '@/components/settings/feature-flags',
  'settings-security': '@/components/settings/security',
  'settings-integrations': '@/components/settings/system-integrations',

  // Chain
  'chain-brands': '@/components/chain/brand-management',
  'chain-dashboard': '@/components/chain/chain-dashboard',
  'chain-analytics': '@/components/chain/cross-property-analytics',

  // Marketing
  'marketing-reputation': '@/components/marketing/reputation-dashboard',
  'marketing-reviews': '@/components/marketing/review-sources',
  'marketing-sources': '@/components/marketing/review-sources',
  'marketing-promotions': '@/components/crm/campaigns',
  'marketing-booking-engine': '@/components/marketing/direct-booking-engine',

  // Events
  'events-spaces': '@/components/events/event-spaces',
  'events-calendar': '@/components/events/event-calendar',
  'events-booking': '@/components/events/event-booking',
  'events-resources': '@/components/events/event-resources',

  // IoT
  'iot-devices': '@/components/iot/device-management',
  'iot-controls': '@/components/iot/room-controls',
  'iot-energy': '@/components/iot/energy-dashboard',

  // Staff
  'staff-shifts': '@/components/staff/shift-scheduling',
  'staff-attendance': '@/components/staff/attendance-tracking',
  'staff-tasks': '@/components/staff/task-assignment',
  'staff-communication': '@/components/staff/internal-communication',
  'staff-performance': '@/components/reports/staff-performance',
  'staff-skills': '@/components/staff/skills-management',

  // Other
  'settings-gdpr': '@/components/gdpr/gdpr-manager',
  'admin-gdpr': '@/components/gdpr/gdpr-manager',
  'gdpr-compliance': '@/components/gdpr/gdpr-manager',
  'automation-workflow': '@/components/automation/workflow-builder',
  'automation-workflows': '@/components/automation/workflow-builder',
  'automation-rules': '@/components/automation/rules-engine',
  'automation-templates': '@/components/automation/templates',
  'automation-logs': '@/components/automation/execution-logs',
  'integrations-payment': '@/components/integrations/payment-gateways-page',
  'integrations-payments': '@/components/integrations/payment-gateways-page',
  'integrations-wifi': '@/components/integrations/wifi-gateways',
  'integrations-pos': '@/components/integrations/pos-systems',
  'integrations-apis': '@/components/integrations/third-party-apis',
  'notifications-templates': '@/components/notifications/templates',
  'notifications-logs': '@/components/notifications/delivery-logs',
  'notifications-settings': '@/components/notifications/settings',
  'webhooks-events': '@/components/webhooks/events',
  'webhooks-delivery': '@/components/webhooks/delivery',
  'webhooks-retry': '@/components/webhooks/retry-queue',
  'ai-copilot': '@/components/ai/copilot',
  'ai-provider': '@/components/ai/provider-settings',
  'ai-settings': '@/components/ai/provider-settings',
  'ai-insights': '@/components/ai/insights',
  'help-center': '@/components/help/help-center-landing',
  'help-articles': '@/components/help/articles-library',
  'help-tutorials': '@/components/help/tutorial-progress-page',
  'profile': '@/components/profile/user-profile',
  'profile-user': '@/components/profile/user-profile',
  'ui-showcase': '@/components/showcase/ui-style-showcase',
  'ads-campaigns': '@/components/ads/ad-campaigns',
  'ads-google': '@/components/ads/google-hotel-ads',
  'ads-performance': '@/components/ads/performance-tracking',
  'ads-roi': '@/components/ads/roi-analytics',
};

export function getSectionPath(section: string): string | null {
  return sectionPaths[section] || null;
}

export function hasSection(section: string): boolean {
  return section in sectionPaths;
}
