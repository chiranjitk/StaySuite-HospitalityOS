// Group: Operations (billing, pos, inventory, housekeeping, staff, reports)
export default async function loadOpsSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  const prefix = section.split('-')[0];
  switch (prefix) {
    case 'billing':
    case 'saas':
      return (await import('./load-billing')).default(section);
    case 'pos':
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
