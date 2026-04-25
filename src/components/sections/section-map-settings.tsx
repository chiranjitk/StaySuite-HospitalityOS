const sectionMap: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  'settings-general': () => import('@/components/settings/general'),
  'settings-tax': () => import('@/components/settings/tax-currency'),
  'settings-localization': () => import('@/components/settings/localization'),
  'settings-features': () => import('@/components/settings/feature-flags'),
  'settings-security': () => import('@/components/settings/security'),
  'settings-integrations': () => import('@/components/settings/system-integrations'),
  'settings-gdpr': () => import('@/components/gdpr/gdpr-manager'),
};

export const settingsMap = sectionMap;
