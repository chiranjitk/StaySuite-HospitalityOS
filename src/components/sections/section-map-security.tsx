const sectionMap: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  'security-live': () => import('@/components/security/live-camera'),
  'security-playback': () => import('@/components/security/camera-playback'),
  'security-alerts': () => import('@/components/security/incidents'),
  'security-incidents': () => import('@/components/security/incidents'),
  'security-overview': () => import('@/components/security/security-overview'),
  'security-audit-logs': () => import('@/components/audit/audit-logs-viewer'),
  'security-2fa': () => import('@/components/security/two-factor-setup'),
  'security-sessions': () => import('@/components/security/device-sessions'),
  'security-sso': () => import('@/components/security/sso-config'),
};

export const securityMap = sectionMap;
