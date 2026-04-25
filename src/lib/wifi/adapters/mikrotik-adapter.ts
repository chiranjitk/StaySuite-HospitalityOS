/**
 * MikroTik RouterOS Gateway Adapter
 * 
 * MikroTik RouterOS is widely used in hospitality WiFi deployments.
 * This adapter supports:
 * - RADIUS authentication (via FreeRADIUS)
 * - CoA for session management (via radclient through freeradius-service)
 * - REST API for configuration and monitoring
 * 
 * IMPORTANT: All CoA operations go through freeradius-service API (port 3010)
 * because CoA requires the radclient CLI tool. This adapter is a logical wrapper.
 * 
 * References:
 * - https://wiki.mikrotik.com/wiki/Manual:RouterOS_Wireless_CAPsMAN
 * - https://wiki.mikrotik.com/wiki/Manual:Hotspot
 * - https://wiki.mikrotik.com/wiki/Manual:REST_API
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

const RADIUS_SERVICE_URL = process.env.RADIUS_SERVICE_URL || 'http://localhost:3010';

export interface MikrotikConfig extends GatewayConfig {
  vendor: 'mikrotik';
  // MikroTik-specific settings
  hotspotProfile?: string;
  capsManEnabled?: boolean;
  bridgeName?: string;
  externalPortal?: boolean;
}

/**
 * Helper to make requests to the freeradius-service
 * Used for all CoA operations that require radclient CLI
 */
async function freeradiusRequest(endpoint: string, options: RequestInit = {}) {
  const url = `${RADIUS_SERVICE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let parsedError;
    try {
      parsedError = JSON.parse(errorBody);
    } catch {
      parsedError = { error: errorBody };
    }
    return { success: false, status: response.status, ...parsedError };
  }

  return response.json();
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
   * Uses MikroTik REST API at /rest/system/resource
   * Falls back to basic HTTP connectivity check
   */
  async testConnection(): Promise<{ success: boolean; latency?: number; error?: string }> {
    const startTime = Date.now();

    try {
      const apiPort = this.config.apiPort || 443;
      const baseUrl = `http://${this.config.ipAddress}:${apiPort}/rest`;

      // Try MikroTik REST API (available in RouterOS 6.43+)
      const response = await fetch(`${baseUrl}/system/resource`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiUsername && this.config.apiPassword
            ? { 'Authorization': `Basic ${Buffer.from(`${this.config.apiUsername}:${this.config.apiPassword}`).toString('base64')}` }
            : {}),
        },
        signal: AbortSignal.timeout(5000),
      });

      const latency = Date.now() - startTime;

      if (response.ok) {
        return {
          success: true,
          latency,
        };
      }

      // If REST API returns auth error but we got a response, connection works
      if (response.status === 401 || response.status === 403) {
        return {
          success: true,
          latency,
        };
      }

      return {
        success: false,
        latency,
        error: `MikroTik REST API returned status ${response.status}`,
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      return {
        success: false,
        latency,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  /**
   * Send CoA (Change of Authorization) to MikroTik
   * 
   * Routes through freeradius-service API which uses radclient CLI.
   * CoA packets are sent to the MikroTik NAS on the CoA port (default 3799).
   * 
   * MikroTik supports CoA via RADIUS on port 3799.
   * Requires hotspot configuration with CoA enabled.
   */
  async sendCoA(request: CoARequest): Promise<CoAResponse> {
    try {
      const coaAttributes = this.buildCoAAttributes(request);

      // Route through freeradius-service which has radclient CLI
      const result = await freeradiusRequest('/api/coa/disconnect', {
        method: 'POST',
        body: JSON.stringify({
          username: request.username,
          sessionId: request.sessionId,
          nasIp: this.config.ipAddress,
          coaPort: this.config.coaPort,
          secret: this.config.coaSecret || this.config.radiusSecret,
          action: request.action,
          attributes: coaAttributes,
        }),
      });

      return {
        success: result.success !== false,
        message: result.message || `CoA ${request.action} sent`,
        error: result.error,
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
   * Get gateway status from MikroTik REST API
   * Aggregates data from MikroTik API and RADIUS accounting
   */
  async getStatus(): Promise<GatewayStatus> {
    try {
      const apiPort = this.config.apiPort || 443;
      const baseUrl = `http://${this.config.ipAddress}:${apiPort}/rest`;

      const response = await fetch(`${baseUrl}/system/resource`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiUsername && this.config.apiPassword
            ? { 'Authorization': `Basic ${Buffer.from(`${this.config.apiUsername}:${this.config.apiPassword}`).toString('base64')}` }
            : {}),
        },
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          online: true,
          firmwareVersion: data['version'] || data['board-name'] || undefined,
          cpuUsage: data['cpu-load'] ?? undefined,
          memoryUsage: data['total-memory'] && data['free-memory']
            ? Math.round(((data['total-memory'] - data['free-memory']) / data['total-memory']) * 100)
            : undefined,
          uptime: data['uptime'] ? this.parseMikrotikUptime(data['uptime']) : undefined,
          totalClients: undefined, // Will be filled from accounting
          lastSeen: new Date(),
        };
      }

      // Fallback: try to get active sessions count from accounting
      const accountingResult = await freeradiusRequest('/api/accounting/active?nasIp=' + this.config.ipAddress);
      return {
        online: true,
        totalClients: accountingResult.count || accountingResult.totalActive || 0,
        lastSeen: new Date(),
      };
    } catch {
      // If MikroTik API is unreachable, check accounting for last activity
      try {
        const accountingResult = await freeradiusRequest('/api/accounting?status=active&nasIp=' + this.config.ipAddress + '&limit=1');
        if (accountingResult.sessions && accountingResult.sessions.length > 0) {
          return {
            online: true,
            totalClients: accountingResult.totalActive || accountingResult.count || 0,
            lastSeen: new Date(),
          };
        }
      } catch {
        // Ignore accounting check failure
      }

      return {
        online: false,
        lastSeen: new Date(),
      };
    }
  }

  /**
   * Get active sessions
   * Parses from RADIUS accounting data (primary source of truth)
   * MikroTik hotspot active list is secondary
   */
  async getActiveSessions(): Promise<SessionInfo[]> {
    try {
      const result = await freeradiusRequest('/api/accounting?status=active&limit=200');

      if (!result || !result.sessions) {
        return [];
      }

      return (result.sessions || []).map((session: Record<string, unknown>) => ({
        sessionId: String(session.acctSessionId || session.sessionId || ''),
        username: String(session.username || ''),
        ipAddress: String(session.framedIpAddress || session.ipAddress || ''),
        macAddress: String(session.callingStationId || session.macAddress || ''),
        nasIpAddress: String(session.nasIpAddress || ''),
        startTime: new Date(String(session.acctStartTime || session.startTime || new Date())),
        duration: Number(session.acctSessionTime || session.sessionTime || 0),
        bytesIn: Number(session.acctInputOctets || session.inputOctets || 0),
        bytesOut: Number(session.acctOutputOctets || session.outputOctets || 0),
        status: 'active' as const,
        apName: String(session.calledStationId || session.apMac || ''),
        vlanId: session.vlanId ? Number(session.vlanId) : undefined,
        additionalInfo: {
          nasPortId: session.nasPortId,
          connectInfo: session.connectInfo,
        },
      }));
    } catch {
      return [];
    }
  }

  /**
   * Disconnect a session via CoA
   * Proxies to freeradius-service /api/coa/disconnect
   */
  async disconnectSession(sessionId: string, username: string): Promise<CoAResponse> {
    try {
      const result = await freeradiusRequest('/api/coa/disconnect', {
        method: 'POST',
        body: JSON.stringify({
          username,
          sessionId,
          nasIp: this.config.ipAddress,
          coaPort: this.config.coaPort,
          secret: this.config.coaSecret || this.config.radiusSecret,
        }),
      });

      return {
        success: result.success !== false,
        message: result.message || 'Disconnect sent',
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Disconnect failed',
      };
    }
  }

  /**
   * Update bandwidth for a session via CoA
   * Proxies to freeradius-service /api/coa/bandwidth
   */
  async updateBandwidth(
    sessionId: string,
    username: string,
    policy: BandwidthPolicy
  ): Promise<CoAResponse> {
    const attributes = this.getRadiusAttributes(policy);

    try {
      const result = await freeradiusRequest('/api/coa/bandwidth', {
        method: 'POST',
        body: JSON.stringify({
          username,
          sessionId,
          nasIp: this.config.ipAddress,
          coaPort: this.config.coaPort,
          secret: this.config.coaSecret || this.config.radiusSecret,
          attributes,
        }),
      });

      return {
        success: result.success !== false,
        message: result.message || 'Bandwidth update sent',
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Bandwidth update failed',
      };
    }
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
    const downloadMbps = policy.downloadSpeed / 1000000; // bps to Mbps
    const uploadMbps = policy.uploadSpeed / 1000000;

    attrs['Mikrotik-Rate-Limit'] = `${downloadMbps}M/${uploadMbps}M`;

    // Data limit
    if (policy.dataLimit && policy.dataLimit > 0) {
      attrs['Mikrotik-Total-Limit'] = String(policy.dataLimit);
    }

    return attrs;
  }

  /**
   * Format bandwidth for MikroTik
   * MikroTik uses: rx-rate/tx-rate
   */
  formatBandwidthLimit(download: number, upload: number): string {
    const formatRate = (bps: number): string => {
      if (bps >= 1000000000) return `${bps / 1000000000}G`;
      if (bps >= 1000000) return `${bps / 1000000}M`;
      if (bps >= 1000) return `${bps / 1000}k`;
      return String(bps);
    };

    return `${formatRate(download)}/${formatRate(upload)}`;
  }

  /**
   * Get MikroTik health check endpoints
   */
  getHealthCheckEndpoints(): string[] {
    return [
      '/rest/system/resource',
      '/rest/ip/hotspot/user/profile',
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

  /**
   * Parse MikroTik uptime string (e.g., "10w2d3h4m5s") to seconds
   */
  private parseMikrotikUptime(uptime: string): number {
    const regex = /(\d+)w(\d+)d(\d+)h(\d+)m(\d+)s/;
    const match = uptime.match(regex);
    if (!match) return 0;

    const weeks = parseInt(match[1], 10);
    const days = parseInt(match[2], 10);
    const hours = parseInt(match[3], 10);
    const minutes = parseInt(match[4], 10);
    const seconds = parseInt(match[5], 10);

    return weeks * 604800 + days * 86400 + hours * 3600 + minutes * 60 + seconds;
  }
}
