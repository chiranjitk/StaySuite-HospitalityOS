// Two-level section resolver
// Level 1: This file is imported by page.tsx (tiny — only maps section → category loader)
// Level 2: Category loaders are only compiled when a section in that category is visited
// This avoids Turbopack trying to resolve all 192 import() paths at once

// Map section prefixes to their category loader modules
// These import() calls are only resolved when the function executes (runtime), not at compile time
function getCategoryLoader(section: string): Promise<any> | null {
  const prefix = section.split('-')[0];

  switch (prefix) {
    case 'dashboard':
    case 'overview':
      return import('./loaders/load-dashboard');
    case 'admin':
      return import('./loaders/load-admin');
    case 'pms':
      return import('./loaders/load-pms');
    case 'bookings':
      return import('./loaders/load-bookings');
    case 'guests':
      return import('./loaders/load-guests');
    case 'frontdesk':
      return import('./loaders/load-frontdesk');
    case 'wifi':
      return import('./loaders/load-wifi');
    case 'billing':
    case 'saas':
      return import('./loaders/load-billing');
    case 'inventory':
      return import('./loaders/load-inventory');
    case 'housekeeping':
      return import('./loaders/load-housekeeping');
    case 'pos':
      return import('./loaders/load-pos');
    case 'experience':
      return import('./loaders/load-experience');
    case 'parking':
      return import('./loaders/load-parking');
    case 'security':
      return import('./loaders/load-security');
    case 'channel':
      return import('./loaders/load-channels');
    case 'reports':
      return import('./loaders/load-reports');
    case 'revenue':
      return import('./loaders/load-revenue');
    case 'crm':
      return import('./loaders/load-crm');
    case 'settings':
      return import('./loaders/load-settings');
    case 'chain':
      return import('./loaders/load-chain');
    case 'marketing':
      return import('./loaders/load-marketing');
    case 'events':
      return import('./loaders/load-events');
    case 'iot':
      return import('./loaders/load-iot');
    case 'staff':
      return import('./loaders/load-staff');
    case 'notifications':
      return import('./loaders/load-notifications');
    case 'webhooks':
      return import('./loaders/load-webhooks');
    case 'ai':
      return import('./loaders/load-ai');
    case 'help':
      return import('./loaders/load-help');
    case 'profile':
      return import('./loaders/load-profile');
    case 'ads':
      return import('./loaders/load-ads');
    case 'automation':
      return import('./loaders/load-automation');
    case 'integrations':
      return import('./loaders/load-integrations');
    case 'gdpr':
      return import('./loaders/load-gdpr');
    case 'ui':
      return import('./loaders/load-ui');
    default:
      return null;
  }
}

export async function loadSection(section: string): Promise<{ default: React.ComponentType<any> } | null> {
  const categoryModule = getCategoryLoader(section);
  if (!categoryModule) return null;

  try {
    const categoryLoader = await categoryModule;
    if (categoryLoader.default && typeof categoryLoader.default === 'function') {
      return await categoryLoader.default(section);
    }
    return categoryLoader;
  } catch (err) {
    console.error('Failed to load section:', section, err);
    throw err;
  }
}

export function hasSection(section: string): boolean {
  const prefix = section.split('-')[0];
  const knownPrefixes = [
    'dashboard', 'admin', 'pms', 'bookings', 'guests', 'frontdesk',
    'wifi', 'billing', 'saas', 'inventory', 'housekeeping', 'pos',
    'experience', 'parking', 'security', 'channel', 'reports', 'revenue',
    'crm', 'settings', 'chain', 'marketing', 'events', 'iot', 'staff',
    'notifications', 'webhooks', 'ai', 'help', 'profile', 'ads',
    'automation', 'integrations', 'gdpr', 'ui',
  ];
  return knownPrefixes.includes(prefix);
}
