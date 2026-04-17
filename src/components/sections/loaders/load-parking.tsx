// Category loader: Parking
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'parking-slots':
      return import('@/components/parking/slots');
    case 'parking-tracking':
    case 'parking-mapping':
    case 'parking-billing':
      return import('@/components/parking/vehicle-tracking');
    default:
      throw new Error(`Unknown parking section: ${section}`);
  }
}
