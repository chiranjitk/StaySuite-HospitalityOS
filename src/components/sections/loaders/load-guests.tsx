// Category loader: Guests
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'guests-list':
      return import('@/components/guests/guests-list');
    case 'guests-kyc':
      return import('@/components/guests/kyc-management');
    case 'guests-preferences':
      return import('@/components/guests/preferences-management');
    case 'guests-stay-history':
    case 'guests-history':
      return import('@/components/guests/stay-history-management');
    case 'guests-loyalty':
      return import('@/components/guests/loyalty-management');
    default:
      throw new Error(`Unknown guests section: ${section}`);
  }
}
