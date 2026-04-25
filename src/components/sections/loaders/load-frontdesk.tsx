// Category loader: Front Desk
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'frontdesk-checkin':
    case 'front-desk':
      return import('@/components/frontdesk/check-in');
    case 'frontdesk-checkout':
      return import('@/components/frontdesk/check-out');
    case 'frontdesk-walkin':
      return import('@/components/frontdesk/walk-in');
    case 'frontdesk-room-grid':
      return import('@/components/frontdesk/room-grid');
    case 'frontdesk-assignment':
      return import('@/components/frontdesk/room-assignment');
    case 'registration-card':
      return import('@/components/frontdesk/registration-card');
    case 'express-kiosk':
      return import('@/components/frontdesk/express-kiosk');
    case 'room-move':
      return import('@/components/frontdesk/room-move');
    default:
      // Fallback to check-in for any unknown frontdesk section
      return import('@/components/frontdesk/check-in');
  }
}
