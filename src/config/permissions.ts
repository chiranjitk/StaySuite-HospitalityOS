// =====================================================
// PERMISSION CONFIGURATION
// =====================================================
// This file defines the permission requirements for each
// menu item and feature in the application.
//
// Permission Format: "module.action" or "module.submodule.action"
// - Wildcard "*" means all permissions
// - Module wildcard "module.*" means all actions in that module
// =====================================================

export interface PermissionConfig {
  // Menu item ID (from navigation.ts href without #)
  [menuItemId: string]: {
    // Required permission(s) - user needs ANY of these
    permissions: string[];
    // Description for admin UI
    description?: string;
  };
}

// =====================================================
// MENU PERMISSION MAPPINGS
// =====================================================
export const menuPermissions: PermissionConfig = {
  // ---- Dashboard ----
  'dashboard-overview': {
    permissions: ['dashboard.view', 'dashboard.full', '*'],
    description: 'View full dashboard overview with financial data'
  },
  'overview': {
    permissions: ['dashboard.view', 'dashboard.full', '*'],
    description: 'View full dashboard overview with financial data'
  },
  'dashboard-command-center': {
    permissions: ['dashboard.command', 'dashboard.view', 'dashboard.full', '*'],
    description: 'Access command center'
  },
  'dashboard-alerts': {
    permissions: ['dashboard.alerts', 'dashboard.view', 'dashboard.full', '*'],
    description: 'View alerts and notifications'
  },
  'dashboard-kpi': {
    permissions: ['dashboard.view', 'dashboard.full', '*'],
    description: 'View KPI cards'
  },
  // Role-specific dashboards
  'dashboard-operations': {
    permissions: ['dashboard.operations', 'dashboard.view', 'dashboard.full', '*'],
    description: 'View operations dashboard (arrivals, departures)'
  },
  'dashboard-housekeeping': {
    permissions: ['dashboard.housekeeping', 'dashboard.view', 'dashboard.full', '*'],
    description: 'View housekeeping dashboard (tasks, room status)'
  },

  // ---- PMS ----
  'pms-properties': {
    permissions: ['properties.view', 'properties.manage', '*'],
    description: 'View and manage properties'
  },
  'pms-room-types': {
    permissions: ['rooms.view', 'rooms.manage', '*'],
    description: 'Manage room types'
  },
  'pms-rooms': {
    permissions: ['rooms.view', 'rooms.manage', '*'],
    description: 'Manage rooms'
  },
  'pms-inventory-calendar': {
    permissions: ['inventory.view', 'inventory.manage', '*'],
    description: 'View inventory calendar'
  },
  'pms-availability': {
    permissions: ['inventory.view', 'inventory.manage', '*'],
    description: 'Control availability'
  },
  'pms-locking': {
    permissions: ['inventory.manage', '*'],
    description: 'Lock inventory'
  },
  'pms-rate-plans-pricing': {
    permissions: ['pricing.view', 'pricing.manage', '*'],
    description: 'Manage rate plans and pricing'
  },
  'pms-overbooking': {
    permissions: ['inventory.manage', '*'],
    description: 'Configure overbooking settings'
  },
  'pms-floor-plans': {
    permissions: ['rooms.view', 'rooms.manage', '*'],
    description: 'View and manage floor plans'
  },

  // ---- Bookings ----
  'bookings-calendar': {
    permissions: ['bookings.view', 'bookings.create', 'bookings.*', '*'],
    description: 'View bookings calendar'
  },
  'bookings-groups': {
    permissions: ['bookings.create', 'bookings.manage', 'bookings.*', '*'],
    description: 'Manage group bookings'
  },
  'bookings-waitlist': {
    permissions: ['bookings.view', 'bookings.manage', '*'],
    description: 'Manage waitlist'
  },
  'bookings-conflicts': {
    permissions: ['bookings.manage', '*'],
    description: 'Resolve booking conflicts'
  },
  'bookings-audit': {
    permissions: ['bookings.audit', 'audit.view', '*'],
    description: 'View booking audit logs'
  },
  'bookings-no-show': {
    permissions: ['bookings.manage', 'bookings.update', '*'],
    description: 'Manage no-show automation'
  },

  // ---- Front Desk ----
  'frontdesk-checkin': {
    permissions: ['frontdesk.checkin', 'bookings.create', 'frontdesk.*', '*'],
    description: 'Process check-ins'
  },
  'frontdesk-checkout': {
    permissions: ['frontdesk.checkout', 'bookings.update', 'frontdesk.*', '*'],
    description: 'Process check-outs'
  },
  'frontdesk-walkin': {
    permissions: ['frontdesk.walkin', 'bookings.create', 'frontdesk.*', '*'],
    description: 'Create walk-in bookings'
  },
  'frontdesk-room-grid': {
    permissions: ['frontdesk.view', 'rooms.view', 'frontdesk.*', '*'],
    description: 'View room grid'
  },
  'frontdesk-assignment': {
    permissions: ['frontdesk.assign', 'rooms.update', 'frontdesk.*', '*'],
    description: 'Assign rooms to guests'
  },

  // ---- Guests ----
  'guests-list': {
    permissions: ['guests.view', 'guests.*', '*'],
    description: 'View guest list'
  },
  'guests-kyc': {
    permissions: ['guests.kyc', 'guests.manage', 'guests.*', '*'],
    description: 'Manage KYC documents'
  },
  'guests-preferences': {
    permissions: ['guests.view', 'guests.*', '*'],
    description: 'View guest preferences'
  },
  'guests-history': {
    permissions: ['guests.view', 'guests.*', '*'],
    description: 'View guest stay history'
  },
  'guests-loyalty': {
    permissions: ['guests.loyalty', 'guests.manage', 'guests.*', '*'],
    description: 'Manage loyalty points'
  },

  // ---- Housekeeping ----
  'housekeeping-tasks': {
    permissions: ['housekeeping.view', 'tasks.view', 'housekeeping.*', 'tasks.*', '*'],
    description: 'View housekeeping tasks'
  },
  'housekeeping-kanban': {
    permissions: ['housekeeping.view', 'tasks.view', 'housekeeping.*', '*'],
    description: 'View housekeeping kanban board'
  },
  'housekeeping-status': {
    permissions: ['housekeeping.view', 'rooms.view', 'housekeeping.*', '*'],
    description: 'View room status'
  },
  'housekeeping-maintenance': {
    permissions: ['housekeeping.maintenance', 'maintenance.view', 'housekeeping.*', '*'],
    description: 'Manage maintenance requests'
  },
  'housekeeping-preventive': {
    permissions: ['housekeeping.maintenance', 'maintenance.manage', 'housekeeping.*', '*'],
    description: 'Manage preventive maintenance'
  },
  'housekeeping-assets': {
    permissions: ['assets.view', 'assets.manage', 'housekeeping.*', '*'],
    description: 'Manage assets'
  },
  'housekeeping-inspections': {
    permissions: ['housekeeping.inspections', 'housekeeping.*', '*'],
    description: 'Manage inspection checklists'
  },
  'housekeeping-automation': {
    permissions: ['housekeeping.automation', 'automation.manage', 'housekeeping.*', '*'],
    description: 'Manage housekeeping automation rules'
  },

  // ---- Billing ----
  'billing-folios': {
    permissions: ['billing.view', 'billing.manage', 'billing.*', '*'],
    description: 'Manage folios'
  },
  'billing-invoices': {
    permissions: ['billing.view', 'billing.invoices', 'billing.*', '*'],
    description: 'View and create invoices'
  },
  'billing-payments': {
    permissions: ['billing.payments', 'billing.manage', 'billing.*', '*'],
    description: 'Process payments'
  },
  'billing-refunds': {
    permissions: ['billing.refunds', 'billing.manage', 'billing.*', '*'],
    description: 'Process refunds'
  },
  'billing-discounts': {
    permissions: ['billing.discounts', 'billing.manage', 'billing.*', '*'],
    description: 'Manage discounts'
  },
  'billing-cancellation-policies': {
    permissions: ['bookings.view', 'bookings.manage', 'admin.*', '*'],
    description: 'Manage cancellation policies'
  },

  // ---- Experience ----
  'experience-requests': {
    permissions: ['experience.view', 'service_requests.view', 'experience.*', '*'],
    description: 'View service requests'
  },
  'experience-inbox': {
    permissions: ['communication.view', 'experience.view', 'experience.*', '*'],
    description: 'Access unified inbox'
  },
  'experience-chat': {
    permissions: ['communication.chat', 'experience.view', 'experience.*', '*'],
    description: 'Chat with guests'
  },
  'experience-portal': {
    permissions: ['experience.portal', 'experience.*', '*'],
    description: 'Manage in-room portal'
  },
  'experience-keys': {
    permissions: ['experience.keys', 'digital_keys.manage', 'experience.*', '*'],
    description: 'Manage digital keys'
  },
  'experience-app-controls': {
    permissions: ['experience.manage', 'experience.*', '*'],
    description: 'Control guest app settings'
  },

  // ---- Restaurant & POS ----
  'pos-orders': {
    permissions: ['pos.view', 'pos.orders', 'pos.*', '*'],
    description: 'View restaurant orders'
  },
  'pos-tables': {
    permissions: ['pos.view', 'pos.tables', 'pos.*', '*'],
    description: 'Manage restaurant tables'
  },
  'pos-kitchen': {
    permissions: ['pos.kitchen', 'pos.*', '*'],
    description: 'Access kitchen display'
  },
  'pos-menu': {
    permissions: ['pos.manage', 'pos.*', '*'],
    description: 'Manage menu items'
  },
  'pos-billing': {
    permissions: ['pos.billing', 'billing.view', 'pos.*', '*'],
    description: 'Manage POS billing'
  },

  // ---- Inventory ----
  'inventory-stock': {
    permissions: ['inventory.view', 'inventory.*', '*'],
    description: 'View stock items'
  },
  'inventory-consumption': {
    permissions: ['inventory.view', 'inventory.*', '*'],
    description: 'View consumption logs'
  },
  'inventory-alerts': {
    permissions: ['inventory.view', 'inventory.*', '*'],
    description: 'View low stock alerts'
  },
  'inventory-vendors': {
    permissions: ['inventory.vendors', 'vendors.view', 'inventory.*', '*'],
    description: 'Manage vendors'
  },
  'inventory-po': {
    permissions: ['inventory.purchase', 'purchase_orders.view', 'inventory.*', '*'],
    description: 'Manage purchase orders'
  },

  // ---- Parking ----
  'parking-slots': {
    permissions: ['parking.view', 'parking.*', '*'],
    description: 'View parking slots'
  },
  'parking-tracking': {
    permissions: ['parking.view', 'parking.*', '*'],
    description: 'Track vehicles'
  },
  'parking-mapping': {
    permissions: ['parking.manage', 'parking.*', '*'],
    description: 'Map guests to parking'
  },
  'parking-billing': {
    permissions: ['parking.billing', 'billing.view', 'parking.*', '*'],
    description: 'Manage parking billing'
  },

  // ---- Surveillance ----
  'security-live': {
    permissions: ['surveillance.view', 'surveillance.*', '*'],
    description: 'View live cameras'
  },
  'security-playback': {
    permissions: ['surveillance.playback', 'surveillance.*', '*'],
    description: 'View camera playback'
  },
  'security-alerts': {
    permissions: ['surveillance.alerts', 'surveillance.*', '*'],
    description: 'View security alerts'
  },
  'security-incidents': {
    permissions: ['surveillance.incidents', 'surveillance.*', '*'],
    description: 'View incident logs'
  },

  // ---- WiFi ----
  'wifi-access': {
    permissions: ['wifi.view', 'wifi.*', '*'],
    description: 'WiFi access - sessions, vouchers, plans, logs'
  },
  'wifi-gateway-radius': {
    permissions: ['wifi.manage', 'wifi.*', '*'],
    description: 'RADIUS & Gateway configuration'
  },
  'wifi-sessions': {
    permissions: ['wifi.view', 'wifi.*', '*'],
    description: 'View WiFi sessions'
  },
  'wifi-vouchers': {
    permissions: ['wifi.vouchers', 'wifi.manage', 'wifi.*', '*'],
    description: 'Manage WiFi vouchers'
  },
  'wifi-plans': {
    permissions: ['wifi.manage', 'wifi.*', '*'],
    description: 'Manage WiFi plans'
  },
  'wifi-logs': {
    permissions: ['wifi.view', 'wifi.*', '*'],
    description: 'View WiFi usage logs'
  },
  'wifi-gateway': {
    permissions: ['wifi.manage', 'wifi.*', '*'],
    description: 'Configure WiFi gateway'
  },
  'wifi-aaa': {
    permissions: ['wifi.manage', 'wifi.*', '*'],
    description: 'Configure WiFi AAA'
  },

  // ---- Revenue Management ----
  'revenue-pricing': {
    permissions: ['revenue.view', 'revenue.manage', 'revenue.*', '*'],
    description: 'Manage pricing rules'
  },
  'revenue-forecasting': {
    permissions: ['revenue.view', 'revenue.*', '*'],
    description: 'View demand forecasting'
  },
  'revenue-competitor': {
    permissions: ['revenue.view', 'revenue.*', '*'],
    description: 'View competitor pricing'
  },
  'revenue-ai': {
    permissions: ['revenue.view', 'ai.view', 'revenue.*', '*'],
    description: 'View AI suggestions'
  },

  // ---- Channel Manager ----
  'channel-ota': {
    permissions: ['channels.view', 'channels.manage', 'channels.*', '*'],
    description: 'Manage OTA connections'
  },
  'channel-inventory': {
    permissions: ['channels.sync', 'channels.*', '*'],
    description: 'Sync inventory with channels'
  },
  'channel-rate': {
    permissions: ['channels.sync', 'channels.*', '*'],
    description: 'Sync rates with channels'
  },
  'channel-booking': {
    permissions: ['channels.view', 'channels.*', '*'],
    description: 'View booking sync'
  },
  'channel-restrictions': {
    permissions: ['channels.manage', 'channels.*', '*'],
    description: 'Manage channel restrictions'
  },
  'channel-mapping': {
    permissions: ['channels.manage', 'channels.*', '*'],
    description: 'Manage channel mapping'
  },
  'channel-logs': {
    permissions: ['channels.view', 'channels.*', '*'],
    description: 'View sync logs'
  },
  'channel-crs': {
    permissions: ['channels.manage', 'channels.*', '*'],
    description: 'Access CRS'
  },

  // ---- CRM & Marketing ----
  'crm-segments': {
    permissions: ['crm.view', 'crm.manage', 'crm.*', '*'],
    description: 'Manage guest segments'
  },
  'crm-campaigns': {
    permissions: ['crm.campaigns', 'crm.*', '*'],
    description: 'Manage campaigns'
  },
  'crm-loyalty': {
    permissions: ['crm.loyalty', 'crm.*', '*'],
    description: 'Manage loyalty programs'
  },
  'crm-feedback': {
    permissions: ['crm.view', 'crm.feedback', 'crm.*', '*'],
    description: 'View feedback and reviews'
  },
  'crm-retention': {
    permissions: ['crm.view', 'crm.*', '*'],
    description: 'View retention analytics'
  },

  // ---- Marketing ----
  'marketing-reputation': {
    permissions: ['marketing.view', 'marketing.*', '*'],
    description: 'View reputation dashboard'
  },
  'marketing-sources': {
    permissions: ['marketing.view', 'marketing.*', '*'],
    description: 'View review sources'
  },
  'marketing-booking-engine': {
    permissions: ['marketing.booking_engine', 'marketing.*', '*'],
    description: 'Manage direct booking engine'
  },
  'marketing-promotions': {
    permissions: ['marketing.manage', 'marketing.*', '*'],
    description: 'Manage promotions'
  },

  // ---- Reports ----
  'reports-revenue': {
    permissions: ['reports.view', 'reports.revenue', 'reports.*', '*'],
    description: 'View revenue reports'
  },
  'reports-occupancy': {
    permissions: ['reports.view', 'reports.occupancy', 'reports.*', '*'],
    description: 'View occupancy reports'
  },
  'reports-adr': {
    permissions: ['reports.view', 'reports.*', '*'],
    description: 'View ADR/RevPAR reports'
  },
  'reports-guests': {
    permissions: ['reports.view', 'reports.guests', 'reports.*', '*'],
    description: 'View guest analytics'
  },
  'reports-staff': {
    permissions: ['reports.view', 'reports.staff', 'reports.*', '*'],
    description: 'View staff performance reports'
  },
  'reports-scheduled': {
    permissions: ['reports.manage', 'reports.*', '*'],
    description: 'Manage scheduled reports'
  },

  // ---- Events ----
  'events-spaces': {
    permissions: ['events.view', 'events.manage', 'events.*', '*'],
    description: 'Manage event spaces'
  },
  'events-calendar': {
    permissions: ['events.view', 'events.*', '*'],
    description: 'View event calendar'
  },
  'events-booking': {
    permissions: ['events.book', 'events.*', '*'],
    description: 'Manage event bookings'
  },
  'events-resources': {
    permissions: ['events.view', 'events.*', '*'],
    description: 'Manage event resources'
  },

  // ---- Staff Management ----
  'staff-shifts': {
    permissions: ['staff.view', 'staff.scheduling', 'staff.*', '*'],
    description: 'Manage shift scheduling'
  },
  'staff-attendance': {
    permissions: ['staff.view', 'staff.attendance', 'staff.*', '*'],
    description: 'Track attendance'
  },
  'staff-tasks': {
    permissions: ['staff.view', 'tasks.assign', 'staff.*', '*'],
    description: 'Assign tasks to staff'
  },
  'staff-communication': {
    permissions: ['staff.view', 'staff.communicate', 'staff.*', '*'],
    description: 'Internal communication'
  },
  'staff-performance': {
    permissions: ['staff.view', 'staff.performance', 'staff.*', '*'],
    description: 'View staff performance'
  },
  'staff-skills': {
    permissions: ['staff.view', 'staff.skills', 'staff.*', '*'],
    description: 'Manage skills & certifications'
  },

  // ---- Security Center ----
  'security-overview': {
    permissions: ['security.view', 'security.*', '*'],
    description: 'View security overview'
  },
  'security-2fa': {
    permissions: ['security.2fa', 'security.*', '*'],
    description: 'Manage two-factor auth'
  },
  'security-sessions': {
    permissions: ['security.sessions', 'security.*', '*'],
    description: 'Manage device sessions'
  },
  'security-sso': {
    permissions: ['security.sso', 'security.*', '*'],
    description: 'Configure SSO'
  },
  'security-audit-logs': {
    permissions: ['security.audit', 'audit.view', 'security.*', '*'],
    description: 'View security audit logs'
  },

  // ---- Integrations ----
  'integrations-payments': {
    permissions: ['integrations.manage', 'integrations.*', '*'],
    description: 'Configure payment gateways'
  },
  'integrations-wifi': {
    permissions: ['integrations.manage', 'integrations.*', '*'],
    description: 'Configure WiFi gateways'
  },
  'integrations-pos': {
    permissions: ['integrations.manage', 'integrations.*', '*'],
    description: 'Configure POS systems'
  },
  'integrations-apis': {
    permissions: ['integrations.manage', 'integrations.*', '*'],
    description: 'Configure third-party APIs'
  },

  // ---- Automation ----
  'automation-workflows': {
    permissions: ['automation.view', 'automation.manage', 'automation.*', '*'],
    description: 'Manage workflows'
  },
  'automation-rules': {
    permissions: ['automation.manage', 'automation.*', '*'],
    description: 'Manage automation rules'
  },
  'automation-templates': {
    permissions: ['automation.view', 'automation.*', '*'],
    description: 'View automation templates'
  },
  'automation-logs': {
    permissions: ['automation.view', 'automation.*', '*'],
    description: 'View execution logs'
  },

  // ---- AI Assistant ----
  'ai-copilot': {
    permissions: ['ai.view', 'ai.use', 'ai.*', '*'],
    description: 'Use AI Copilot'
  },
  'ai-insights': {
    permissions: ['ai.view', 'ai.*', '*'],
    description: 'View AI insights'
  },
  'ai-settings': {
    permissions: ['ai.manage', 'ai.*', '*'],
    description: 'Configure AI providers'
  },

  // ---- Admin ----
  'admin-tenants': {
    permissions: ['admin.tenants', 'admin.*', '*'],
    description: 'Manage tenants'
  },
  'admin-roles': {
    permissions: ['admin.users', 'admin.*', '*'],
    description: 'Manage roles and permissions'
  },
  'admin-lifecycle': {
    permissions: ['admin.tenants', 'admin.*', '*'],
    description: 'Manage tenant lifecycle'
  },
  'admin-users': {
    permissions: ['admin.users', 'admin.*', '*'],
    description: 'Manage users'
  },
  'admin-usage': {
    permissions: ['admin.usage', 'admin.*', '*'],
    description: 'View usage tracking'
  },
  'admin-revenue': {
    permissions: ['admin.revenue', 'admin.*', '*'],
    description: 'View revenue analytics'
  },
  'admin-health': {
    permissions: ['admin.health', 'admin.*', '*'],
    description: 'View system health'
  },

  // ---- Chain Management ----
  'chain-brands': {
    permissions: ['chain.manage', 'chain.*', '*'],
    description: 'Manage brands'
  },
  'chain-dashboard': {
    permissions: ['chain.view', 'chain.*', '*'],
    description: 'View chain dashboard'
  },
  'chain-analytics': {
    permissions: ['chain.view', 'chain.*', '*'],
    description: 'View cross-property analytics'
  },

  // ---- SaaS Billing ----
  'saas-plans': {
    permissions: ['saas.view', 'saas.*', '*'],
    description: 'View SaaS plans'
  },
  'saas-subscriptions': {
    permissions: ['saas.manage', 'saas.*', '*'],
    description: 'Manage subscriptions'
  },
  'saas-usage': {
    permissions: ['saas.view', 'saas.*', '*'],
    description: 'View usage billing'
  },

  // ---- Notifications ----
  'notifications-templates': {
    permissions: ['notifications.manage', 'notifications.*', '*'],
    description: 'Manage notification templates'
  },
  'notifications-logs': {
    permissions: ['notifications.view', 'notifications.*', '*'],
    description: 'View delivery logs'
  },
  'notifications-settings': {
    permissions: ['notifications.manage', 'notifications.*', '*'],
    description: 'Configure notification settings'
  },

  // ---- Webhooks ----
  'webhooks-events': {
    permissions: ['webhooks.view', 'webhooks.*', '*'],
    description: 'View webhook events'
  },
  'webhooks-delivery': {
    permissions: ['webhooks.view', 'webhooks.*', '*'],
    description: 'View delivery logs'
  },
  'webhooks-retry': {
    permissions: ['webhooks.manage', 'webhooks.*', '*'],
    description: 'Manage retry queue'
  },

  // ---- Settings ----
  'settings-general': {
    permissions: ['settings.view', 'settings.manage', 'settings.*', '*'],
    description: 'View general settings'
  },
  'settings-tax': {
    permissions: ['settings.manage', 'settings.*', '*'],
    description: 'Manage tax and currency settings'
  },
  'settings-localization': {
    permissions: ['settings.view', 'settings.manage', 'settings.*', '*'],
    description: 'Manage localization settings'
  },
  'settings-features': {
    permissions: ['settings.features', 'settings.*', '*'],
    description: 'Manage feature flags'
  },
  'settings-gdpr': {
    permissions: ['gdpr.manage', 'gdpr.*', 'settings.manage', '*'],
    description: 'Manage GDPR compliance'
  },
  'settings-security': {
    permissions: ['settings.manage', 'security.manage', 'admin.*', '*'],
    description: 'Manage security settings'
  },
  'settings-integrations': {
    permissions: ['settings.manage', 'admin.*', '*'],
    description: 'Configure system integrations (SMTP, SMS, S3, etc.)'
  },

  // ---- Digital Advertising ----
  'ads-campaigns': {
    permissions: ['ads.manage', 'marketing.*', '*'],
    description: 'Manage ad campaigns'
  },
  'ads-google': {
    permissions: ['ads.manage', 'marketing.*', '*'],
    description: 'Configure Google Hotel Ads'
  },
  'ads-performance': {
    permissions: ['ads.view', 'marketing.*', '*'],
    description: 'View ad performance tracking'
  },
  'ads-roi': {
    permissions: ['ads.view', 'marketing.*', 'reports.view', '*'],
    description: 'View ROI analytics'
  },

  // ---- Help ----
  'help-center': {
    permissions: ['help.view', '*'],
    description: 'Access help center'
  },
  'help-articles': {
    permissions: ['help.view', '*'],
    description: 'View help articles'
  },
  'help-tutorials': {
    permissions: ['help.view', '*'],
    description: 'View tutorial progress'
  },

  // ---- UI Showcase ----
  'ui-showcase': {
    permissions: ['settings.view', 'settings.manage', '*'],
    description: 'View UI design style showcase'
  },

  // ---- IoT ----
  'iot-devices': {
    permissions: ['iot.manage', 'iot.*', '*'],
    description: 'Manage IoT devices'
  },
  'iot-controls': {
    permissions: ['iot.control', 'iot.*', '*'],
    description: 'Control IoT devices'
  },
  'iot-energy': {
    permissions: ['iot.view', 'iot.*', '*'],
    description: 'View energy dashboard'
  },
};

// =====================================================
// ROLE DEFAULT PERMISSIONS
// =====================================================
export const rolePermissions: Record<string, string[]> = {
  // Admin - Full access
  admin: ['*'],

  // Manager - Operations and reports access
  manager: [
    'dashboard.full',
    'bookings.*',
    'guests.*',
    'rooms.view',
    'rooms.update',
    'housekeeping.view',
    'billing.view',
    'reports.*',
    'frontdesk.*',
    'settings.read',
    'notifications.view',
  ],

  // Front Desk - Front desk operations
  front_desk: [
    'dashboard.operations',  // Can see operations dashboard (no financial data)
    'bookings.view',
    'bookings.create',
    'bookings.update',
    'guests.view',
    'guests.create',
    'guests.update',
    'rooms.view',
    'frontdesk.*',
    'billing.view',
    'billing.create',
    'experience.view',
    'communication.chat',
  ],

  // Housekeeping - Housekeeping operations
  housekeeping: [
    'dashboard.housekeeping',  // Can only see housekeeping dashboard
    'rooms.view',
    'rooms.update_status',  // Can only update room status
    'tasks.*',
    'housekeeping.*',
    'maintenance.view',
    'maintenance.create',
    'assets.view',
  ],

  // Night Auditor - Night audit operations
  night_auditor: [
    'dashboard.operations',
    'bookings.view',
    'guests.view',
    'billing.view',
    'billing.create',
    'reports.view',
    'frontdesk.checkin',
    'frontdesk.checkout',
  ],

  // Revenue Manager - Revenue and pricing
  revenue_manager: [
    'dashboard.full',
    'reports.*',
    'revenue.*',
    'pricing.*',
    'channels.*',
    'bookings.view',
    'inventory.view',
  ],

  // Marketing - Marketing and CRM
  marketing: [
    'dashboard.view',
    'guests.view',
    'crm.*',
    'marketing.*',
    'reports.view',
    'communication.*',
  ],

  // Accountant - Financial operations
  accountant: [
    'dashboard.full',
    'billing.*',
    'reports.revenue',
    'reports.occupancy',
    'invoices.*',
    'payments.*',
  ],

  // Maintenance - Maintenance operations
  maintenance: [
    'dashboard.housekeeping',
    'rooms.view',
    'tasks.view',
    'tasks.update',
    'maintenance.*',
    'assets.view',
    'assets.update',
    'iot.view',
  ],
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Get required permissions for a menu item
 * Returns empty array if menu item is not defined (deny by default)
 */
export function getMenuPermissions(menuItemId: string): string[] {
  return menuPermissions[menuItemId]?.permissions || [];
}

/**
 * Check if a user has access to a menu item
 */
export function hasMenuAccess(userPermissions: string[], menuItemId: string): boolean {
  // Admin has access to everything
  if (userPermissions.includes('*')) return true;

  const requiredPermissions = getMenuPermissions(menuItemId);

  // If no permissions defined, deny access (deny-by-default policy)
  if (!requiredPermissions || requiredPermissions.length === 0) return false;

  // Check if user has any of the required permissions
  return requiredPermissions.some(required => {
    // Check exact match
    if (userPermissions.includes(required)) return true;

    // Check wildcard match (e.g., "bookings.*" matches "bookings.view")
    const [module] = required.split('.');
    if (userPermissions.includes(`${module}.*`)) return true;

    return false;
  });
}

/**
 * Get all menu items a user can access
 */
export function getAccessibleMenus(userPermissions: string[]): string[] {
  return Object.keys(menuPermissions).filter(menuId =>
    hasMenuAccess(userPermissions, menuId)
  );
}

/**
 * Check if user has a specific permission
 */
export function checkMenuPermission(userPermissions: string[], permission: string): boolean {
  if (userPermissions.includes('*')) return true;
  if (userPermissions.includes(permission)) return true;

  // Check module wildcard
  const [module] = permission.split('.');
  if (userPermissions.includes(`${module}.*`)) return true;

  return false;
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(userPermissions: string[], permissions: string[]): boolean {
  return permissions.some(p => checkMenuPermission(userPermissions, p));
}

/**
 * Check if user has all of the specified permissions
 */
export function hasAllPermissions(userPermissions: string[], permissions: string[]): boolean {
  return permissions.every(p => checkMenuPermission(userPermissions, p));
}
