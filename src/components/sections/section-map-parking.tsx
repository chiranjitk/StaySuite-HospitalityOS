const sectionMap: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  'parking-slots': () => import('@/components/parking/slots'),
  'parking-tracking': () => import('@/components/parking/vehicle-tracking'),
  'parking-mapping': () => import('@/components/parking/vehicle-tracking'),
  'parking-billing': () => import('@/components/parking/vehicle-tracking'),
};

export const parkingMap = sectionMap;
