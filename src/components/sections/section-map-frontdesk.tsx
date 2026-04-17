const sectionMap: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  'frontdesk-checkin': () => import('@/components/frontdesk/check-in'),
  'frontdesk-checkout': () => import('@/components/frontdesk/check-out'),
  'frontdesk-walkin': () => import('@/components/frontdesk/walk-in'),
  'frontdesk-room-grid': () => import('@/components/frontdesk/room-grid'),
  'frontdesk-assignment': () => import('@/components/frontdesk/room-assignment'),
};

export const frontdeskMap = sectionMap;
