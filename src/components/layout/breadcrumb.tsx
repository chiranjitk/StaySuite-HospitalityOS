'use client';

import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { useUIStore } from '@/store';
import { cn } from '@/lib/utils';

// Map section IDs to readable breadcrumb names
// Section IDs follow patterns like "overview", "bookings-calendar", "pms-room-types", etc.
const sectionNameMap: Record<string, string> = {
  // Dashboard
  overview: 'Dashboard',
  'dashboard-overview': 'Dashboard',

  // Bookings
  bookings: 'Bookings',
  'bookings-calendar': 'Calendar',
  'bookings-list': 'All Bookings',
  'bookings-create': 'New Booking',

  // PMS (Property Management)
  pms: 'Property Management',
  'pms-room-types': 'Room Types',
  'pms-rates': 'Rate Plans',
  'pms-availability': 'Availability',

  // Front Desk
  frontdesk: 'Front Desk',
  'frontdesk-checkin': 'Check-in',
  'frontdesk-checkout': 'Check-out',
  'frontdesk-room-grid': 'Room Grid',
  'frontdesk-guest-registration': 'Guest Registration',

  // Guests
  guests: 'Guests',
  'guests-list': 'All Guests',
  'guests-profile': 'Guest Profile',
  'guests-analytics': 'Analytics',

  // Housekeeping
  housekeeping: 'Housekeeping',
  'housekeeping-dashboard': 'Dashboard',
  'housekeeping-tasks': 'Tasks',
  'housekeeping-schedule': 'Schedule',
  'housekeeping-inspections': 'Inspections',

  // Billing
  billing: 'Billing',
  'billing-invoices': 'Invoices',
  'billing-payments': 'Payments',
  'billing-deposits': 'Deposits',

  // Revenue
  revenue: 'Revenue',
  'revenue-dashboard': 'Dashboard',
  'revenue-reports': 'Reports',
  'revenue-forecast': 'Forecast',

  // Reports
  reports: 'Reports',
  'reports-occupancy': 'Occupancy',
  'reports-revenue': 'Revenue',
  'reports-guest-analytics': 'Guest Analytics',

  // CRM
  crm: 'CRM & Marketing',
  'crm-guests': 'Guests',
  'crm-segments': 'Segments',
  'crm-campaigns': 'Campaigns',
  'crm-reviews': 'Reviews',
  'crm-feedback': 'Feedback',

  // Experience
  experience: 'Guest Experience',
  'experience-requests': 'Service Requests',
  'experience-amenities': 'Amenities',
  'experience-concierge': 'Concierge',

  // WiFi
  wifi: 'WiFi',
  'wifi-vouchers': 'Vouchers',
  'wifi-sessions': 'Sessions',
  'wifi-plans': 'Plans',
  'wifi-network': 'Network',
  'wifi-dhcp': 'DHCP Server',
  'wifi-portal': 'DNS & Portal',
  'wifi-firewall': 'Firewall & BW',
  'wifi-reports': 'Reports',

  // Inventory
  inventory: 'Inventory',
  'inventory-items': 'Items',
  'inventory-stock': 'Stock',
  'inventory-orders': 'Orders',

  // Parking
  parking: 'Parking',
  'parking-slots': 'Slots',
  'parking-passes': 'Passes',

  // Security / Surveillance
  security: 'Security',
  surveillance: 'Surveillance',
  'security-events': 'Events',
  'security-cameras': 'Cameras',
  'security-access': 'Access Control',

  // Automation
  automation: 'Automation',
  'automation-rules': 'Rules',
  'automation-workflows': 'Workflows',
  'automation-triggers': 'Triggers',

  // Channels / Integrations
  channels: 'Channels',
  'channels-connections': 'Connections',
  'channels-calendar': 'Calendar',
  integrations: 'Integrations',
  'integrations-pms': 'PMS',
  'integrations-payment': 'Payment',
  'integrations-ota': 'OTA',

  // Notifications
  notifications: 'Notifications',
  'notifications-list': 'All',
  'notifications-settings': 'Settings',

  // Webhooks
  webhooks: 'Webhooks',
  'webhooks-list': 'Endpoints',
  'webhooks-logs': 'Logs',

  // AI
  ai: 'AI Assistant',
  'ai-chat': 'Chat',
  'ai-insights': 'Insights',
  'ai-recommendations': 'Recommendations',

  // Admin
  admin: 'Administration',
  'admin-users': 'Users',
  'admin-roles': 'Roles',
  'admin-tenants': 'Tenants',
  'admin-audit': 'Audit Logs',

  // Settings
  settings: 'Settings',
  'settings-general': 'General',
  'settings-billing': 'Billing',
  'settings-notifications': 'Notifications',
  'settings-security': 'Security',
  'settings-appearance': 'Appearance',
  'settings-locale': 'Locale',
  'settings-feature-flags': 'Feature Flags',
  'settings-tax-currency': 'Tax & Currency',

  // Help
  help: 'Help Center',
  'help-center': 'Help Center',
  'help-categories': 'Categories',
  'help-articles': 'Articles',

  // Other
  profile: 'Profile',
  pos: 'Point of Sale',
  'pos-orders': 'Orders',
  'pos-menu': 'Menu',
  'pos-payments': 'Payments',
};

/**
 * Derive breadcrumb segments from an activeSection string.
 * E.g., "pms-room-types" → ["Property Management", "Room Types"]
 * E.g., "overview" → ["Dashboard"]
 */
function getBreadcrumbSegments(section: string): string[] {
  // Check for exact match first
  if (sectionNameMap[section]) {
    // Check if it has a parent prefix
    const prefix = section.split('-')[0];
    if (
      prefix !== section &&
      sectionNameMap[prefix] &&
      sectionNameMap[section] !== sectionNameMap[prefix]
    ) {
      return [sectionNameMap[prefix], sectionNameMap[section]];
    }
    return [sectionNameMap[section]];
  }

  // Fallback: split by hyphen and try to find parent + child
  const parts = section.split('-');
  if (parts.length >= 2) {
    const parentKey = parts[0];
    const parentName = sectionNameMap[parentKey];
    // Use the section as a readable label as fallback
    const childName = sectionNameMap[section] || section
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    if (parentName && parentName !== childName) {
      return [parentName, childName];
    }
  }

  // Final fallback
  return [
    section
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' '),
  ];
}

export function Breadcrumb() {
  const { activeSection } = useUIStore();

  const segments = getBreadcrumbSegments(activeSection);

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1 text-xs text-muted-foreground py-1.5 px-0 select-none overflow-hidden"
    >
      {/* Home icon */}
      <Home className="h-3 w-3 shrink-0 opacity-50" />

      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;

        return (
          <React.Fragment key={`${segment}-${index}`}>
            <ChevronRight className="h-3 w-3 shrink-0 opacity-40" />
            <span
              className={cn(
                'truncate transition-colors duration-150',
                isLast
                  ? 'font-medium text-foreground/80'
                  : 'opacity-60 hover:opacity-100'
              )}
              aria-current={isLast ? 'page' : undefined}
            >
              {segment}
            </span>
          </React.Fragment>
        );
      })}
    </nav>
  );
}
