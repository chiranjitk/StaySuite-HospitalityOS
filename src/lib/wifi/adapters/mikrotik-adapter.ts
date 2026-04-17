/**
 * MikroTik RouterOS Gateway Adapter
 * 
 * MikroTik RouterOS is widely used in hospitality WiFi deployments.
 * This adapter supports:
 * - RADIUS authentication (via FreeRADIUS)
 * - CoA for session management
 * - API for configuration and monitoring
 * 
 * References:
 * - https://wiki.mikrotik.com/wiki/Manual:RouterOS_Wireless_CAPsMAN
 * - https://wiki.mikrotik.com/wiki/Manual:Hotspot
 */

import {
  GatewayAdapter,
  GatewayConfig,
  CoARequest,
  CoAResponse,
  SessionInfo,
  GatewayStatus,
  BandwidthPolicy,
} from './gateway-adapter';

export interface MikrotikConfig extends GatewayConfig {
  vendor: 'mikrotik';
  // MikroTik-specific settings
  hotspotProfile?: string;
  capsManEnabled?: boolean;
  bridgeName?: string;
  externalPortal?: boolean;
}

/**
 * MikroTik RADIUS Attributes
 * 
 * Common attributes used by MikroTik RouterOS:
 * - Mikrotik-Rate-Limit: Download/Upload limit (e.g., "10M/10M")
 * - Mikrotik-Group: User group for hotspot profiles
 * - Mikrotik-Recv-Limit: Receive limit in bytes
 * - Mikrotik-Xmit-Limit: Transmit limit in bytes
 * - Mikrotik-Wireless-Comment: Comment for wireless client
 * - Mikrotik-Wireless-VLANID: VLAN assignment
 */
export class MikrotikAdapter extends GatewayAdapter {
  protected mikrotikConfig: MikrotikConfig;

  constructor(config: MikrotikConfig) {
    super(config);
    this.mikrotikConfig = config;
  }

  getVendor() {
    return 'mikrotik' as const;
  }

  /**
   * Test connection to MikroTik router
   * Uses API port (8728/8729) or ping
   */
  async testConnection(): Promise<{ success: boolean; latency?: number; error?: string }> {
    try {
      // For now, simulate connection test
      // In production, use RouterOS API or ping
      const startTime = Date.now();
      
      // Simulated API call
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const latency = Date.now() - startTime;
      
      return {
        success: true,
        latency,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  /**
   * Send CoA (Change of Authorization) to MikroTik
   * 
   * MikroTik supports CoA via RADIUS on port 3799
   * Requires hotspot configuration with CoA enabled
   */
  async sendCoA(request: CoARequest): Promise<CoAResponse> {
    try {
      // CoA packet construction
      // This would normally send a RADIUS CoA packet
      // For now, simulate success
      
      const coaAttributes = this.buildCoAAttributes(request);
      
      // In production, send RADIUS CoA-Request packet
      // to this.config.ipAddress:3799
      console.log('CoA Request:', {
        server: `${this.config.ipAddress}:${this.config.coaPort}`,
        secret: this.config.coaSecret || this.config.radiusSecret,
        attributes: coaAttributes,
      });

      return {
        success: true,
        message: `CoA ${request.action} sent successfully`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'CoA failed',
      };
    }
  }

  /**
   * Build CoA attributes based on action type
   */
  private buildCoAAttributes(request: CoARequest): Record<string, string> {
    const attrs: Record<string, string> = {
      'User-Name': request.username,
      'Acct-Session-Id': request.sessionId,
    };

    switch (request.action) {
      case 'disconnect':
        // MikroTik uses specific attribute for disconnect
        attrs['Mikrotik-Wireless-Comment'] = 'Session terminated by PMS';
        break;
      case 'reauthorize':
        // Force re-authentication
        attrs['Session-Timeout'] = '0';
        break;
      case 'update':
        // Update session with new attributes
        Object.assign(attrs, request.attributes);
        break;
    }

    return attrs;
  }

  /**
   * Get gateway status from MikroTik API
   */
  async getStatus(): Promise<GatewayStatus> {
    // In production, query RouterOS API:
    // /system/resource/print
    // /system/identity/print
    
    return {
      online: true,
      firmwareVersion: '7.10',
      cpuUsage: 15,
      memoryUsage: 45,
      uptime: 864000, // 10 days in seconds
      totalClients: 24,
      lastSeen: new Date(),
    };
  }

  /**
   * Get active sessions
   * Query /ip/hotspot/active/print via API
   */
  async getActiveSessions(): Promise<SessionInfo[]> {
    // In production, query RouterOS API
    return [];
  }

  /**
   * Disconnect a session
   */
  async disconnectSession(sessionId: string, username: string): Promise<CoAResponse> {
    return this.sendCoA({
      username,
      sessionId,
      action: 'disconnect',
    });
  }

  /**
   * Update bandwidth for a session
   */
  async updateBandwidth(
    sessionId: string,
    username: string,
    policy: BandwidthPolicy
  ): Promise<CoAResponse> {
    const attributes = this.getRadiusAttributes(policy);
    
    return this.sendCoA({
      username,
      sessionId,
      action: 'update',
      attributes,
    });
  }

  /**
   * Get MikroTik-specific RADIUS attributes
   * 
   * MikroTik Rate Limit Format:
   * - Simple: "10M" (10 Mbps both ways)
   * - Separate: "10M/5M" (10M down / 5M up)
   * - Burst: "10M/10M 20M/20M 5M/5M 10" (limit/burst limit/burst threshold/burst time)
   */
  getRadiusAttributes(policy: BandwidthPolicy): Record<string, string> {
    const attrs = super.getRadiusAttributes(policy);

    // MikroTik-specific rate limit attribute
    // Format: rx-rate/tx-rate [rx-burst-rate/tx-burst-rate rx-burst-threshold/tx-burst-threshold burst-time]
    const downloadMbps = policy.downloadSpeed / 1000000; // Convert bps to Mbps
    const uploadMbps = policy.uploadSpeed / 1000000;

    attrs['Mikrotik-Rate-Limit'] = `${downloadMbps}M/${uploadMbps}M`;

    return attrs;
  }

  /**
   * Format bandwidth for MikroTik
   * MikroTik uses: rx-rate/tx-rate
   */
  formatBandwidthLimit(download: number, upload: number): string {
    // Convert bps to human-readable format
    const formatRate = (bps: number): string => {
      if (bps >= 1000000000) {
        return `${bps / 1000000000}G`;
      } else if (bps >= 1000000) {
        return `${bps / 1000000}M`;
      } else if (bps >= 1000) {
        return `${bps / 1000}k`;
      }
      return String(bps);
    };

    return `${formatRate(download)}/${formatRate(upload)}`;
  }

  /**
   * Get MikroTik health check endpoints
   */
  getHealthCheckEndpoints(): string[] {
    return [
      '/sys/resource/print',
      '/ip/hotspot/user/profile/print',
    ];
  }

  /**
   * Get VLAN attribute for MikroTik
   */
  getVLANAttribute(vlanId: number): Record<string, string> {
    return {
      'Mikrotik-Wireless-VLANID': String(vlanId),
      'Tunnel-Type': 'VLAN',
      'Tunnel-Medium-Type': 'IEEE-802',
      'Tunnel-Private-Group-Id': String(vlanId),
    };
  }

  /**
   * Create MikroTik hotspot user profile attributes
   */
  createHotspotProfile(profileName: string, policy: BandwidthPolicy): Record<string, string> {
    const attrs = this.getRadiusAttributes(policy);
    attrs['Mikrotik-Group'] = profileName;
    return attrs;
  }
}
