const sectionMap: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  'experience-requests': () => import('@/components/experience/service-requests'),
  'experience-inbox': () => import('@/components/communication/unified-inbox'),
  'experience-chat': () => import('@/components/experience/guest-chat'),
  'experience-keys': () => import('@/components/experience/digital-keys'),
  'experience-portal': () => import('@/components/experience/in-room-portal'),
  'experience-app': () => import('@/components/experience/guest-app-controls'),
  'experience-app-controls': () => import('@/components/experience/guest-app-controls'),
};

export const experienceMap = sectionMap;
