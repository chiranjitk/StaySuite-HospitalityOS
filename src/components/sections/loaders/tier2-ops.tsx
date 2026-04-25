// Tier 2: Operations
export default async function loadOps(section: string): Promise<{ default: React.ComponentType<any> }> {
  const prefix = section.split('-')[0];
  switch (prefix) {
    case 'billing':
    case 'saas':
    case 'folio':
    case 'payment':
    case 'credit':
    case 'multi':
      return (await import('./load-billing')).default(section);
    case 'pos':
    case 'restaurant':
      return (await import('./load-pos')).default(section);
    case 'inventory':
      return (await import('./load-inventory')).default(section);
    case 'housekeeping':
      return (await import('./load-housekeeping')).default(section);
    case 'staff':
      return (await import('./load-staff')).default(section);
    case 'reports':
      return (await import('./load-reports')).default(section);
    default:
      throw new Error(`Unknown ops section: ${section}`);
  }
}
