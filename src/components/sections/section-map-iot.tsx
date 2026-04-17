const sectionMap: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  'iot-devices': () => import('@/components/iot/device-management'),
  'iot-controls': () => import('@/components/iot/room-controls'),
  'iot-energy': () => import('@/components/iot/energy-dashboard'),
};

export const iotMap = sectionMap;
