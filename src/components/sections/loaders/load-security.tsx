// Category loader: Security
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'security-live':
    case 'surveillance-cameras':
      return import('@/components/security/live-camera');
    case 'security-playback':
      return import('@/components/security/camera-playback');
    case 'security-alerts':
    case 'security-incidents':
    case 'security-events':
      return import('@/components/security/incidents');
    case 'security-overview':
      return import('@/components/security/security-overview');
    case 'security-audit-logs':
      return import('@/components/audit/audit-logs-viewer');
    case 'security-2fa':
      return import('@/components/security/two-factor-setup');
    case 'security-sessions':
      return import('@/components/security/device-sessions');
    case 'security-sso':
      return import('@/components/security/sso-config');
    default:
      throw new Error(`Unknown security section: ${section}`);
  }
}
