const sectionMap: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  // ── admin (section-map-admin.tsx) ──
  'admin-tenants': () => import('@/components/admin/tenant-management'),
  'admin-tenant-lifecycle': () => import('@/components/admin/tenant-lifecycle'),
  'admin-lifecycle': () => import('@/components/admin/tenant-lifecycle'),
  'admin-users': () => import('@/components/admin/user-management'),
  'admin-usage': () => import('@/components/admin/usage-tracking'),
  'admin-revenue': () => import('@/components/admin/revenue-analytics'),
  'admin-health': () => import('@/components/admin/system-health'),
  'admin-roles': () => import('@/components/admin/role-permissions'),

  // ── security (section-map-security.tsx) ──
  'security-live': () => import('@/components/security/live-camera'),
  'security-playback': () => import('@/components/security/camera-playback'),
  'security-alerts': () => import('@/components/security/incidents'),
  'security-incidents': () => import('@/components/security/incidents'),
  'security-overview': () => import('@/components/security/security-overview'),
  'security-audit-logs': () => import('@/components/audit/audit-logs-viewer'),
  'security-2fa': () => import('@/components/security/two-factor-setup'),
  'security-sessions': () => import('@/components/security/device-sessions'),
  'security-sso': () => import('@/components/security/sso-config'),

  // ── bookings (section-map-bookings.tsx) ──
  'bookings-calendar': () => import('@/components/bookings/bookings-calendar-list'),
  'bookings-groups': () => import('@/components/bookings/group-bookings'),
  'bookings-waitlist': () => import('@/components/bookings/waitlist'),
  'bookings-audit': () => import('@/components/bookings/audit-logs'),
  'bookings-conflicts': () => import('@/components/bookings/conflicts'),
  'bookings-no-show': () => import('@/components/bookings/no-show-automation'),

  // ── marketing (section-map-marketing.tsx) ──
  'marketing-reputation': () => import('@/components/marketing/reputation-dashboard'),
  'marketing-reviews': () => import('@/components/marketing/review-sources'),
  'marketing-sources': () => import('@/components/marketing/review-sources'),
  'marketing-promotions': () => import('@/components/crm/campaigns'),
  'marketing-booking-engine': () => import('@/components/marketing/direct-booking-engine'),

  // ── dashboard (section-map-dashboard.tsx) ──
  'dashboard-overview': () => import('@/components/dashboard/overview-dashboard'),
  'overview': () => import('@/components/dashboard/overview-dashboard'),
  'dashboard-operations': () => import('@/components/dashboard/frontdesk-dashboard'),
  'dashboard-housekeeping': () => import('@/components/dashboard/housekeeping-dashboard'),
  'dashboard-command-center': () => import('@/components/dashboard/command-center'),
  'dashboard-alerts': () => import('@/components/notifications/notification-center-page'),
  'notifications-center': () => import('@/components/notifications/notification-center-page'),
  'dashboard-kpi': () => import('@/components/dashboard/kpi-dashboard-enhanced'),

  // ── guests (section-map-guests.tsx) ──
  'guests-list': () => import('@/components/guests/guests-list'),
  'guests-kyc': () => import('@/components/guests/kyc-management'),
  'guests-preferences': () => import('@/components/guests/preferences-management'),
  'guests-stay-history': () => import('@/components/guests/stay-history-management'),
  'guests-history': () => import('@/components/guests/stay-history-management'),
  'guests-loyalty': () => import('@/components/guests/loyalty-management'),

  // ── parking (section-map-parking.tsx) ──
  'parking-slots': () => import('@/components/parking/slots'),
  'parking-tracking': () => import('@/components/parking/vehicle-tracking'),
  'parking-mapping': () => import('@/components/parking/vehicle-tracking'),
  'parking-billing': () => import('@/components/parking/vehicle-tracking'),

  // ── billing (section-map-billing.tsx) ──
  'billing-folios': () => import('@/components/billing/folios'),
  'billing-invoices': () => import('@/components/billing/invoices'),
  'billing-payments': () => import('@/components/billing/payments'),
  'billing-refunds': () => import('@/components/billing/refunds'),
  'billing-discounts': () => import('@/components/billing/discounts'),
  'billing-cancellation-policies': () => import('@/components/billing/cancellation-policies'),
  'billing-saas-plans': () => import('@/components/billing/saas-plans'),
  'saas-plans': () => import('@/components/billing/saas-plans'),
  'billing-saas-subs': () => import('@/components/billing/subscriptions'),
  'saas-subscriptions': () => import('@/components/billing/subscriptions'),
  'billing-saas-usage': () => import('@/components/billing/usage-billing'),
  'saas-usage': () => import('@/components/billing/usage-billing'),

  // ── wifi (section-map-wifi.tsx) ──
  'wifi-sessions': () => import('@/components/wifi/sessions'),
  'wifi-vouchers': () => import('@/components/wifi/vouchers'),
  'wifi-plans': () => import('@/components/wifi/plans'),
  'wifi-logs': () => import('@/components/wifi/usage-logs'),
  'wifi-gateway': () => import('@/components/wifi/gateway-integration'),
  'wifi-aaa': () => import('@/components/wifi/aaa-config'),
  'wifi-network': () => import('@/components/wifi/network-page'),
  'wifi-dhcp': () => import('@/components/wifi/dhcp-page'),
  'wifi-portal': () => import('@/components/wifi/portal-page'),
  'wifi-firewall': () => import('@/components/wifi/firewall-page'),
  'wifi-reports': () => import('@/components/wifi/reports-page'),
  'wifi-access': () => import('@/components/wifi/wifi-access-page'),
  'wifi-gateway-radius': () => import('@/components/wifi/gateway-radius-page'),

  // ── revenue (section-map-revenue.tsx) ──
  'revenue-pricing': () => import('@/components/pms/rate-plans-pricing-rules'),
  'revenue-rules': () => import('@/components/pms/rate-plans-pricing-rules'),
  'revenue-forecast': () => import('@/components/revenue/demand-forecasting-page'),
  'revenue-demand': () => import('@/components/revenue/demand-forecasting-page'),
  'revenue-forecasting': () => import('@/components/revenue/demand-forecasting-page'),
  'revenue-competitor': () => import('@/components/revenue/competitor-pricing'),
  'revenue-compset': () => import('@/components/revenue/competitor-pricing'),
  'revenue-ai': () => import('@/components/revenue/ai-suggestions'),
  'revenue-suggestions': () => import('@/components/revenue/ai-suggestions'),

  // ── experience (section-map-experience.tsx) ──
  'experience-requests': () => import('@/components/experience/service-requests'),
  'experience-inbox': () => import('@/components/communication/unified-inbox'),
  'experience-chat': () => import('@/components/experience/guest-chat'),
  'experience-keys': () => import('@/components/experience/digital-keys'),
  'experience-portal': () => import('@/components/experience/in-room-portal'),
  'experience-app': () => import('@/components/experience/guest-app-controls'),
  'experience-app-controls': () => import('@/components/experience/guest-app-controls'),

  // ── iot (section-map-iot.tsx) ──
  'iot-devices': () => import('@/components/iot/device-management'),
  'iot-controls': () => import('@/components/iot/room-controls'),
  'iot-energy': () => import('@/components/iot/energy-dashboard'),

  // ── inventory (section-map-inventory.tsx) ──
  'inventory-stock': () => import('@/components/inventory/stock-items'),
  'inventory-consumption': () => import('@/components/inventory/consumption-logs'),
  'inventory-alerts': () => import('@/components/inventory/low-stock-alerts'),
  'inventory-vendors': () => import('@/components/inventory/vendors'),
  'inventory-purchase-orders': () => import('@/components/inventory/purchase-orders'),
  'inventory-po': () => import('@/components/inventory/purchase-orders'),

  // ── events (section-map-events.tsx) ──
  'events-spaces': () => import('@/components/events/event-spaces'),
  'events-calendar': () => import('@/components/events/event-calendar'),
  'events-booking': () => import('@/components/events/event-booking'),
  'events-resources': () => import('@/components/events/event-resources'),

  // ── frontdesk (section-map-frontdesk.tsx) ──
  'frontdesk-checkin': () => import('@/components/frontdesk/check-in'),
  'frontdesk-checkout': () => import('@/components/frontdesk/check-out'),
  'frontdesk-walkin': () => import('@/components/frontdesk/walk-in'),
  'frontdesk-room-grid': () => import('@/components/frontdesk/room-grid'),
  'frontdesk-assignment': () => import('@/components/frontdesk/room-assignment'),

  // ── pos (section-map-pos.tsx) ──
  'pos-orders': () => import('@/components/pos/orders'),
  'pos-tables': () => import('@/components/pos/tables'),
  'pos-kitchen': () => import('@/components/pos/kitchen-display'),
  'pos-menu': () => import('@/components/pos/menu-management'),
  'pos-billing': () => import('@/components/pos/billing'),

  // ── other (section-map-other.tsx) ──
  'admin-gdpr': () => import('@/components/gdpr/gdpr-manager'),
  'gdpr-compliance': () => import('@/components/gdpr/gdpr-manager'),
  'automation-workflow': () => import('@/components/automation/workflow-builder'),
  'automation-workflows': () => import('@/components/automation/workflow-builder'),
  'automation-rules': () => import('@/components/automation/rules-engine'),
  'automation-templates': () => import('@/components/automation/templates'),
  'automation-logs': () => import('@/components/automation/execution-logs'),
  'integrations-payment': () => import('@/components/integrations/payment-gateways-page'),
  'integrations-payments': () => import('@/components/integrations/payment-gateways-page'),
  'integrations-wifi': () => import('@/components/integrations/wifi-gateways'),
  'integrations-pos': () => import('@/components/integrations/pos-systems'),
  'integrations-apis': () => import('@/components/integrations/third-party-apis'),
  'notifications-templates': () => import('@/components/notifications/templates'),
  'notifications-logs': () => import('@/components/notifications/delivery-logs'),
  'notifications-settings': () => import('@/components/notifications/settings'),
  'webhooks-events': () => import('@/components/webhooks/events'),
  'webhooks-delivery': () => import('@/components/webhooks/delivery'),
  'webhooks-retry': () => import('@/components/webhooks/retry-queue'),
  'ai-copilot': () => import('@/components/ai/copilot'),
  'ai-provider': () => import('@/components/ai/provider-settings'),
  'ai-settings': () => import('@/components/ai/provider-settings'),
  'ai-insights': () => import('@/components/ai/insights'),
  'help-center': () => import('@/components/help/help-center'),
  'help-articles': () => import('@/components/help/help-center'),
  'help-tutorials': () => import('@/components/help/help-center'),
  'profile': () => import('@/components/profile/user-profile'),
  'profile-user': () => import('@/components/profile/user-profile'),
  'ui-showcase': () => import('@/components/showcase/ui-style-showcase'),
  'ads-campaigns': () => import('@/components/ads/ad-campaigns'),
  'ads-google': () => import('@/components/ads/google-hotel-ads'),
  'ads-performance': () => import('@/components/ads/performance-tracking'),
  'ads-roi': () => import('@/components/ads/roi-analytics'),

  // ── reports (section-map-reports.tsx) ──
  'reports-revenue': () => import('@/components/reports/revenue-reports'),
  'reports-occupancy': () => import('@/components/reports/occupancy-reports'),
  'reports-adr': () => import('@/components/reports/adr-revpar'),
  'reports-revpar': () => import('@/components/reports/adr-revpar'),
  'reports-guest': () => import('@/components/reports/guest-analytics-reports'),
  'reports-guests': () => import('@/components/reports/guest-analytics-reports'),
  'reports-staff': () => import('@/components/reports/staff-performance'),
  'reports-scheduled': () => import('@/components/reports/scheduled-reports'),

  // ── pms (section-map-pms.tsx) ──
  'pms-properties': () => import('@/components/pms/properties-list'),
  'pms-room-types': () => import('@/components/pms/room-types-manager'),
  'pms-rooms': () => import('@/components/pms/rooms-manager'),
  'pms-floor-plans': () => import('@/components/pms/floor-plans'),
  'pms-inventory-calendar': () => import('@/components/pms/inventory-calendar'),
  'pms-pricing-rules': () => import('@/components/pms/rate-plans-pricing-rules'),
  'pms-rate-plans': () => import('@/components/pms/rate-plans-pricing-rules'),
  'pms-rate-plans-pricing': () => import('@/components/pms/rate-plans-pricing-rules'),
  'pms-availability': () => import('@/components/pms/availability-control'),
  'pms-locking': () => import('@/components/pms/inventory-locking'),
  'pms-overbooking': () => import('@/components/pms/overbooking-settings'),
  'pms-bulk-price': () => import('@/components/pms/bulk-price-update'),
  'pms-revenue': () => import('@/components/pms/revenue-dashboard'),

  // ── chain (section-map-chain.tsx) ──
  'chain-brands': () => import('@/components/chain/brand-management'),
  'chain-dashboard': () => import('@/components/chain/chain-dashboard'),
  'chain-analytics': () => import('@/components/chain/cross-property-analytics'),

  // ── staff (section-map-staff.tsx) ──
  'staff-shifts': () => import('@/components/staff/shift-scheduling'),
  'staff-attendance': () => import('@/components/staff/attendance-tracking'),
  'staff-tasks': () => import('@/components/staff/task-assignment'),
  'staff-communication': () => import('@/components/staff/internal-communication'),
  'staff-performance': () => import('@/components/reports/staff-performance'),
  'staff-skills': () => import('@/components/staff/skills-management'),

  // ── channels (section-map-channels.tsx) ──
  'channel-ota': () => import('@/components/channels/ota-connections'),
  'channel-inventory': () => import('@/components/channels/inventory-sync'),
  'channel-rate': () => import('@/components/channels/rate-sync'),
  'channel-booking': () => import('@/components/channels/booking-sync'),
  'channel-restrictions': () => import('@/components/channels/restrictions'),
  'channel-mapping': () => import('@/components/channels/mapping'),
  'channel-logs': () => import('@/components/channels/sync-logs'),
  'channel-crs': () => import('@/components/channels/crs'),

  // ── settings (section-map-settings.tsx) ──
  'settings-general': () => import('@/components/settings/general'),
  'settings-tax': () => import('@/components/settings/tax-currency'),
  'settings-localization': () => import('@/components/settings/localization'),
  'settings-features': () => import('@/components/settings/feature-flags'),
  'settings-security': () => import('@/components/settings/security'),
  'settings-integrations': () => import('@/components/settings/system-integrations'),
  'settings-gdpr': () => import('@/components/gdpr/gdpr-manager'),

  // ── crm (section-map-crm.tsx) ──
  'crm-segments': () => import('@/components/crm/guest-segments'),
  'crm-campaigns': () => import('@/components/crm/campaigns'),
  'crm-loyalty': () => import('@/components/crm/loyalty-programs'),
  'crm-feedback': () => import('@/components/crm/feedback-reviews'),
  'crm-retention': () => import('@/components/crm/retention-analytics'),

  // ── housekeeping (section-map-housekeeping.tsx) ──
  'housekeeping-tasks': () => import('@/components/housekeeping/tasks-list'),
  'housekeeping-kanban': () => import('@/components/housekeeping/kanban-board'),
  'housekeeping-status': () => import('@/components/housekeeping/room-status'),
  'housekeeping-maintenance': () => import('@/components/housekeeping/maintenance'),
  'housekeeping-preventive': () => import('@/components/housekeeping/maintenance'),
  'housekeeping-assets': () => import('@/components/housekeeping/assets'),
  'housekeeping-automation': () => import('@/components/housekeeping/housekeeping-automation'),
  'housekeeping-inspections': () => import('@/components/housekeeping/inspection-checklists'),
};

export const allSections = sectionMap;
