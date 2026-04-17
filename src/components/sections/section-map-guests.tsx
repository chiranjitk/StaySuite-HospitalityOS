const sectionMap: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  'guests-list': () => import('@/components/guests/guests-list'),
  'guests-kyc': () => import('@/components/guests/kyc-management'),
  'guests-preferences': () => import('@/components/guests/preferences-management'),
  'guests-stay-history': () => import('@/components/guests/stay-history-management'),
  'guests-history': () => import('@/components/guests/stay-history-management'),
  'guests-loyalty': () => import('@/components/guests/loyalty-management'),
};

export const guestsMap = sectionMap;
