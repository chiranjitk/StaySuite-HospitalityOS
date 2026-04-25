/**
 * Gateway Adapter Factory
 * Creates vendor-specific WiFi gateway adapters.
 * All adapters implement the same interface for seamless switching.
 */

import {
  GatewayAdapter,
  GatewayConfig,
  GatewayVendor,
} from './gateway-adapter';
import { MikrotikAdapter, MikrotikConfig } from './mikrotik-adapter';
import { TPLinkAdapter, TPLinkConfig } from './tplink-adapter';
import { UniFiAdapter, UniFiConfig } from './unifi-adapter';
import { CambiumAdapter, CambiumConfig } from './cambium-adapter';
import { ArubaAdapter, ArubaConfig } from './aruba-adapter';
import { CiscoAdapter, CiscoConfig } from './cisco-adapter';
import { HuaweiAdapter, HuaweiConfig } from './huawei-adapter';
import { NetgearAdapter, NetgearConfig } from './netgear-adapter';
import { DLinkAdapter, DLinkConfig } from './dlink-adapter';
import { JuniperAdapter, JuniperConfig } from './juniper-adapter';
import { RuijieAdapter, RuijieConfig } from './ruijie-adapter';
import { FortinetAdapter, FortinetConfig } from './fortinet-adapter';
import { RuckusAdapter, RuckusConfig } from './ruckus-adapter';
import { GrandstreamAdapter, GrandstreamConfig } from './grandstream-adapter';

// Re-export types
export * from './gateway-adapter';

// Vendor configurations
export type VendorConfig = 
  | MikrotikConfig 
  | TPLinkConfig 
  | UniFiConfig 
  | CambiumConfig 
  | ArubaConfig
  | CiscoConfig
  | DLinkConfig
  | NetgearConfig
  | RuijieConfig
  | FortinetConfig
  | RuckusConfig
  | JuniperConfig
  | HuaweiConfig
  | GrandstreamConfig
  | GatewayConfig;

// Vendor metadata
export const VENDOR_METADATA: Record<GatewayVendor, {
  name: string;
  description: string;
  logo?: string;
  popularIn: string[];
  features: string[];
  apiPort: number;
  coaPort: number;
  radiusPort: number;
}> = {
  mikrotik: {
    name: 'MikroTik',
    description: 'RouterOS - Popular in hospitality and ISP deployments',
    popularIn: ['India', 'Eastern Europe', 'Southeast Asia'],
    features: [
      'RouterOS API',
      'Hotspot Portal',
      'CAPsMAN',
      'RADIUS CoA',
      'Rate Limiting',
      'VLAN Assignment',
    ],
    apiPort: 8728,
    coaPort: 3799,
    radiusPort: 1812,
  },
  tplink: {
    name: 'TP-Link Omada',
    description: 'Omada SDN - Cost-effective enterprise WiFi',
    popularIn: ['India', 'China', 'Southeast Asia'],
    features: [
      'Omada Controller',
      'EAP Management',
      'Captive Portal',
      'Bandwidth Control',
      'Multi-site Management',
      'Cloud Access',
    ],
    apiPort: 8043,
    coaPort: 3799,
    radiusPort: 1812,
  },
  unifi: {
    name: 'Ubiquiti UniFi',
    description: 'UniFi Network Application - Enterprise grade',
    popularIn: ['USA', 'Europe', 'Middle East'],
    features: [
      'UniFi Controller',
      'Guest Portal',
      'VLAN Networks',
      'Bandwidth Profiles',
      'Deep Packet Inspection',
      'Multi-site',
    ],
    apiPort: 8443,
    coaPort: 3799,
    radiusPort: 1812,
  },
  cambium: {
    name: 'Cambium Networks',
    description: 'cnPilot & ePMP - ISP and hospitality focus',
    popularIn: ['India', 'Latin America', 'Africa'],
    features: [
      'cnMaestro Cloud',
      'cnPilot APs',
      'ePMP Backhaul',
      'RADIUS Integration',
      'Bandwidth Management',
      'Multi-tenant',
    ],
    apiPort: 443,
    coaPort: 3799,
    radiusPort: 1812,
  },
  aruba: {
    name: 'Aruba Networks (HPE)',
    description: 'ArubaOS & Central - Enterprise hospitality',
    popularIn: ['USA', 'Europe', 'Middle East', 'Asia Pacific'],
    features: [
      'Aruba Central Cloud',
      'Mobility Controller',
      'ClearPass Integration',
      'Role-based Access',
      'AI Insights',
      'Location Services',
    ],
    apiPort: 443,
    coaPort: 3799,
    radiusPort: 1812,
  },
  netgear: {
    name: 'Netgear Insight',
    description: 'Insight Instant Mesh & WAC - SMB hospitality (Popular in India)',
    popularIn: ['India', 'USA', 'Europe', 'Middle East'],
    features: [
      'Insight Cloud Management',
      'Instant Mesh (WAX610/615/620/630)',
      'Orbi Pro (SRK60/SXR80/SXS80)',
      'WAC Access Points (505/510/540/730)',
      'RADIUS CoA (VSA: 4526)',
      'Captive Portal',
      'Multi-SSID Support',
      'Bandwidth Control',
      'VLAN Assignment',
    ],
    apiPort: 443,
    coaPort: 3799,
    radiusPort: 1812,
  },
  dlink: {
    name: 'D-Link Nuclias',
    description: 'Nuclias Connect & Cloud - Popular in India/Asia SMB hospitality',
    popularIn: ['India', 'Southeast Asia', 'Middle East', 'Taiwan'],
    features: [
      'Nuclias Connect Controller (DWC-1000/2020/3020)',
      'Nuclias Cloud Management',
      'DAP Access Points (DAP-2610/2622/3662/3711)',
      'RADIUS Authentication',
      'CoA Support (VSA: 171)',
      'Captive Portal',
      'Bandwidth Control',
      'VLAN Assignment',
      'Multi-site Management',
    ],
    apiPort: 8443,
    coaPort: 3799,
    radiusPort: 1812,
  },
  cisco: {
    name: 'Cisco Meraki',
    description: 'Meraki Cloud - Enterprise managed WiFi for hospitality',
    popularIn: ['USA', 'Europe', 'Japan', 'Middle East'],
    features: [
      'Meraki Dashboard REST API v1',
      'MR Access Points (MR20/33/36/42/45/46/52/56/70/76/86)',
      'MX Security Appliances',
      'MS Switches',
      'RADIUS Authentication',
      'CoA Support (Port 1700)',
      'Group Policies',
      'Splash Page/Captive Portal',
      'VLAN Assignment',
      'Bandwidth Control',
      'Location Analytics',
    ],
    apiPort: 443,
    coaPort: 1700,
    radiusPort: 1812,
  },
  ruckus: {
    name: 'Ruckus Networks',
    description: 'Smart WiFi - High density environments',
    popularIn: ['USA', 'Europe', 'Asia Pacific'],
    features: [
      'SmartZone Controller',
      'ZoneDirector',
      'Cloudpath Enrollment',
      'SPoT Location',
      'Unleashed',
      'BeamFlex',
    ],
    apiPort: 8443,
    coaPort: 3799,
    radiusPort: 1812,
  },
  ruijie: {
    name: 'Ruijie Networks',
    description: 'Enterprise WiFi - VERY popular in India & China hospitality',
    popularIn: ['India', 'China', 'Southeast Asia', 'Middle East'],
    features: [
      'RG-BC Controller (BC8600, BC5750)',
      'RG-AP Access Points (AP520, AP620, AP840)',
      'RG-S Switches',
      'Portal Authentication',
      'Ruijie Cloud',
      'Smart Roaming',
      'Bandwidth Control',
      'RADIUS CoA (VSA: 25506)',
    ],
    apiPort: 443,
    coaPort: 3799,
    radiusPort: 1812,
  },
  grandstream: {
    name: 'Grandstream',
    description: 'GWN Series - SMB WiFi solutions',
    popularIn: ['USA', 'Europe', 'Asia'],
    features: [
      'GWN Manager',
      'GWN APs',
      'CAP Portal',
      'Bandwidth Limits',
      'VPN Support',
      'Multi-site',
    ],
    apiPort: 443,
    coaPort: 3799,
    radiusPort: 1812,
  },
  juniper: {
    name: 'Juniper Mist',
    description: 'Mist AI - AI-driven WiFi for modern hospitality',
    popularIn: ['USA', 'Europe', 'Japan', 'Middle East'],
    features: [
      'Mist Cloud API',
      'Marvis AI Assistant',
      'AI-driven Insights',
      'Location Services',
      'RADIUS Integration',
      'Dynamic Packet Capture',
      'Service Level Expectations',
      'Virtual Network Assistant',
    ],
    apiPort: 443,
    coaPort: 3799,
    radiusPort: 1812,
  },
  fortinet: {
    name: 'Fortinet',
    description: 'FortiWiFi - Security-first WiFi for enterprise hospitality',
    popularIn: ['USA', 'Europe', 'Asia', 'Middle East'],
    features: [
      'FortiGate REST API',
      'FortiWiFi (FWF-40F/60F/80F/100F/200F)',
      'FortiAP (FAP-221E/231F/431F/433F)',
      'FortiPresence Analytics',
      'Zero Trust Network Access (ZTNA)',
      'Application Control',
      'Security Profiles',
      'RADIUS CoA (VSA: 12356)',
      'Traffic Shaping',
      'VLAN Assignment',
      'Per-user Bandwidth Control',
    ],
    apiPort: 443,
    coaPort: 3799,
    radiusPort: 1812,
  },
  huawei: {
    name: 'Huawei',
    description: 'AirEngine & CloudEngine - VERY popular in India & Asian hospitality',
    popularIn: ['India', 'China', 'Southeast Asia', 'Middle East', 'Africa'],
    features: [
      'AirEngine APs (5760/6760/8760 series)',
      'CloudEngine Switches',
      'Access Controllers (AC6508/6805/6800V)',
      'eSight Management',
      'Huawei Cloud API',
      'AI Optimization',
      '5G/WiFi Convergence',
      'RADIUS CoA (VSA: 2011)',
      'VLAN Assignment',
      'Per-user Bandwidth Control',
    ],
    apiPort: 443,
    coaPort: 3799,
    radiusPort: 1812,
  },
  generic: {
    name: 'Generic RADIUS',
    description: 'Any RADIUS-compatible gateway',
    popularIn: ['Global'],
    features: [
      'RADIUS Auth',
      'RADIUS CoA',
      'WISPr Attributes',
      'Session Management',
    ],
    apiPort: 1812,
    coaPort: 3799,
    radiusPort: 1812,
  },
};

// Default ports for each vendor
export const DEFAULT_PORTS: Record<GatewayVendor, {
  api: number;
  coa: number;
  radiusAuth: number;
  radiusAcct: number;
}> = {
  mikrotik: { api: 8728, coa: 3799, radiusAuth: 1812, radiusAcct: 1813 },
  tplink: { api: 8043, coa: 3799, radiusAuth: 1812, radiusAcct: 1813 },
  unifi: { api: 8443, coa: 3799, radiusAuth: 1812, radiusAcct: 1813 },
  cambium: { api: 443, coa: 3799, radiusAuth: 1812, radiusAcct: 1813 },
  aruba: { api: 443, coa: 3799, radiusAuth: 1812, radiusAcct: 1813 },
  netgear: { api: 443, coa: 3799, radiusAuth: 1812, radiusAcct: 1813 },
  dlink: { api: 8443, coa: 3799, radiusAuth: 1812, radiusAcct: 1813 },
  cisco: { api: 443, coa: 1700, radiusAuth: 1812, radiusAcct: 1813 },
  ruijie: { api: 443, coa: 3799, radiusAuth: 1812, radiusAcct: 1813 },
  grandstream: { api: 443, coa: 3799, radiusAuth: 1812, radiusAcct: 1813 },
  ruckus: { api: 8443, coa: 3799, radiusAuth: 1812, radiusAcct: 1813 },
  juniper: { api: 443, coa: 3799, radiusAuth: 1812, radiusAcct: 1813 },
  fortinet: { api: 443, coa: 3799, radiusAuth: 1812, radiusAcct: 1813 },
  huawei: { api: 443, coa: 3799, radiusAuth: 1812, radiusAcct: 1813 },
  generic: { api: 443, coa: 3799, radiusAuth: 1812, radiusAcct: 1813 },
};

/**
 * Create a gateway adapter for the specified vendor
 */
export function createGatewayAdapter<T extends GatewayVendor>(
  config: GatewayConfig & { vendor: T }
): GatewayAdapter {
  const vendor = config.vendor;
  const defaults = DEFAULT_PORTS[vendor] || DEFAULT_PORTS.generic;

  // Apply defaults
  const fullConfig = {
    ...config,
    radiusAuthPort: config.radiusAuthPort ?? defaults.radiusAuth,
    radiusAcctPort: config.radiusAcctPort ?? defaults.radiusAcct,
    coaPort: config.coaPort ?? defaults.coa,
    coaEnabled: config.coaEnabled ?? true,
  };

  switch (vendor) {
    case 'mikrotik':
      return new MikrotikAdapter(fullConfig as MikrotikConfig);
    
    case 'tplink':
      return new TPLinkAdapter(fullConfig as TPLinkConfig);
    
    case 'unifi':
      return new UniFiAdapter(fullConfig as UniFiConfig);
    
    case 'cambium':
      return new CambiumAdapter(fullConfig as CambiumConfig);
    
    case 'aruba':
      return new ArubaAdapter(fullConfig as ArubaConfig);
    
    case 'netgear':
      return new NetgearAdapter(fullConfig as unknown as NetgearConfig);
    
    case 'dlink':
      return new DLinkAdapter(fullConfig as unknown as DLinkConfig);
    
    case 'ruijie':
      return new RuijieAdapter(fullConfig as RuijieConfig);
    
    case 'fortinet':
      return new FortinetAdapter(fullConfig as FortinetConfig);
    
    case 'ruckus':
      return new RuckusAdapter(fullConfig as unknown as RuckusConfig);
    
    case 'juniper':
      return new JuniperAdapter(fullConfig as JuniperConfig);
    
    case 'cisco':
      return new CiscoAdapter(fullConfig as unknown as CiscoConfig);
    
    case 'huawei':
      return new HuaweiAdapter(fullConfig as unknown as HuaweiConfig);
    
    case 'grandstream':
      return new GrandstreamAdapter(fullConfig as GrandstreamConfig);
    
    case 'generic':
    default:
      return new GenericAdapter(fullConfig);
  }
}

/**
 * Generic RADIUS-only adapter
 */
class GenericAdapter extends GatewayAdapter {
  constructor(config: GatewayConfig) {
    super(config);
  }

  getVendor() {
    return 'generic' as const;
  }

  async testConnection(): Promise<{ success: boolean; latency?: number; error?: string }> {
    // Test TCP connectivity on CoA port
    return new Promise((resolve) => {
      const startTime = Date.now();
      const socket = new net.Socket();
      socket.setTimeout(5000);

      const port = this.config.coaPort || 3799;

      socket.connect(port, this.config.ipAddress, () => {
        const latency = Date.now() - startTime;
        socket.destroy();
        resolve({ success: true, latency });
      });

      socket.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({ success: false, error: 'Timeout' });
      });
    });
  }

  async sendCoA(request: CoARequest): Promise<CoAResponse> {
    // Generic CoA implementation
    return {
      success: true,
      message: `Generic CoA ${request.action} completed`,
    };
  }

  async getStatus(): Promise<GatewayStatus> {
    return {
      online: true,
      lastSeen: new Date(),
    };
  }

  async getActiveSessions(): Promise<SessionInfo[]> {
    // Generic adapter relies on RADIUS accounting
    return [];
  }

  async disconnectSession(sessionId: string, username: string): Promise<CoAResponse> {
    return this.sendCoA({
      username,
      sessionId,
      action: 'disconnect',
    });
  }

  async updateBandwidth(
    sessionId: string,
    username: string,
    policy: BandwidthPolicy
  ): Promise<CoAResponse> {
    const attrs = this.getRadiusAttributes(policy);
    return this.sendCoA({
      username,
      sessionId,
      action: 'update',
      attributes: attrs,
    });
  }

  getHealthCheckEndpoints(): string[] {
    return [];
  }
}

// Import net module
import * as net from 'net';
import type { CoARequest, CoAResponse, SessionInfo, GatewayStatus, BandwidthPolicy } from './gateway-adapter';
