// Master loader — routes section to the right category tier-2 loader
// Only has ~5 import() calls — Turbopack can handle this at chunk compile time
import type React from 'react';

export default async function masterLoader(section: string): Promise<{ default: React.ComponentType<any> }> {
  const prefix = section.split('-')[0];

  switch (prefix) {
    // Core: dashboard, pms, bookings, frontdesk, revenue (5 imports)
    case 'dashboard':
    case 'overview':
    case 'pms':
    case 'rooms':
    case 'bookings':
    case 'group':
    case 'frontdesk':
    case 'front':
    case 'room':
    case 'registration':
    case 'express':
    case 'revenue':
      return (await import('./tier2-core')).default(section);

    // Admin: admin, settings, security, chain, channels (5 imports)
    case 'admin':
    case 'settings':
    case 'security':
    case 'surveillance':
    case 'chain':
    case 'channel':
      return (await import('./tier2-admin')).default(section);

    // Guest: guests, experience, crm, marketing, events (5 imports)
    case 'guests':
    case 'experience':
    case 'crm':
    case 'marketing':
    case 'events':
      return (await import('./tier2-guest')).default(section);

    // Ops: billing, pos, inventory, housekeeping, staff, reports (6 imports)
    case 'billing':
    case 'saas':
    case 'folio':
    case 'payment':
    case 'credit':
    case 'multi':
    case 'pos':
    case 'restaurant':
    case 'inventory':
    case 'housekeeping':
    case 'staff':
    case 'reports':
      return (await import('./tier2-ops')).default(section);

    // Other: everything else (14 imports)
    default:
      return (await import('./tier2-other')).default(section);
  }
}
