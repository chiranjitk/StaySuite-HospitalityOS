/**
 * Gateway Adapter Interface
 * 
 * All WiFi gateway/AP vendors must implement this interface.
 * Uses standard RADIUS attributes for maximum compatibility.
 * 
 * DO NOT: Hardcode vendor-specific logic in business code
 * DO: Use this adapter pattern for vendor-specific behavior
 */

export interface GatewayConfig {
  id: string;
  vendor: GatewayVendor;
  ipAddress: string;
  radiusSecret: string;
  radiusAuthPort: number;
  radiusAcctPort: number;
  coaEnabled: boolean;
  coaPort: number;
  coaSecret?: string;
  apiUsername?: string;
  apiPassword?: string;
  apiPort?: number;
  managementUrl?: string;
}

export type GatewayVendor = 
  // Tier 1
  | 'mikrotik'
  | 'unifi'
  | 'cisco'
  | 'aruba'
  // Tier 2
  | 'tplink'
  | 'ruijie'
  | 'cambium'
  | 'grandstream'
  // Tier 3
  | 'ruckus'
  | 'juniper'
  | 'fortinet'
  | 'netgear'
  | 'dlink'
  | 'huawei'
  // Generic
  | 'generic';

export interface CoARequest {
  username: string;
  sessionId: string;
  action: 'disconnect' | 'reauthorize' | 'update';
  attributes?: Record<string, string>;
}

export interface CoAResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface SessionInfo {
  sessionId: string;
  username: string;
  ipAddress: string;
  macAddress: string;
  nasIpAddress: string;
  startTime: Date;
  duration: number; // seconds
  bytesIn: number;
  bytesOut: number;
  status: 'active' | 'terminated' | 'expired';
  apName?: string;
  ssid?: string;
  vlanId?: number;
  additionalInfo?: Record<string, unknown>;
}

export interface GatewayStatus {
  online: boolean;
  firmwareVersion?: string;
  cpuUsage?: number;
  memoryUsage?: number;
  uptime?: number;
  totalClients?: number;
  lastSeen: Date;
}

export interface BandwidthPolicy {
  downloadSpeed: number; // bps
  uploadSpeed: number; // bps
  sessionTimeout?: number; // seconds
  dataLimit?: number; // bytes
}

/**
 * GatewayAdapter - Abstract interface for all WiFi gateway vendors
 * 
 * AI RULE: Do not hardcode vendor logic in business code
 * AI RULE: Use standard RADIUS attributes for maximum compatibility
 * AI RULE: Implement adapter layer for vendor-specific behavior
 */
export abstract class GatewayAdapter {
  protected config: GatewayConfig;

  constructor(config: GatewayConfig) {
    this.config = config;
  }

  /**
   * Get the vendor name
   */
  abstract getVendor(): GatewayVendor;

  /**
   * Test connectivity to the gateway
   */
  abstract testConnection(): Promise<{ success: boolean; latency?: number; error?: string }>;

  /**
   * Send Change of Authorization (CoA) request
   * Used to disconnect or reauthorize active sessions
   */
  abstract sendCoA(request: CoARequest): Promise<CoAResponse>;

  /**
   * Get gateway status
   */
  abstract getStatus(): Promise<GatewayStatus>;

  /**
   * Get active sessions from gateway (if API available)
   * Note: Primary session data comes from RADIUS accounting (radacct)
   */
  abstract getActiveSessions(): Promise<SessionInfo[]>;

  /**
   * Disconnect a specific session
   */
  abstract disconnectSession(sessionId: string, username: string): Promise<CoAResponse>;

  /**
   * Update bandwidth for a session
   */
  abstract updateBandwidth(sessionId: string, username: string, policy: BandwidthPolicy): Promise<CoAResponse>;

  /**
   * Get vendor-specific RADIUS attributes for a policy
   * Returns standard RADIUS attributes by default
   */
  getRadiusAttributes(policy: BandwidthPolicy): Record<string, string> {
    const attrs: Record<string, string> = {};

    // Standard RADIUS attributes
    if (policy.sessionTimeout) {
      attrs['Session-Timeout'] = String(policy.sessionTimeout);
    }

    // WISPr attributes (widely supported)
    if (policy.downloadSpeed) {
      attrs['WISPr-Bandwidth-Max-Down'] = String(policy.downloadSpeed);
    }
    if (policy.uploadSpeed) {
      attrs['WISPr-Bandwidth-Max-Up'] = String(policy.uploadSpeed);
    }

    return attrs;
  }

  /**
   * Format bandwidth limit for this vendor
   * Override for vendor-specific formats
   */
  formatBandwidthLimit(download: number, upload: number): string {
    // Default: WISPr format in bps
    return `${download}/${upload}`;
  }

  /**
   * Get vendor-specific health check endpoints
   */
  getHealthCheckEndpoints(): string[] {
    return [];
  }

  /**
   * Validate configuration for this vendor
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.config.ipAddress) {
      errors.push('IP address is required');
    }

    if (!this.config.radiusSecret) {
      errors.push('RADIUS secret is required');
    }

    if (this.config.radiusAuthPort < 1 || this.config.radiusAuthPort > 65535) {
      errors.push('Invalid RADIUS auth port');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Adapter Factory
 */
export function createGatewayAdapter(config: GatewayConfig): GatewayAdapter {
  // Dynamic import based on vendor
  // This will be implemented in each vendor's adapter file
  switch (config.vendor) {
    case 'mikrotik':
      // return new MikrotikAdapter(config);
    case 'unifi':
      // return new UnifiAdapter(config);
    case 'cisco':
      // return new CiscoAdapter(config);
    case 'aruba':
      // return new ArubaAdapter(config);
    case 'tplink':
      // return new TPLinkAdapter(config);
    case 'ruijie':
      // return new RuijieAdapter(config);
    case 'cambium':
      // return new CambiumAdapter(config);
    case 'grandstream':
      // return new GrandstreamAdapter(config);
    case 'ruckus':
      // return new RuckusAdapter(config);
    case 'juniper':
      // return new JuniperAdapter(config);
    case 'fortinet':
      // return new FortinetAdapter(config);
    default:
      // return new GenericAdapter(config);
      throw new Error(`Adapter for vendor '${config.vendor}' not yet implemented`);
  }
}
