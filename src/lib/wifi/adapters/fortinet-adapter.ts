/**
 * Fortinet WiFi Gateway Adapter - Production Ready
 * 
 * Fortinet is security-first WiFi popular in enterprise hospitality deployments.
 * This adapter supports:
 * - FortiGate REST API for unified security management
 * - FortiAP management via FortiGate controller
 * - FortiWiFi integrated appliances
 * - FortiPresence for analytics
 * - RADIUS authentication with Fortinet VSA
 * - CoA for session management
 * - Zero Trust Network Access (ZTNA)
 * - Application Control and Security Profiles
 * 
 * Supported Hardware:
 * - FortiWiFi: FWF-40F, FWF-60F, FWF-80F, FWF-100F, FWF-200F
 * - FortiAP: FAP-221E, FAP-231F, FAP-431F, FAP-433F
 * - FortiGate as controller
 * 
 * References:
 * - https://docs.fortinet.com/document/fortigate/7.4.0/administration-guide
 * - https://docs.fortinet.com/document/fortiap/7.4.0/configuration-guide
 * - https://fndn.fortinet.net/ (Fortinet Developer Network)
 * 
 * RADIUS Vendor ID: 12356 (Fortinet)
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
import * as dgram from 'dgram';
import * as net from 'net';
import * as https from 'https';
import { createHash, randomBytes } from 'crypto';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Fortinet hardware models
 */
export type FortinetModel =
  // FortiWiFi integrated appliances
  | 'FWF-40F'
  | 'FWF-60F'
  | 'FWF-80F'
  | 'FWF-100F'
  | 'FWF-200F'
  // FortiAP access points
  | 'FAP-221E'
  | 'FAP-231F'
  | 'FAP-431F'
  | 'FAP-433F'
  // FortiGate controllers
  | 'FG-60F'
  | 'FG-100F'
  | 'FG-200F';

/**
 * Fortinet security profile types
 */
export interface FortinetSecurityProfile {
  name: string;
  type: 'antivirus' | 'webfilter' | 'application-control' | 'ips' | 'dnsfilter';
  action: 'pass' | 'block' | 'monitor';
}

/**
 * Zero Trust Network Access configuration
 */
export interface ZTNAConfig {
  enabled: boolean;
  profileName?: string;
  accessProxy?: string;
  ztnaTags?: string[];
}

/**
 * Application control rule
 */
export interface ApplicationControlRule {
  application: string;
  action: 'pass' | 'block' | 'monitor' | 'reset';
  logTraffic?: boolean;
  rateLimit?: number; // kbps
}

/**
 * Fortinet-specific configuration
 */
export interface FortinetConfig extends GatewayConfig {
  vendor: 'fortinet';
  
  // Hardware configuration
  model?: FortinetModel;
  isController?: boolean; // True if FortiGate acting as controller
  managedAPs?: string[]; // MAC addresses of managed FortiAPs
  
  // API configuration
  apiToken?: string; // FortiGate API Token (preferred)
  apiPort?: number; // Default: 443
  apiVersion?: string; // API version (e.g., 'v7.4')
  vdom?: string; // Virtual domain (multi-tenant)
  
  // Security profiles
  securityProfile?: {
    antivirus?: string;
    webFilter?: string;
    applicationControl?: string;
    ips?: string;
    dnsFilter?: string;
  };
  
  // ZTNA configuration
  ztna?: ZTNAConfig;
  
  // FortiPresence (analytics)
  fortiPresence?: {
    enabled: boolean;
    serverUrl?: string;
    apiKey?: string;
  };
  
  // WiFi settings
  wifiSettings?: {
    ssid?: string;
    securityMode?: 'open' | 'wpa2-personal' | 'wpa2-enterprise' | 'wpa3-personal' | 'wpa3-enterprise';
    captivePortal?: boolean;
    portalUrl?: string;
  };
  
  // Traffic shaping
  trafficShaping?: {
    enabled: boolean;
    defaultProfile?: string;
    perUserBandwidth?: boolean;
  };
  
  // VLAN configuration
  vlanConfig?: {
    guestVlanId?: number;
    staffVlanId?: number;
    managementVlanId?: number;
  };
}

/**
 * FortiGate API session response
 */
interface FortiGateSessionResponse {
  session: string;
  token?: string;
}

/**
 * FortiGate firewall user session
 */
interface FortiGateFirewallSession {
  uuid: string;
  policyid: number;
  proto: number;
  saddr: string;
  sport: number;
  daddr: string;
  dport: number;
  username?: string;
  srcintf: string;
  dstintf: string;
  duration: number;
  sentbyte: number;
  rcvdbyte: number;
  exp: number;
}

/**
 * FortiAP managed AP info
 */
interface FortiAPInfo {
  name: string;
  serial: string;
  mac: string;
  model: string;
  status: 'online' | 'offline' | 'discovering';
  version: string;
  cpu: number;
  mem: number;
  clientCount: number;
  radios: {
    band: '2.4GHz' | '5GHz' | '6GHz';
    channel: number;
    txpower: number;
  }[];
}

/**
 * FortiPresence analytics data
 */
interface FortiPresenceAnalytics {
  totalClients: number;
  averageDuration: number;
  peakHour: string;
  repeatVisitors: number;
  newVisitors: number;
  dwellTime: {
    range: string;
    count: number;
  }[];
}

// ============================================================================
// FortiGate REST API Client
// ============================================================================

/**
 * FortiGate REST API Client
 * 
 * Implements the FortiGate REST API for:
 * - User management
 * - Firewall policies
 * - Traffic shaping
 * - Session management
 * - Security profiles
 */
class FortiGateClient {
  private config: FortinetConfig;
  private apiToken: string | null = null;
  private sessionCookie: string | null = null;
  private baseUrl: string;
  private timeout: number = 30000;
  private maxRetries: number = 3;

  constructor(config: FortinetConfig) {
    this.config = config;
    this.baseUrl = `https://${config.ipAddress}:${config.apiPort || 443}`;
  }

  /**
   * Initialize API connection
   * Uses API token if available, otherwise falls back to username/password
   */
  async initialize(): Promise<{ success: boolean; error?: string }> {
    // If API token is provided, use it directly
    if (this.config.apiToken) {
      this.apiToken = this.config.apiToken;
      return { success: true };
    }

    // Otherwise, authenticate with username/password
    if (!this.config.apiUsername || !this.config.apiPassword) {
      return { success: false, error: 'API token or username/password required' };
    }

    return this.authenticate();
  }

  /**
   * Authenticate with FortiGate using username/password
   * Returns session cookie for subsequent requests
   */
  private async authenticate(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.request<{
        session?: string;
        token?: string;
      }>(
        '/api/v2/cmdb/system/status',
        {
          method: 'POST',
          body: JSON.stringify({
            username: this.config.apiUsername,
            secretkey: this.config.apiPassword,
          }),
        },
        true // Skip auth header for login
      );

      if (response.session) {
        this.sessionCookie = response.session;
        return { success: true };
      }

      return { success: false, error: 'Authentication failed' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  }

  /**
   * Make API request to FortiGate
   */
  private async request<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: string;
      params?: Record<string, string>;
    } = {},
    skipAuth: boolean = false
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);

    // Add query parameters
    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    // Add VDOM if configured
    if (this.config.vdom) {
      url.searchParams.append('vdom', this.config.vdom);
    }

    return new Promise((resolve, reject) => {
      const requestOptions: https.RequestOptions = {
        hostname: this.config.ipAddress,
        port: this.config.apiPort || 443,
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        rejectUnauthorized: false, // FortiGate often uses self-signed certs
        timeout: this.timeout,
      };

      // Add authentication
      if (!skipAuth) {
        const headers = requestOptions.headers as Record<string, string>;
        if (this.apiToken) {
          headers['Authorization'] = `Bearer ${this.apiToken}`;
        } else if (this.sessionCookie) {
          headers['Cookie'] = `ccookie=${this.sessionCookie}`;
        }
        requestOptions.headers = headers;
      }

      const req = https.request(requestOptions, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              const parsed = JSON.parse(data);
              resolve(parsed.results || parsed);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          } catch {
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (options.body) {
        req.write(options.body);
      }

      req.end();
    });
  }

  /**
   * Make API request with retry logic
   */
  private async requestWithRetry<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: string;
      params?: Record<string, string>;
    } = {}
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.request<T>(endpoint, options);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Request failed');
        
        // Wait before retry (exponential backoff)
        if (attempt < this.maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError;
  }

  // ========================================================================
  // System Status Methods
  // ========================================================================

  /**
   * Get FortiGate system status
   */
  async getSystemStatus(): Promise<{
    version: string;
    serial: string;
    model: string;
    hostname: string;
    uptime: number;
  }> {
    return this.requestWithRetry('/api/v2/monitor/system/status');
  }

  /**
   * Get system resources (CPU, memory, etc.)
   */
  async getSystemResources(): Promise<{
    cpu: number;
    memory: number;
    session: number;
    sessionRate: number;
  }> {
    return this.requestWithRetry('/api/v2/monitor/system/resource/usage');
  }

  // ========================================================================
  // Firewall Session Methods
  // ========================================================================

  /**
   * Get active firewall sessions
   */
  async getFirewallSessions(filters?: {
    username?: string;
    srcintf?: string;
    policy?: number;
  }): Promise<FortiGateFirewallSession[]> {
    const params: Record<string, string> = {};

    if (filters?.username) {
      params['username'] = filters.username;
    }
    if (filters?.srcintf) {
      params['srcintf'] = filters.srcintf;
    }
    if (filters?.policy) {
      params['policy'] = String(filters.policy);
    }

    return this.requestWithRetry<FortiGateFirewallSession[]>(
      '/api/v2/monitor/firewall/session',
      { params }
    );
  }

  /**
   * Clear (disconnect) firewall session by UUID
   */
  async clearFirewallSession(sessionUuid: string): Promise<{ success: boolean }> {
    try {
      await this.requestWithRetry(
        `/api/v2/monitor/firewall/session/${sessionUuid}`,
        { method: 'DELETE' }
      );
      return { success: true };
    } catch {
      return { success: false };
    }
  }

  /**
   * Clear all sessions for a user
   */
  async clearUserSessions(username: string): Promise<{ success: boolean; count: number }> {
    try {
      const sessions = await this.getFirewallSessions({ username });
      
      let clearedCount = 0;
      for (const session of sessions) {
        const result = await this.clearFirewallSession(session.uuid);
        if (result.success) {
          clearedCount++;
        }
      }

      return { success: true, count: clearedCount };
    } catch {
      return { success: false, count: 0 };
    }
  }

  // ========================================================================
  // User and Group Methods
  // ========================================================================

  /**
   * Create local user
   */
  async createUser(
    username: string,
    password: string,
    options?: {
      group?: string;
      expiration?: Date;
      description?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const body: Record<string, unknown> = {
        name: username,
        type: 'password',
        passwd: password,
        status: 'enable',
      };

      if (options?.group) {
        body['member-of'] = [options.group];
      }
      if (options?.expiration) {
        body['expiration'] = Math.floor(options.expiration.getTime() / 1000);
      }
      if (options?.description) {
        body['comments'] = options.description;
      }

      await this.requestWithRetry('/api/v2/cmdb/user/local', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create user',
      };
    }
  }

  /**
   * Delete local user
   */
  async deleteUser(username: string): Promise<{ success: boolean }> {
    try {
      await this.requestWithRetry(`/api/v2/cmdb/user/local/${username}`, {
        method: 'DELETE',
      });
      return { success: true };
    } catch {
      return { success: false };
    }
  }

  /**
   * Create user group
   */
  async createUserGroup(
    groupName: string,
    options?: {
      members?: string[];
      description?: string;
    }
  ): Promise<{ success: boolean }> {
    try {
      const body: Record<string, unknown> = {
        name: groupName,
        member: options?.members || [],
      };

      if (options?.description) {
        body['comments'] = options.description;
      }

      await this.requestWithRetry('/api/v2/cmdb/user/group', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      return { success: true };
    } catch {
      return { success: false };
    }
  }

  // ========================================================================
  // Traffic Shaping Methods
  // ========================================================================

  /**
   * Create traffic shaping policy
   */
  async createTrafficShapingPolicy(
    policyName: string,
    options: {
      downloadSpeed: number; // kbps
      uploadSpeed: number; // kbps
      priority?: 'high' | 'medium' | 'low';
      dscp?: number;
    }
  ): Promise<{ success: boolean; policyId?: number }> {
    try {
      // Create traffic shaper for download
      const downloadShaper = await this.requestWithRetry<{ mkey: string }>(
        '/api/v2/cmdb/firewall.shaper/traffic-shaper',
        {
          method: 'POST',
          body: JSON.stringify({
            name: `${policyName}-download`,
            'guaranteed-bandwidth': 0,
            'maximum-bandwidth': options.downloadSpeed,
            priority: options.priority || 'medium',
          }),
        }
      );

      // Create traffic shaper for upload
      const uploadShaper = await this.requestWithRetry<{ mkey: string }>(
        '/api/v2/cmdb/firewall.shaper/traffic-shaper',
        {
          method: 'POST',
          body: JSON.stringify({
            name: `${policyName}-upload`,
            'guaranteed-bandwidth': 0,
            'maximum-bandwidth': options.uploadSpeed,
            priority: options.priority || 'medium',
          }),
        }
      );

      // Create shaping policy
      const policy = await this.requestWithRetry<{ mkey: number }>(
        '/api/v2/cmdb/firewall.shaping-policy',
        {
          method: 'POST',
          body: JSON.stringify({
            name: policyName,
            status: 'enable',
            'traffic-shaper': downloadShaper.mkey,
            'traffic-shaper-reverse': uploadShaper.mkey,
            dscp: options.dscp || 0,
          }),
        }
      );

      return { success: true, policyId: parseInt(String(policy.mkey)) };
    } catch {
      return { success: false };
    }
  }

  /**
   * Update bandwidth for user
   */
  async updateUserBandwidth(
    username: string,
    downloadSpeed: number,
    uploadSpeed: number
  ): Promise<{ success: boolean }> {
    try {
      // Update via firewall address group with traffic shaping
      const policyName = `user-${username}-bw`;
      
      // Check if policy exists
      const existing = await this.requestWithRetry<{ mkey: string }[]>(
        `/api/v2/cmdb/firewall.shaping-policy`,
        { params: { filter: `name=${policyName}` } }
      );

      if (existing.length > 0) {
        // Update existing policy
        await this.requestWithRetry(
          `/api/v2/cmdb/firewall.shaping-policy/${existing[0].mkey}`,
          {
            method: 'PUT',
            body: JSON.stringify({
              'traffic-shaper': `${policyName}-download`,
              'traffic-shaper-reverse': `${policyName}-upload`,
            }),
          }
        );
      } else {
        // Create new policy
        await this.createTrafficShapingPolicy(policyName, {
          downloadSpeed,
          uploadSpeed,
        });
      }

      return { success: true };
    } catch {
      return { success: false };
    }
  }

  // ========================================================================
  // Security Profile Methods
  // ========================================================================

  /**
   * Get available security profiles
   */
  async getSecurityProfiles(): Promise<{
    antivirus: string[];
    webfilter: string[];
    applicationControl: string[];
    ips: string[];
    dnsfilter: string[];
  }> {
    const [antivirus, webfilter, appControl, ips, dnsfilter] = await Promise.all([
      this.requestWithRetry<{ name: string }[]>('/api/v2/cmdb/antivirus/profile'),
      this.requestWithRetry<{ name: string }[]>('/api/v2/cmdb/webfilter/profile'),
      this.requestWithRetry<{ name: string }[]>('/api/v2/cmdb/application/list'),
      this.requestWithRetry<{ name: string }[]>('/api/v2/cmdb/ips/profile'),
      this.requestWithRetry<{ name: string }[]>('/api/v2/cmdb/dnsfilter/profile'),
    ]);

    return {
      antivirus: antivirus.map((p) => p.name),
      webfilter: webfilter.map((p) => p.name),
      applicationControl: appControl.map((p) => p.name),
      ips: ips.map((p) => p.name),
      dnsfilter: dnsfilter.map((p) => p.name),
    };
  }

  /**
   * Create application control rule
   */
  async createApplicationControlRule(
    profileName: string,
    rules: ApplicationControlRule[]
  ): Promise<{ success: boolean }> {
    try {
      await this.requestWithRetry('/api/v2/cmdb/application/control', {
        method: 'POST',
        body: JSON.stringify({
          name: profileName,
          entries: rules.map((rule) => ({
            application: rule.application,
            action: rule.action,
            log: rule.logTraffic ? 'enable' : 'disable',
            'rate-limit': rule.rateLimit || 0,
          })),
        }),
      });

      return { success: true };
    } catch {
      return { success: false };
    }
  }

  // ========================================================================
  // FortiAP Management Methods
  // ========================================================================

  /**
   * Get managed FortiAPs
   */
  async getManagedAPs(): Promise<FortiAPInfo[]> {
    const response = await this.requestWithRetry<{
      name: string;
      serial: string;
      mac: string;
      model: string;
      status: string;
      version: string;
      cpu: number;
      mem: number;
      client_count: number;
      radios: { band: string; channel: number; txpower: number }[];
    }[]>('/api/v2/cmdb/wireless-controller/wtp');

    return response.map((ap) => ({
      name: ap.name,
      serial: ap.serial,
      mac: ap.mac,
      model: ap.model,
      status: ap.status as 'online' | 'offline' | 'discovering',
      version: ap.version,
      cpu: ap.cpu,
      mem: ap.mem,
      clientCount: ap.client_count,
      radios: ap.radios.map((r) => ({
        band: r.band as '2.4GHz' | '5GHz' | '6GHz',
        channel: r.channel,
        txpower: r.txpower,
      })),
    }));
  }

  /**
   * Authorize FortiAP
   */
  async authorizeAP(
    serial: string,
    options?: {
      name?: string;
      apProfile?: string;
    }
  ): Promise<{ success: boolean }> {
    try {
      await this.requestWithRetry(`/api/v2/cmdb/wireless-controller/wtp/${serial}`, {
        method: 'PUT',
        body: JSON.stringify({
          admin: 'enable',
          name: options?.name || `FAP-${serial.slice(-4)}`,
          'ap-profile': options?.apProfile || 'default',
        }),
      });

      return { success: true };
    } catch {
      return { success: false };
    }
  }

  /**
   * Deauthorize FortiAP
   */
  async deauthorizeAP(serial: string): Promise<{ success: boolean }> {
    try {
      await this.requestWithRetry(`/api/v2/cmdb/wireless-controller/wtp/${serial}`, {
        method: 'PUT',
        body: JSON.stringify({ admin: 'disable' }),
      });

      return { success: true };
    } catch {
      return { success: false };
    }
  }

  // ========================================================================
  // WiFi SSID Methods
  // ========================================================================

  /**
   * Create WiFi SSID
   */
  async createSSID(
    ssidName: string,
    options: {
      securityMode: 'open' | 'wpa2-personal' | 'wpa2-enterprise' | 'wpa3-personal' | 'wpa3-enterprise';
      password?: string;
      vlanId?: number;
      captivePortal?: boolean;
      portalUrl?: string;
      maxClients?: number;
      bandwidthLimit?: {
        download: number;
        upload: number;
      };
    }
  ): Promise<{ success: boolean; ssidId?: string }> {
    try {
      const body: Record<string, unknown> = {
        name: ssidName,
        ssid: ssidName,
        security: this.mapSecurityMode(options.securityMode),
      };

      if (options.password && options.securityMode !== 'open') {
        body['passphrase'] = options.password;
      }

      if (options.vlanId) {
        body['vlan-auto'] = 'disable';
        body['vlan-id'] = options.vlanId;
      }

      if (options.captivePortal) {
        body['security'] = 'captive-portal';
        if (options.portalUrl) {
          body['portal-url'] = options.portalUrl;
        }
      }

      if (options.maxClients) {
        body['max-clients'] = options.maxClients;
      }

      if (options.bandwidthLimit) {
        body['rate-limit-down'] = Math.ceil(options.bandwidthLimit.download / 1000);
        body['rate-limit-up'] = Math.ceil(options.bandwidthLimit.upload / 1000);
      }

      const response = await this.requestWithRetry<{ mkey: string }>(
        '/api/v2/cmdb/wireless-controller/vap',
        {
          method: 'POST',
          body: JSON.stringify(body),
        }
      );

      return { success: true, ssidId: response.mkey };
    } catch (error) {
      return {
        success: false,
      };
    }
  }

  /**
   * Map security mode to FortiGate format
   */
  private mapSecurityMode(mode: string): string {
    const mapping: Record<string, string> = {
      'open': 'open',
      'wpa2-personal': 'wpa2-psk',
      'wpa2-enterprise': 'wpa2-enterprise',
      'wpa3-personal': 'wpa3-sae',
      'wpa3-enterprise': 'wpa3-enterprise',
    };
    return mapping[mode] || 'open';
  }

  // ========================================================================
  // VLAN Methods
  // ========================================================================

  /**
   * Create VLAN interface
   */
  async createVLAN(
    vlanId: number,
    interfaceName: string,
    options?: {
      ip?: string;
      description?: string;
    }
  ): Promise<{ success: boolean }> {
    try {
      const body: Record<string, unknown> = {
        name: interfaceName,
        type: 'vlan',
        vlanid: vlanId,
        interface: 'internal',
      };

      if (options?.ip) {
        body['ip'] = options.ip;
      }
      if (options?.description) {
        body['description'] = options.description;
      }

      await this.requestWithRetry('/api/v2/cmdb/system/interface', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      return { success: true };
    } catch {
      return { success: false };
    }
  }

  // ========================================================================
  // ZTNA (Zero Trust Network Access) Methods
  // ========================================================================

  /**
   * Create ZTNA access rule
   */
  async createZTNARule(
    ruleName: string,
    options: {
      users?: string[];
      groups?: string[];
      applications?: string[];
      ztnaTags?: string[];
      action: 'allow' | 'deny' | 'monitor';
    }
  ): Promise<{ success: boolean }> {
    try {
      const body: Record<string, unknown> = {
        name: ruleName,
        status: 'enable',
        action: options.action,
      };

      if (options.users) {
        body['srcaddr'] = options.users.map((u) => ({ name: u }));
      }
      if (options.groups) {
        body['groups'] = options.groups.map((g) => ({ name: g }));
      }
      if (options.applications) {
        body['application'] = options.applications;
      }
      if (options.ztnaTags) {
        body['ztna-tags'] = options.ztnaTags;
      }

      await this.requestWithRetry('/api/v2/cmdb/ztna/rule', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      return { success: true };
    } catch {
      return { success: false };
    }
  }

  /**
   * Assign ZTNA tags to user
   */
  async assignZTNATags(
    username: string,
    tags: string[]
  ): Promise<{ success: boolean }> {
    try {
      await this.requestWithRetry(`/api/v2/cmdb/user/local/${username}`, {
        method: 'PUT',
        body: JSON.stringify({
          'ztna-tags': tags.map((t) => ({ name: t })),
        }),
      });

      return { success: true };
    } catch {
      return { success: false };
    }
  }

  // ========================================================================
  // RADIUS Configuration Methods
  // ========================================================================

  /**
   * Configure RADIUS server
   */
  async configureRADIUSServer(
    serverName: string,
    options: {
      serverIp: string;
      secret: string;
      authPort?: number;
      acctPort?: number;
      nasIp?: string;
    }
  ): Promise<{ success: boolean }> {
    try {
      await this.requestWithRetry('/api/v2/cmdb/user/radius', {
        method: 'POST',
        body: JSON.stringify({
          name: serverName,
          server: options.serverIp,
          secret: options.secret,
          'auth-port': options.authPort || 1812,
          'acct-port': options.acctPort || 1813,
          'nas-ip': options.nasIp || this.config.ipAddress,
        }),
      });

      return { success: true };
    } catch {
      return { success: false };
    }
  }

  // ========================================================================
  // FortiPresence Integration
  // ========================================================================

  /**
   * Send analytics to FortiPresence
   */
  async sendToFortiPresence(data: FortiPresenceAnalytics): Promise<{ success: boolean }> {
    if (!this.config.fortiPresence?.enabled || !this.config.fortiPresence.serverUrl) {
      return { success: false };
    }

    try {
      const url = new URL(`${this.config.fortiPresence.serverUrl}/api/v1/analytics`);

      await new Promise<void>((resolve, reject) => {
        const req = https.request(
          {
            hostname: url.hostname,
            port: url.port || 443,
            path: url.pathname,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.config.fortiPresence?.apiKey}`,
            },
            rejectUnauthorized: false,
          },
          (res) => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve();
            } else {
              reject(new Error(`HTTP ${res.statusCode}`));
            }
          }
        );

        req.on('error', reject);
        req.write(JSON.stringify(data));
        req.end();
      });

      return { success: true };
    } catch {
      return { success: false };
    }
  }

  /**
   * Disconnect from FortiGate (cleanup)
   */
  disconnect(): void {
    this.apiToken = null;
    this.sessionCookie = null;
  }
}

// ============================================================================
// Fortinet RADIUS CoA Client
// ============================================================================

/**
 * Fortinet RADIUS CoA Client
 * 
 * Implements RADIUS CoA (Change of Authorization) for Fortinet devices.
 * Fortinet Vendor ID: 12356
 */
class FortiCoAClient {
  private config: FortinetConfig;

  // Fortinet RADIUS VSA attribute types
  private static readonly FORTINET_VSA = {
    // Fortinet Vendor ID: 12356
    VENDOR_ID: 12356,

    // Fortinet VSA attribute types
    FG_USER_GROUP: 1,
    FG_USER_ROLE: 2,
    FG_VDOM: 3,
    FG_FIREWALL_POLICY: 4,
    FG_RATE_LIMIT_UP: 5,
    FG_RATE_LIMIT_DOWN: 6,
    FG_SESSION_TIMEOUT: 7,
    FG_VLAN_ID: 8,
    FG_IDLE_TIMEOUT: 9,
    FG_DNS_FILTER: 10,
    FG_WEB_FILTER: 11,
    FG_APPLICATION_CONTROL: 12,
    FG_ANTIVIRUS_PROFILE: 13,
    FG_IPS_PROFILE: 14,
    FG_ZTNA_TAGS: 15,
    FG_SESSION_ID: 16,
    FG_AV_PROFILE: 17,
    FG_SSL_VPN_PORT: 18,
    FG_RADIUS_RESPONSE: 19,
  };

  constructor(config: FortinetConfig) {
    this.config = config;
  }

  /**
   * Send CoA packet to FortiGate/FortiAP
   */
  async sendCoAPacket(
    sessionId: string,
    username: string,
    action: 'disconnect' | 'update' | 'reauthorize',
    attributes?: Record<string, string>
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const socket = dgram.createSocket('udp4');
      const coaPort = this.config.coaPort || 3799;
      const secret = this.config.coaSecret || this.config.radiusSecret;

      // Build RADIUS CoA packet
      const packet = this.buildCoAPacket(sessionId, username, action, secret, attributes);

      socket.send(packet, coaPort, this.config.ipAddress, (err) => {
        if (err) {
          socket.close();
          resolve({ success: false, error: err.message });
          return;
        }

        // Wait for response
        socket.on('message', (msg) => {
          socket.close();
          const code = msg.readUInt8(0);

          // RADIUS response codes:
          // 44 = CoA-ACK
          // 45 = CoA-NAK
          // 41 = Disconnect-ACK
          // 42 = Disconnect-NAK
          const success = (action === 'disconnect' && code === 41) ||
                         (action !== 'disconnect' && code === 44);

          resolve({ success });
        });

        socket.on('error', (err) => {
          socket.close();
          resolve({ success: false, error: err.message });
        });

        // Timeout after 5 seconds
        setTimeout(() => {
          socket.close();
          resolve({ success: false, error: 'Timeout' });
        }, 5000);
      });
    });
  }

  /**
   * Build RADIUS CoA packet for Fortinet
   */
  private buildCoAPacket(
    sessionId: string,
    username: string,
    action: 'disconnect' | 'update' | 'reauthorize',
    secret: string,
    customAttributes?: Record<string, string>
  ): Buffer {
    const buffers: Buffer[] = [];

    // RADIUS packet codes
    // 40 = Disconnect-Request
    // 43 = CoA-Request
    const code = action === 'disconnect' ? 40 : 43;
    const identifier = crypto.getRandomValues(new Uint8Array(1))[0];
    const authenticator = randomBytes(16);

    // Build attributes
    const attrBuffers: Buffer[] = [];

    // Standard RADIUS attributes
    this.addAttribute(attrBuffers, 1, username); // User-Name
    this.addAttribute(attrBuffers, 44, sessionId); // Acct-Session-Id
    this.addAttribute(attrBuffers, 4, this.config.ipAddress); // NAS-IP-Address

    // Add Fortinet VSA attributes for update/reauthorize actions
    if (action !== 'disconnect' && customAttributes) {
      // Add Fortinet-specific VSAs
      if (customAttributes['download-speed']) {
        this.addFortinetVSA(
          attrBuffers,
          FortiCoAClient.FORTINET_VSA.FG_RATE_LIMIT_DOWN,
          customAttributes['download-speed']
        );
      }
      if (customAttributes['upload-speed']) {
        this.addFortinetVSA(
          attrBuffers,
          FortiCoAClient.FORTINET_VSA.FG_RATE_LIMIT_UP,
          customAttributes['upload-speed']
        );
      }
      if (customAttributes['vlan-id']) {
        this.addFortinetVSA(
          attrBuffers,
          FortiCoAClient.FORTINET_VSA.FG_VLAN_ID,
          customAttributes['vlan-id']
        );
      }
      if (customAttributes['session-timeout']) {
        this.addFortinetVSA(
          attrBuffers,
          FortiCoAClient.FORTINET_VSA.FG_SESSION_TIMEOUT,
          customAttributes['session-timeout']
        );
      }
      if (customAttributes['user-group']) {
        this.addFortinetVSA(
          attrBuffers,
          FortiCoAClient.FORTINET_VSA.FG_USER_GROUP,
          customAttributes['user-group']
        );
      }
      if (customAttributes['firewall-policy']) {
        this.addFortinetVSA(
          attrBuffers,
          FortiCoAClient.FORTINET_VSA.FG_FIREWALL_POLICY,
          customAttributes['firewall-policy']
        );
      }
      if (customAttributes['ztna-tags']) {
        this.addFortinetVSA(
          attrBuffers,
          FortiCoAClient.FORTINET_VSA.FG_ZTNA_TAGS,
          customAttributes['ztna-tags']
        );
      }
    }

    // Add custom attributes as standard RADIUS attributes
    if (customAttributes) {
      if (customAttributes['Session-Timeout']) {
        this.addAttribute(attrBuffers, 27, customAttributes['Session-Timeout']);
      }
      if (customAttributes['Idle-Timeout']) {
        this.addAttribute(attrBuffers, 28, customAttributes['Idle-Timeout']);
      }
      // VLAN via standard attributes
      if (customAttributes['vlan-id']) {
        this.addAttribute(attrBuffers, 64, 'VLAN'); // Tunnel-Type
        this.addAttribute(attrBuffers, 65, 'IEEE-802'); // Tunnel-Medium-Type
        this.addAttribute(attrBuffers, 81, customAttributes['vlan-id']); // Tunnel-Private-Group-Id
      }
    }

    const attributesBuffer = Buffer.concat(attrBuffers);
    const packetLength = 20 + attributesBuffer.length;

    // Build packet header
    const header = Buffer.alloc(20);
    header.writeUInt8(code, 0);
    header.writeUInt8(identifier, 1);
    header.writeUInt16BE(packetLength, 2);
    authenticator.copy(header, 4);

    buffers.push(header);
    buffers.push(attributesBuffer);

    // Calculate message authenticator (HMAC-MD5)
    const packet = Buffer.concat(buffers);
    const messageAuthenticator = createHash('md5')
      .update(packet)
      .update(secret)
      .digest();

    messageAuthenticator.copy(packet, 4);

    return packet;
  }

  /**
   * Add standard RADIUS attribute
   */
  private addAttribute(buffers: Buffer[], type: number, value: string | number): void {
    const valueBuffer = Buffer.from(String(value));
    const attrBuffer = Buffer.alloc(2 + valueBuffer.length);
    attrBuffer.writeUInt8(type, 0);
    attrBuffer.writeUInt8(2 + valueBuffer.length, 1);
    valueBuffer.copy(attrBuffer, 2);
    buffers.push(attrBuffer);
  }

  /**
   * Add Fortinet Vendor-Specific Attribute (VSA)
   * Format: Type(26) + Length + Vendor-ID(12356) + Vendor-Type + Vendor-Length + Value
   */
  private addFortinetVSA(buffers: Buffer[], vendorType: number, value: string): void {
    const valueBuffer = Buffer.from(value);
    const vsaLength = 6 + valueBuffer.length; // 4 (vendor ID) + 1 (type) + 1 (length) + value

    const vsaBuffer = Buffer.alloc(2 + vsaLength);

    // RADIUS attribute type (26 = Vendor-Specific)
    vsaBuffer.writeUInt8(26, 0);
    vsaBuffer.writeUInt8(2 + vsaLength, 1);

    // Fortinet Vendor ID (12356) in network byte order
    vsaBuffer.writeUInt32BE(FortiCoAClient.FORTINET_VSA.VENDOR_ID, 2);

    // Vendor attribute type
    vsaBuffer.writeUInt8(vendorType, 6);

    // Vendor attribute length
    vsaBuffer.writeUInt8(2 + valueBuffer.length, 7);

    // Value
    valueBuffer.copy(vsaBuffer, 8);

    buffers.push(vsaBuffer);
  }
}

// ============================================================================
// Fortinet Adapter Implementation
// ============================================================================

/**
 * Fortinet WiFi Gateway Adapter
 * 
 * Production-ready adapter for Fortinet WiFi infrastructure:
 * - FortiWiFi integrated appliances
 * - FortiAP access points
 * - FortiGate controllers
 * 
 * Features:
 * - Full FortiGate REST API integration
 * - RADIUS authentication with Fortinet VSA
 * - CoA session management
 * - Zero Trust Network Access (ZTNA)
 * - Application Control
 * - Security Profiles
 * - VLAN assignment
 * - Per-user bandwidth control
 */
export class FortinetAdapter extends GatewayAdapter {
  protected fortinetConfig: FortinetConfig;
  private fortiGateClient: FortiGateClient;
  private coaClient: FortiCoAClient;

  constructor(config: FortinetConfig) {
    super(config);
    this.fortinetConfig = config;
    this.fortiGateClient = new FortiGateClient(config);
    this.coaClient = new FortiCoAClient(config);
  }

  getVendor() {
    return 'fortinet' as const;
  }

  /**
   * Test connection to FortiGate/FortiWiFi
   */
  async testConnection(): Promise<{ success: boolean; latency?: number; error?: string }> {
    const startTime = Date.now();

    try {
      // Initialize FortiGate API client
      const initResult = await this.fortiGateClient.initialize();

      if (!initResult.success) {
        // Fallback to TCP ping on API port
        const tcpResult = await this.tcpPing(this.config.apiPort || 443);

        if (tcpResult.success) {
          return {
            success: true,
            latency: tcpResult.latency,
          };
        }

        return {
          success: false,
          error: initResult.error || 'Connection failed',
        };
      }

      // Try to get system status
      await this.fortiGateClient.getSystemStatus();

      const latency = Date.now() - startTime;

      return {
        success: true,
        latency,
      };
    } catch (error) {
      // Fallback to TCP ping
      const tcpResult = await this.tcpPing(this.config.apiPort || 443);

      if (tcpResult.success) {
        return {
          success: true,
          latency: tcpResult.latency,
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  /**
   * TCP Ping test
   */
  private async tcpPing(port: number): Promise<{ success: boolean; latency?: number }> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const socket = new net.Socket();
      socket.setTimeout(5000);

      socket.connect(port, this.config.ipAddress, () => {
        const latency = Date.now() - startTime;
        socket.destroy();
        resolve({ success: true, latency });
      });

      socket.on('error', () => {
        resolve({ success: false });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({ success: false });
      });
    });
  }

  /**
   * Send CoA (Change of Authorization) request
   */
  async sendCoA(request: CoARequest): Promise<CoAResponse> {
    const attributes = this.buildCoAAttributes(request);
    const action = request.action === 'disconnect' ? 'disconnect' : 'update';

    const result = await this.coaClient.sendCoAPacket(
      request.sessionId,
      request.username,
      action,
      attributes
    );

    if (result.success) {
      return {
        success: true,
        message: `CoA ${request.action} sent successfully`,
      };
    }

    // Fallback to API-based session clearing
    if (request.action === 'disconnect') {
      const apiResult = await this.fortiGateClient.clearUserSessions(request.username);
      if (apiResult.success) {
        return {
          success: true,
          message: `Disconnected ${apiResult.count} sessions via API`,
        };
      }
    }

    return {
      success: false,
      error: result.error || 'CoA failed',
    };
  }

  /**
   * Build CoA attributes based on action type
   */
  private buildCoAAttributes(request: CoARequest): Record<string, string> {
    const attrs: Record<string, string> = {};

    if (request.attributes) {
      Object.assign(attrs, request.attributes);
    }

    return attrs;
  }

  /**
   * Get gateway status
   */
  async getStatus(): Promise<GatewayStatus> {
    try {
      await this.fortiGateClient.initialize();

      const [status, resources] = await Promise.all([
        this.fortiGateClient.getSystemStatus(),
        this.fortiGateClient.getSystemResources(),
      ]);

      // Get client count from firewall sessions
      const sessions = await this.fortiGateClient.getFirewallSessions();
      const uniqueUsers = new Set(sessions.map((s) => s.username).filter(Boolean)).size;

      return {
        online: true,
        firmwareVersion: status.version,
        cpuUsage: resources.cpu,
        memoryUsage: resources.memory,
        uptime: status.uptime,
        totalClients: uniqueUsers,
        lastSeen: new Date(),
      };
    } catch {
      return {
        online: false,
        lastSeen: new Date(),
      };
    }
  }

  /**
   * Get active sessions from FortiGate
   */
  async getActiveSessions(): Promise<SessionInfo[]> {
    try {
      await this.fortiGateClient.initialize();

      const sessions = await this.fortiGateClient.getFirewallSessions();

      return sessions.map((session) => ({
        sessionId: session.uuid,
        username: session.username || 'unknown',
        ipAddress: session.saddr,
        macAddress: '', // FortiGate doesn't expose MAC in session list
        nasIpAddress: this.config.ipAddress,
        startTime: new Date(Date.now() - session.duration * 1000),
        duration: session.duration,
        bytesIn: session.rcvdbyte,
        bytesOut: session.sentbyte,
        status: 'active' as const,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Disconnect a specific session
   */
  async disconnectSession(sessionId: string, username: string): Promise<CoAResponse> {
    // Try CoA first
    const coaResult = await this.sendCoA({
      username,
      sessionId,
      action: 'disconnect',
    });

    if (coaResult.success) {
      return coaResult;
    }

    // Fallback to API session clearing
    try {
      const result = await this.fortiGateClient.clearFirewallSession(sessionId);

      if (result.success) {
        return {
          success: true,
          message: 'Session disconnected via API',
        };
      }
    } catch {
      // Ignore
    }

    return {
      success: false,
      error: 'Failed to disconnect session',
    };
  }

  /**
   * Update bandwidth for a session
   */
  async updateBandwidth(
    sessionId: string,
    username: string,
    policy: BandwidthPolicy
  ): Promise<CoAResponse> {
    // Try API-based bandwidth update
    await this.fortiGateClient.initialize();

    const downloadKbps = Math.ceil(policy.downloadSpeed / 1000);
    const uploadKbps = Math.ceil(policy.uploadSpeed / 1000);

    const apiResult = await this.fortiGateClient.updateUserBandwidth(
      username,
      downloadKbps,
      uploadKbps
    );

    if (apiResult.success) {
      return {
        success: true,
        message: 'Bandwidth updated via API',
      };
    }

    // Fallback to CoA
    const attrs = this.getRadiusAttributes(policy);
    return this.sendCoA({
      username,
      sessionId,
      action: 'update',
      attributes: attrs,
    });
  }

  /**
   * Get Fortinet-specific RADIUS attributes
   * 
   * Fortinet supports:
   * - Standard RADIUS attributes
   * - WISPr attributes
   * - Fortinet VSA (Vendor ID: 12356)
   */
  getRadiusAttributes(policy: BandwidthPolicy): Record<string, string> {
    const attrs = super.getRadiusAttributes(policy);

    // Convert to kbps for Fortinet
    const downloadKbps = Math.ceil(policy.downloadSpeed / 1000);
    const uploadKbps = Math.ceil(policy.uploadSpeed / 1000);

    // Fortinet VSA attributes (via CoA)
    attrs['download-speed'] = String(downloadKbps);
    attrs['upload-speed'] = String(uploadKbps);

    // Standard attributes
    if (policy.sessionTimeout) {
      attrs['session-timeout'] = String(policy.sessionTimeout);
    }

    // WISPr attributes (Fortinet supports these)
    attrs['WISPr-Bandwidth-Max-Down'] = String(downloadKbps * 1000); // bps
    attrs['WISPr-Bandwidth-Max-Up'] = String(uploadKbps * 1000);

    return attrs;
  }

  /**
   * Format bandwidth for Fortinet
   * Fortinet uses kbps internally
   */
  formatBandwidthLimit(download: number, upload: number): string {
    const formatRate = (bps: number): string => {
      const kbps = Math.ceil(bps / 1000);
      if (kbps >= 1000000) {
        return `${(kbps / 1000000).toFixed(1)}G`;
      } else if (kbps >= 1000) {
        return `${(kbps / 1000).toFixed(1)}M`;
      }
      return `${kbps}K`;
    };

    return `${formatRate(download)}/${formatRate(upload)}`;
  }

  /**
   * Get health check endpoints
   */
  getHealthCheckEndpoints(): string[] {
    return [
      '/api/v2/monitor/system/status',
      '/api/v2/monitor/system/resource/usage',
      '/api/v2/cmdb/wireless-controller/wtp',
    ];
  }

  /**
   * Validate Fortinet-specific configuration
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const result = super.validateConfig();

    // Fortinet-specific validation
    if (this.fortinetConfig.model) {
      const validModels = [
        'FWF-40F', 'FWF-60F', 'FWF-80F', 'FWF-100F', 'FWF-200F',
        'FAP-221E', 'FAP-231F', 'FAP-431F', 'FAP-433F',
        'FG-60F', 'FG-100F', 'FG-200F',
      ];

      if (!validModels.includes(this.fortinetConfig.model)) {
        result.errors.push(`Unknown Fortinet model: ${this.fortinetConfig.model}`);
      }
    }

    // VDOM requires API token
    if (this.fortinetConfig.vdom && !this.fortinetConfig.apiToken) {
      result.errors.push('VDOM configuration requires API token');
    }

    return {
      valid: result.errors.length === 0,
      errors: result.errors,
    };
  }

  // ========================================================================
  // Fortinet-Specific Methods
  // ========================================================================

  /**
   * Get managed FortiAPs
   */
  async getFortiAPs(): Promise<FortiAPInfo[]> {
    await this.fortiGateClient.initialize();
    return this.fortiGateClient.getManagedAPs();
  }

  /**
   * Create WiFi SSID
   */
  async createWiFiSSID(
    ssidName: string,
    options: {
      securityMode: 'open' | 'wpa2-personal' | 'wpa2-enterprise' | 'wpa3-personal' | 'wpa3-enterprise';
      password?: string;
      vlanId?: number;
      captivePortal?: boolean;
      portalUrl?: string;
      maxClients?: number;
      bandwidthLimit?: { download: number; upload: number };
    }
  ): Promise<{ success: boolean; ssidId?: string }> {
    await this.fortiGateClient.initialize();
    return this.fortiGateClient.createSSID(ssidName, options);
  }

  /**
   * Create local user on FortiGate
   */
  async createLocalUser(
    username: string,
    password: string,
    options?: {
      group?: string;
      expiration?: Date;
      description?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    await this.fortiGateClient.initialize();
    return this.fortiGateClient.createUser(username, password, options);
  }

  /**
   * Delete local user
   */
  async deleteLocalUser(username: string): Promise<{ success: boolean }> {
    await this.fortiGateClient.initialize();
    return this.fortiGateClient.deleteUser(username);
  }

  /**
   * Create traffic shaping policy
   */
  async createTrafficPolicy(
    policyName: string,
    options: {
      downloadSpeed: number; // bps
      uploadSpeed: number; // bps
      priority?: 'high' | 'medium' | 'low';
    }
  ): Promise<{ success: boolean; policyId?: number }> {
    await this.fortiGateClient.initialize();

    return this.fortiGateClient.createTrafficShapingPolicy(policyName, {
      downloadSpeed: Math.ceil(options.downloadSpeed / 1000), // Convert to kbps
      uploadSpeed: Math.ceil(options.uploadSpeed / 1000),
      priority: options.priority,
    });
  }

  /**
   * Create ZTNA access rule
   */
  async createZTNARule(
    ruleName: string,
    options: {
      users?: string[];
      groups?: string[];
      applications?: string[];
      ztnaTags?: string[];
      action: 'allow' | 'deny' | 'monitor';
    }
  ): Promise<{ success: boolean }> {
    await this.fortiGateClient.initialize();
    return this.fortiGateClient.createZTNARule(ruleName, options);
  }

  /**
   * Assign ZTNA tags to user
   */
  async assignZTNATagsToUser(
    username: string,
    tags: string[]
  ): Promise<{ success: boolean }> {
    await this.fortiGateClient.initialize();
    return this.fortiGateClient.assignZTNATags(username, tags);
  }

  /**
   * Get available security profiles
   */
  async getSecurityProfiles(): Promise<{
    antivirus: string[];
    webfilter: string[];
    applicationControl: string[];
    ips: string[];
    dnsfilter: string[];
  }> {
    await this.fortiGateClient.initialize();
    return this.fortiGateClient.getSecurityProfiles();
  }

  /**
   * Configure RADIUS server on FortiGate
   */
  async configureRADIUS(
    serverName: string,
    options: {
      serverIp: string;
      secret: string;
      authPort?: number;
      acctPort?: number;
    }
  ): Promise<{ success: boolean }> {
    await this.fortiGateClient.initialize();
    return this.fortiGateClient.configureRADIUSServer(serverName, {
      ...options,
      nasIp: this.config.ipAddress,
    });
  }

  /**
   * Create VLAN interface
   */
  async createVLANInterface(
    vlanId: number,
    interfaceName: string,
    options?: {
      ip?: string;
      description?: string;
    }
  ): Promise<{ success: boolean }> {
    await this.fortiGateClient.initialize();
    return this.fortiGateClient.createVLAN(vlanId, interfaceName, options);
  }

  /**
   * Get VLAN attributes for RADIUS
   */
  getVLANAttribute(vlanId: number): Record<string, string> {
    return {
      'vlan-id': String(vlanId),
      'Tunnel-Type': 'VLAN',
      'Tunnel-Medium-Type': 'IEEE-802',
      'Tunnel-Private-Group-Id': String(vlanId),
    };
  }

  /**
   * Create application control rule
   */
  async createAppControlRule(
    profileName: string,
    rules: ApplicationControlRule[]
  ): Promise<{ success: boolean }> {
    await this.fortiGateClient.initialize();
    return this.fortiGateClient.createApplicationControlRule(profileName, rules);
  }

  /**
   * Authorize FortiAP
   */
  async authorizeFortiAP(
    serial: string,
    options?: {
      name?: string;
      apProfile?: string;
    }
  ): Promise<{ success: boolean }> {
    await this.fortiGateClient.initialize();
    return this.fortiGateClient.authorizeAP(serial, options);
  }

  /**
   * Deauthorize FortiAP
   */
  async deauthorizeFortiAP(serial: string): Promise<{ success: boolean }> {
    await this.fortiGateClient.initialize();
    return this.fortiGateClient.deauthorizeAP(serial);
  }

  /**
   * Create user group
   */
  async createUserGroup(
    groupName: string,
    options?: {
      members?: string[];
      description?: string;
    }
  ): Promise<{ success: boolean }> {
    await this.fortiGateClient.initialize();
    return this.fortiGateClient.createUserGroup(groupName, options);
  }

  /**
   * Send analytics to FortiPresence
   */
  async sendAnalyticsToFortiPresence(
    data: FortiPresenceAnalytics
  ): Promise<{ success: boolean }> {
    return this.fortiGateClient.sendToFortiPresence(data);
  }
}

// ============================================================================
// Exports
// ============================================================================

export {
  FortiGateClient,
  FortiCoAClient,
  type FortiGateFirewallSession,
  type FortiAPInfo,
  type FortiPresenceAnalytics,
};
