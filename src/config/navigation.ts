import {
  LayoutDashboard,
  Building2,
  CalendarDays,
  Users,
  ConciergeBell,
  Sparkles,
  Wifi,
  Receipt,
  UtensilsCrossed,
  Brush,
  Package,
  Car,
  Video,
  Brain,
  Bot,
  BarChart3,
  TrendingUp,
  Globe,
  Plug,
  Bell,
  Webhook,
  Settings,
  Shield,
  GraduationCap,
  MessageSquare,
  Star,
  Megaphone,
  Clock,
  Lock,
  CreditCard,
  Kanban,
  Wrench,
  AlertTriangle,
  Layers,
  LucideIcon,
  Key,
  FileText,
  History,
  Users2,
  Wallet,
  Radio,
  Server,
  DollarSign,
  Target,
  PartyPopper,
  UserCheck,
  Zap,
  LogIn,
  LogOut,
  Inbox,
  CalendarClock,
  UserCog,
  Building,
  RefreshCw,
  Crown,
  Gift,
  Heart,
  Bookmark,
  ClipboardList,
  BadgePercent,
  BookOpen,
  PlayCircle,
  Smartphone,
  Palette,
  Volume2,
  Network,
  HardDrive,
  ShieldCheck,
  Activity,
} from 'lucide-react';

export interface NavItem {
  id: string; // Stable ID for translations and React keys
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string | number;
  badgeVariant?: 'default' | 'destructive' | 'success' | 'warning';
}

export interface NavSection {
  id: string; // Stable ID for translations and React keys
  title: string;
  icon: LucideIcon;
  items: NavItem[];
  category?: 'base' | 'addons'; // For feature flag grouping
}

// =====================================================
// STAYSUITE MENU CONFIGURATION
// =====================================================
// 
// MODULE CATEGORIES:
// - BASE MODULES: Core functionality required for hotel operations
//   (Always enabled, cannot be disabled)
// - ADDON MODULES: Optional features that can be enabled/disabled
//   via Feature Flags in Settings
//
// DISABLED MODULES: Menu items automatically hidden when feature disabled
// =====================================================

export const navigationConfig: NavSection[] = [
  // =====================================================
  // BASE MODULES - Core Operations (Always Enabled)
  // =====================================================
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: LayoutDashboard,
    category: 'base',
    items: [
      { id: 'dashboard-overview', title: 'Overview', href: '#dashboard-overview', icon: LayoutDashboard },
      { id: 'dashboard-command-center', title: 'Command Center', href: '#dashboard-command-center', icon: Radio },
      { id: 'dashboard-alerts', title: 'Alerts & Notifications', href: '#dashboard-alerts', icon: Bell },
      { id: 'dashboard-kpi', title: 'KPI Cards', href: '#dashboard-kpi', icon: BarChart3 },
    ],
  },
  {
    id: 'pms',
    title: 'PMS',
    icon: Building2,
    category: 'base',
    items: [
      { id: 'pms-properties', title: 'Properties', href: '#pms-properties', icon: Building2 },
      { id: 'pms-room-types', title: 'Room Types', href: '#pms-room-types', icon: Layers },
      { id: 'pms-rooms', title: 'Rooms', href: '#pms-rooms', icon: Key },
      { id: 'pms-inventory-calendar', title: 'Inventory Calendar', href: '#pms-inventory-calendar', icon: CalendarDays },
      { id: 'pms-availability', title: 'Availability Control', href: '#pms-availability', icon: Clock },
      { id: 'pms-locking', title: 'Inventory Locking', href: '#pms-locking', icon: Lock },
      { id: 'pms-rate-plans-pricing', title: 'Rate Plans & Pricing', href: '#pms-rate-plans-pricing', icon: DollarSign },
      { id: 'pms-overbooking', title: 'Overbooking Settings', href: '#pms-overbooking', icon: AlertTriangle },
      { id: 'pms-floor-plans', title: 'Floor Plans', href: '#pms-floor-plans', icon: Building },
    ],
  },
  {
    id: 'bookings',
    title: 'Bookings',
    icon: CalendarDays,
    category: 'base',
    items: [
      { id: 'bookings-calendar', title: 'Calendar View', href: '#bookings-calendar', icon: CalendarDays },
      { id: 'bookings-groups', title: 'Group Bookings', href: '#bookings-groups', icon: Users2 },
      { id: 'bookings-waitlist', title: 'Waitlist', href: '#bookings-waitlist', icon: Clock },
      { id: 'bookings-conflicts', title: 'Conflicts', href: '#bookings-conflicts', icon: AlertTriangle },
      { id: 'bookings-no-show', title: 'No-Show Automation', href: '#bookings-no-show', icon: Clock },
      { id: 'bookings-audit', title: 'Audit Logs', href: '#bookings-audit', icon: History },
    ],
  },
  {
    id: 'frontDesk',
    title: 'Front Desk',
    icon: ConciergeBell,
    category: 'base',
    items: [
      { id: 'frontdesk-checkin', title: 'Check-in', href: '#frontdesk-checkin', icon: LogIn },
      { id: 'frontdesk-checkout', title: 'Check-out', href: '#frontdesk-checkout', icon: LogOut },
      { id: 'frontdesk-walkin', title: 'Walk-in Booking', href: '#frontdesk-walkin', icon: Users },
      { id: 'frontdesk-room-grid', title: 'Room Grid', href: '#frontdesk-room-grid', icon: Kanban },
      { id: 'frontdesk-assignment', title: 'Room Assignment', href: '#frontdesk-assignment', icon: Key },
    ],
  },
  {
    id: 'guests',
    title: 'Guests',
    icon: Users,
    category: 'base',
    items: [
      { id: 'guests-list', title: 'Guest List', href: '#guests-list', icon: Users },
      { id: 'guests-kyc', title: 'KYC / Documents', href: '#guests-kyc', icon: FileText },
      { id: 'guests-preferences', title: 'Preferences', href: '#guests-preferences', icon: Sparkles },
      { id: 'guests-history', title: 'Stay History', href: '#guests-history', icon: History },
      { id: 'guests-loyalty', title: 'Loyalty & Points', href: '#guests-loyalty', icon: Star },
    ],
  },
  {
    id: 'housekeeping',
    title: 'Housekeeping',
    icon: Brush,
    category: 'base',
    items: [
      { id: 'housekeeping-tasks', title: 'Tasks', href: '#housekeeping-tasks', icon: Brush },
      { id: 'housekeeping-kanban', title: 'Kanban Board', href: '#housekeeping-kanban', icon: Kanban },
      { id: 'housekeeping-status', title: 'Room Status', href: '#housekeeping-status', icon: Key },
      { id: 'housekeeping-maintenance', title: 'Maintenance Requests', href: '#housekeeping-maintenance', icon: Wrench },
      { id: 'housekeeping-preventive', title: 'Preventive Maintenance', href: '#housekeeping-preventive', icon: CalendarClock },
      { id: 'housekeeping-assets', title: 'Asset Management', href: '#housekeeping-assets', icon: Package },
      { id: 'housekeeping-inspections', title: 'Inspection Checklists', href: '#housekeeping-inspections', icon: ClipboardList },
      { id: 'housekeeping-automation', title: 'Automation Rules', href: '#housekeeping-automation', icon: Bot },
    ],
  },
  {
    id: 'billing',
    title: 'Billing',
    icon: Receipt,
    category: 'base',
    items: [
      { id: 'billing-folios', title: 'Folios', href: '#billing-folios', icon: FileText },
      { id: 'billing-invoices', title: 'Invoices', href: '#billing-invoices', icon: Receipt },
      { id: 'billing-payments', title: 'Payments', href: '#billing-payments', icon: CreditCard },
      { id: 'billing-refunds', title: 'Refunds', href: '#billing-refunds', icon: Wallet },
      { id: 'billing-discounts', title: 'Discounts', href: '#billing-discounts', icon: BadgePercent },
      { id: 'billing-cancellation-policies', title: 'Cancellation Policies', href: '#billing-cancellation-policies', icon: FileText },
    ],
  },

  // =====================================================
  // ADDON MODULES - Optional Features (Can be toggled)
  // =====================================================
  
  // --- Guest Experience Addons ---
  {
    id: 'experience',
    title: 'Experience',
    icon: Sparkles,
    category: 'addons',
    items: [
      { id: 'experience-requests', title: 'Service Requests', href: '#experience-requests', icon: Sparkles },
      { id: 'experience-inbox', title: 'Unified Inbox', href: '#experience-inbox', icon: Inbox },
      { id: 'experience-chat', title: 'Guest Chat', href: '#experience-chat', icon: MessageSquare },
      { id: 'experience-portal', title: 'In-Room Portal', href: '#experience-portal', icon: Zap },
      { id: 'experience-keys', title: 'Digital Keys', href: '#experience-keys', icon: Key },
      { id: 'experience-app-controls', title: 'Guest App Controls', href: '#experience-app-controls', icon: Smartphone },
    ],
  },
  {
    id: 'pos',
    title: 'Restaurant & POS',
    icon: UtensilsCrossed,
    category: 'addons',
    items: [
      { id: 'pos-orders', title: 'Orders', href: '#pos-orders', icon: UtensilsCrossed },
      { id: 'pos-tables', title: 'Tables', href: '#pos-tables', icon: Kanban },
      { id: 'pos-kitchen', title: 'Kitchen (KDS)', href: '#pos-kitchen', icon: UtensilsCrossed },
      { id: 'pos-menu', title: 'Menu Management', href: '#pos-menu', icon: FileText },
      { id: 'pos-billing', title: 'Restaurant Billing', href: '#pos-billing', icon: Receipt },
    ],
  },

  // --- Facility Management Addons ---
  {
    id: 'inventory',
    title: 'Inventory',
    icon: Package,
    category: 'addons',
    items: [
      { id: 'inventory-stock', title: 'Stock Items', href: '#inventory-stock', icon: Package },
      { id: 'inventory-consumption', title: 'Consumption Logs', href: '#inventory-consumption', icon: BarChart3 },
      { id: 'inventory-alerts', title: 'Low Stock Alerts', href: '#inventory-alerts', icon: AlertTriangle },
      { id: 'inventory-vendors', title: 'Vendors', href: '#inventory-vendors', icon: Users },
      { id: 'inventory-po', title: 'Purchase Orders', href: '#inventory-po', icon: FileText },
    ],
  },
  {
    id: 'parking',
    title: 'Parking',
    icon: Car,
    category: 'addons',
    items: [
      { id: 'parking-slots', title: 'Parking Slots', href: '#parking-slots', icon: Car },
      { id: 'parking-tracking', title: 'Vehicle Tracking', href: '#parking-tracking', icon: Radio },
      { id: 'parking-billing', title: 'Parking Billing', href: '#parking-billing', icon: Receipt },
    ],
  },
  {
    id: 'surveillance',
    title: 'Surveillance',
    icon: Video,
    category: 'addons',
    items: [
      { id: 'security-live', title: 'Live Camera View', href: '#security-live', icon: Video },
      { id: 'security-playback', title: 'Camera Playback', href: '#security-playback', icon: History },
      { id: 'security-alerts', title: 'Event Alerts', href: '#security-alerts', icon: Bell },
      { id: 'security-incidents', title: 'Incident Logs', href: '#security-incidents', icon: FileText },
    ],
  },
  {
    id: 'iot',
    title: 'Smart Hotel / IoT',
    icon: Zap,
    category: 'addons',
    items: [
      { id: 'iot-devices', title: 'Device Management', href: '#iot-devices', icon: Server },
      { id: 'iot-controls', title: 'Room Controls', href: '#iot-controls', icon: Settings },
      { id: 'iot-energy', title: 'Energy Dashboard', href: '#iot-energy', icon: TrendingUp },
    ],
  },

  // --- Connectivity Addons ---
  {
    id: 'wifi',
    title: 'WiFi',
    icon: Wifi,
    category: 'addons',
    items: [
      { id: 'wifi-access', title: 'WiFi Access', href: '#wifi-access', icon: Wifi },
      { id: 'wifi-gateway-radius', title: 'Gateway & RADIUS', href: '#wifi-gateway-radius', icon: Server },
      { id: 'wifi-network', title: 'Network', href: '#wifi-network', icon: Network },
      { id: 'wifi-dhcp', title: 'DHCP Server', href: '#wifi-dhcp', icon: Server },
      { id: 'wifi-dns', title: 'DNS Server', href: '#wifi-dns', icon: Globe },
      { id: 'wifi-portal', title: 'Captive Portal', href: '#wifi-portal', icon: Globe },
      { id: 'wifi-firewall', title: 'Firewall & Bandwidth', href: '#wifi-firewall', icon: ShieldCheck },
      { id: 'wifi-reports', title: 'Reports', href: '#wifi-reports', icon: Activity },
    ],
  },

  // --- Revenue & Channels Addons ---
  {
    id: 'revenue',
    title: 'Revenue Management',
    icon: TrendingUp,
    category: 'addons',
    items: [
      { id: 'revenue-pricing', title: 'Dynamic Pricing', href: '#revenue-pricing', icon: DollarSign },
      { id: 'revenue-forecasting', title: 'Demand Forecasting', href: '#revenue-forecasting', icon: TrendingUp },
      { id: 'revenue-competitor', title: 'Competitor Pricing', href: '#revenue-competitor', icon: Target },
      { id: 'revenue-ai', title: 'AI Suggestions', href: '#revenue-ai', icon: Brain },
    ],
  },
  {
    id: 'channels',
    title: 'Channel Manager',
    icon: Globe,
    category: 'addons',
    items: [
      { id: 'channel-ota', title: 'OTA Connections', href: '#channel-ota', icon: Globe },
      { id: 'channel-inventory', title: 'Inventory Sync', href: '#channel-inventory', icon: Zap },
      { id: 'channel-rate', title: 'Rate Sync', href: '#channel-rate', icon: DollarSign },
      { id: 'channel-booking', title: 'Booking Sync', href: '#channel-booking', icon: CalendarDays },
      { id: 'channel-restrictions', title: 'Restrictions', href: '#channel-restrictions', icon: Lock },
      { id: 'channel-mapping', title: 'Channel Mapping', href: '#channel-mapping', icon: Layers },
      { id: 'channel-logs', title: 'Sync Logs', href: '#channel-logs', icon: History },
      { id: 'channel-crs', title: 'CRS', href: '#channel-crs', icon: Building },
    ],
  },

  // --- Marketing & CRM Addons ---
  {
    id: 'crmMarketing',
    title: 'CRM & Marketing',
    icon: Brain,
    category: 'addons',
    items: [
      { id: 'crm-segments', title: 'Guest Segments', href: '#crm-segments', icon: Users },
      { id: 'crm-campaigns', title: 'Campaigns', href: '#crm-campaigns', icon: Megaphone },
      { id: 'crm-loyalty', title: 'Loyalty Programs', href: '#crm-loyalty', icon: Gift },
      { id: 'crm-feedback', title: 'Feedback & Reviews', href: '#crm-feedback', icon: MessageSquare },
      { id: 'crm-retention', title: 'Retention Analytics', href: '#crm-retention', icon: Heart },
    ],
  },
  {
    id: 'marketing',
    title: 'Marketing',
    icon: Megaphone,
    category: 'addons',
    items: [
      { id: 'marketing-reputation', title: 'Reputation Dashboard', href: '#marketing-reputation', icon: Star },
      { id: 'marketing-sources', title: 'Review Sources', href: '#marketing-sources', icon: Bookmark },
      { id: 'marketing-booking-engine', title: 'Direct Booking Engine', href: '#marketing-booking-engine', icon: Globe },
      { id: 'marketing-promotions', title: 'Promotions & Offers', href: '#marketing-promotions', icon: BadgePercent },
    ],
  },

  // --- Digital Advertising Addons ---
  {
    id: 'ads',
    title: 'Digital Advertising',
    icon: Volume2,
    category: 'addons',
    items: [
      { id: 'ads-campaigns', title: 'Ad Campaigns', href: '#ads-campaigns', icon: Target },
      { id: 'ads-google', title: 'Google Hotel Ads', href: '#ads-google', icon: Globe },
      { id: 'ads-performance', title: 'Performance Tracking', href: '#ads-performance', icon: BarChart3 },
      { id: 'ads-roi', title: 'ROI Analytics', href: '#ads-roi', icon: TrendingUp },
    ],
  },

  // --- Analytics Addons ---
  {
    id: 'reports',
    title: 'Reports & BI',
    icon: BarChart3,
    category: 'addons',
    items: [
      { id: 'reports-revenue', title: 'Revenue Reports', href: '#reports-revenue', icon: DollarSign },
      { id: 'reports-occupancy', title: 'Occupancy Reports', href: '#reports-occupancy', icon: BarChart3 },
      { id: 'reports-adr', title: 'ADR / RevPAR', href: '#reports-adr', icon: TrendingUp },
      { id: 'reports-guests', title: 'Guest Analytics', href: '#reports-guests', icon: Users },
      { id: 'reports-staff', title: 'Staff Performance', href: '#reports-staff', icon: UserCheck },
      { id: 'reports-scheduled', title: 'Scheduled Reports', href: '#reports-scheduled', icon: CalendarClock },
    ],
  },

  // --- Events Addons ---
  {
    id: 'events',
    title: 'Events / MICE',
    icon: PartyPopper,
    category: 'addons',
    items: [
      { id: 'events-spaces', title: 'Event Spaces', href: '#events-spaces', icon: Building2 },
      { id: 'events-calendar', title: 'Event Calendar', href: '#events-calendar', icon: CalendarDays },
      { id: 'events-booking', title: 'Event Bookings', href: '#events-booking', icon: FileText },
      { id: 'events-resources', title: 'Event Resources', href: '#events-resources', icon: Package },
    ],
  },

  // --- Staff Management Addons ---
  {
    id: 'staffManagement',
    title: 'Staff Management',
    icon: UserCog,
    category: 'addons',
    items: [
      { id: 'staff-shifts', title: 'Shift Scheduling', href: '#staff-shifts', icon: CalendarDays },
      { id: 'staff-attendance', title: 'Attendance Tracking', href: '#staff-attendance', icon: UserCheck },
      { id: 'staff-tasks', title: 'Task Assignment', href: '#staff-tasks', icon: ClipboardList },
      { id: 'staff-communication', title: 'Internal Communication', href: '#staff-communication', icon: MessageSquare },
      { id: 'staff-performance', title: 'Performance Metrics', href: '#staff-performance', icon: BarChart3 },
      { id: 'staff-skills', title: 'Skills & Certifications', href: '#staff-skills', icon: GraduationCap },
    ],
  },

  // --- Security & Admin Addons ---
  {
    id: 'securityCenter',
    title: 'Security Center',
    icon: Shield,
    category: 'addons',
    items: [
      { id: 'security-overview', title: 'Security Overview', href: '#security-overview', icon: Shield },
      { id: 'security-audit-logs', title: 'Audit Logs', href: '#security-audit-logs', icon: History },
      { id: 'security-2fa', title: 'Two-Factor Auth', href: '#security-2fa', icon: Lock },
      { id: 'security-sessions', title: 'Device Sessions', href: '#security-sessions', icon: Smartphone },
      { id: 'security-sso', title: 'SSO Configuration', href: '#security-sso', icon: Key },
    ],
  },

  // --- Integrations & Automation Addons ---
  {
    id: 'integrations',
    title: 'Integrations',
    icon: Plug,
    category: 'addons',
    items: [
      { id: 'integrations-payments', title: 'Payment Gateways', href: '#integrations-payments', icon: CreditCard },
      { id: 'integrations-wifi', title: 'WiFi Gateways', href: '#integrations-wifi', icon: Wifi },
      { id: 'integrations-pos', title: 'POS Systems', href: '#integrations-pos', icon: UtensilsCrossed },
      { id: 'integrations-apis', title: 'Third-party APIs', href: '#integrations-apis', icon: Plug },
    ],
  },
  {
    id: 'automation',
    title: 'Automation',
    icon: Bot,
    category: 'addons',
    items: [
      { id: 'automation-workflows', title: 'Workflow Builder', href: '#automation-workflows', icon: Bot },
      { id: 'automation-rules', title: 'Rules Engine', href: '#automation-rules', icon: Zap },
      { id: 'automation-templates', title: 'Templates', href: '#automation-templates', icon: FileText },
      { id: 'automation-logs', title: 'Execution Logs', href: '#automation-logs', icon: History },
    ],
  },
  {
    id: 'aiAssistant',
    title: 'AI Assistant',
    icon: Brain,
    category: 'addons',
    items: [
      { id: 'ai-copilot', title: 'AI Copilot', href: '#ai-copilot', icon: Bot },
      { id: 'ai-insights', title: 'AI Insights', href: '#ai-insights', icon: Brain },
      { id: 'ai-settings', title: 'Provider Settings', href: '#ai-settings', icon: Settings },
    ],
  },

  // --- Enterprise Addons ---
  {
    id: 'admin',
    title: 'Admin',
    icon: Shield,
    category: 'addons',
    items: [
      { id: 'admin-tenants', title: 'Tenant Management', href: '#admin-tenants', icon: Building2 },
      { id: 'admin-lifecycle', title: 'Tenant Lifecycle', href: '#admin-lifecycle', icon: RefreshCw },
      { id: 'admin-roles', title: 'Roles & Permissions', href: '#admin-roles', icon: Shield },
      { id: 'admin-users', title: 'User Management', href: '#admin-users', icon: Users },
      { id: 'admin-usage', title: 'Usage Tracking', href: '#admin-usage', icon: BarChart3 },
      { id: 'admin-revenue', title: 'Revenue Analytics', href: '#admin-revenue', icon: DollarSign },
      { id: 'admin-health', title: 'System Health', href: '#admin-health', icon: Zap },
    ],
  },
  {
    id: 'chainManagement',
    title: 'Chain Management',
    icon: Layers,
    category: 'addons',
    items: [
      { id: 'chain-brands', title: 'Brand Management', href: '#chain-brands', icon: Building2 },
      { id: 'chain-dashboard', title: 'Chain Dashboard', href: '#chain-dashboard', icon: LayoutDashboard },
      { id: 'chain-analytics', title: 'Cross-Property Analytics', href: '#chain-analytics', icon: BarChart3 },
    ],
  },
  {
    id: 'saasBilling',
    title: 'SaaS Billing',
    icon: Crown,
    category: 'addons',
    items: [
      { id: 'saas-plans', title: 'Plans', href: '#saas-plans', icon: Crown },
      { id: 'saas-subscriptions', title: 'Subscriptions', href: '#saas-subscriptions', icon: RefreshCw },
      { id: 'saas-usage', title: 'Usage Billing', href: '#saas-usage', icon: BarChart3 },
    ],
  },

  // --- System Addons ---
  {
    id: 'notifications',
    title: 'Notifications',
    icon: Bell,
    category: 'addons',
    items: [
      { id: 'notifications-templates', title: 'Templates', href: '#notifications-templates', icon: FileText },
      { id: 'notifications-logs', title: 'Delivery Logs', href: '#notifications-logs', icon: History },
      { id: 'notifications-settings', title: 'Channel Settings', href: '#notifications-settings', icon: Settings },
    ],
  },
  {
    id: 'webhooks',
    title: 'Webhooks',
    icon: Webhook,
    category: 'addons',
    items: [
      { id: 'webhooks-events', title: 'Event Logs', href: '#webhooks-events', icon: FileText },
      { id: 'webhooks-delivery', title: 'Delivery Logs', href: '#webhooks-delivery', icon: History },
      { id: 'webhooks-retry', title: 'Retry Queue', href: '#webhooks-retry', icon: Zap },
    ],
  },

  // =====================================================
  // SYSTEM - Always visible (includes Feature Flags settings)
  // =====================================================
  {
    id: 'settings',
    title: 'Settings',
    icon: Settings,
    category: 'base',
    items: [
      { id: 'settings-general', title: 'General Settings', href: '#settings-general', icon: Settings },
      { id: 'settings-tax', title: 'Tax & Currency', href: '#settings-tax', icon: DollarSign },
      { id: 'settings-localization', title: 'Localization', href: '#settings-localization', icon: Globe },
      { id: 'settings-features', title: 'Feature Flags', href: '#settings-features', icon: Zap },
      { id: 'settings-gdpr', title: 'GDPR Compliance', href: '#settings-gdpr', icon: Shield },
      { id: 'settings-security', title: 'Security Settings', href: '#settings-security', icon: Shield },
      { id: 'settings-integrations', title: 'System Integrations', href: '#settings-integrations', icon: Plug },
    ],
  },
  {
    id: 'helpSupport',
    title: 'Help & Support',
    icon: GraduationCap,
    category: 'base',
    items: [
      { id: 'help-center', title: 'Help Center', href: '#help-center', icon: BookOpen },
      { id: 'help-articles', title: 'Articles', href: '#help-articles', icon: FileText },
      { id: 'help-tutorials', title: 'Tutorial Progress', href: '#help-tutorials', icon: PlayCircle },
    ],
  },
];

// =====================================================
// MENU STATISTICS
// =====================================================
// Total Categories: 30 (excluding Profile which was removed)
// Base Modules: 8 (Dashboard, PMS, Bookings, Front Desk, Guests, 
//                        Housekeeping, Billing, Settings, Help)
// Addon Modules: 22 (Experience, Restaurant, Inventory, Parking, etc.)
// Total Menu Items: ~130
// =====================================================
