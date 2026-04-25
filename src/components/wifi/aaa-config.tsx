'use client';

/**
 * AAA Configuration Component
 *
 * Comprehensive RADIUS AAA (Authentication, Authorization, Accounting) configuration
 * with connection to the backend RADIUS management service.
 *
 * Features:
 * - Server Status & Control
 * - Authentication Settings
 * - Authorization Policies
 * - Accounting Configuration
 * - NAS Client Management
 * - Connection Testing
 */

import { useState, useEffect } from 'react';
import { usePropertyId } from '@/hooks/use-property';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertCircle,
  Check,
  CheckCircle,
  ChevronsUpDown,
  Server,
  Shield,
  Database,
  Wifi,
  Settings,
  Play,
  Square,
  RefreshCw,
  Plus,
  Trash2,
  Edit,
  TestTube,
  Key,
  Activity,
  Loader2,
  UserCog,
  Info,
} from 'lucide-react';
import CredentialPolicyTab, { type CredentialConfig } from './credential-policy-tab';
import { useToast } from '@/hooks/use-toast';

// Types
interface RadiusServiceStatus {
  installed: boolean;
  running: boolean;
  version?: string;
  mode: 'production' | 'not_installed';
  nasClientCount: number;
  userCount: number;
  groupCount: number;
  error?: string;
}

interface NASClient {
  id: string;
  name: string;
  shortname: string;
  ipAddress: string;
  type: string;
  secret: string;
  coaEnabled: boolean;
  coaPort: number;
  authPort: number;
  acctPort: number;
  status: string;
  lastSeenAt?: string;
}

interface AAAConfig {
  propertyId: string;
  defaultDownloadSpeed: number;
  defaultUploadSpeed: number;
  defaultSessionLimit?: number;
  defaultDataLimit?: number;
  autoProvisionOnCheckin: boolean;
  autoDeprovisionOnCheckout: boolean;
  autoDeprovisionDelay: number;
  authMethod: string;
  allowMacAuth: boolean;
  accountingSyncInterval: number;
  maxConcurrentSessions: number;
  sessionTimeoutPolicy: string;
  portalEnabled: boolean;
  portalTitle?: string;
  portalRedirectUrl?: string;
  portalBrandColor: string;
  // Credential policy
  usernameFormat: string;
  usernamePrefix?: string;
  usernameCase: string;
  usernameMinLength: number;
  usernameMaxLength: number;
  passwordFormat: string;
  passwordFixedValue?: string;
  passwordLength: number;
  passwordIncludeUppercase: boolean;
  passwordIncludeNumbers: boolean;
  passwordIncludeSymbols: boolean;
  credentialSeparator: string;
  credentialPrintOnVoucher: boolean;
  credentialShowInPortal: boolean;
  duplicateUsernameAction: string;
  defaultPlanId?: string;
}

interface WifiPlan {
  id: string;
  name: string;
  downloadSpeed: number;
  uploadSpeed: number;
  validity?: number;
  dataLimit?: number;
  status: string;
}

interface RadiusServerConfig {
  serverIp: string;
  authPort: number;
  acctPort: number;
  coaPort: number;
  listenAllInterfaces: boolean;
  bindAddress: string;
  logLevel: string;
  logDestination: string;
}

// NAS Device Types — comprehensive FreeRADIUS vendor list
// Organized by category for the searchable Combobox
// Each vendor maps to an attribute profile in the backend for RADIUS attribute generation

interface NasVendorGroup {
  heading: string;
  vendors: { value: string; label: string }[];
}

const NAS_VENDOR_GROUPS: NasVendorGroup[] = [
  {
    heading: 'WiFi AP & Controllers — Hospitality',
    vendors: [
      { value: 'mikrotik', label: 'MikroTik RouterOS' },
      { value: 'cisco', label: 'Cisco Meraki' },
      { value: 'cisco_wlc', label: 'Cisco WLC (Wireless LAN Controller)' },
      { value: 'cisco_ios', label: 'Cisco IOS / Catalyst' },
      { value: 'aruba', label: 'Aruba Networks (HPE)' },
      { value: 'unifi', label: 'Ubiquiti UniFi' },
      { value: 'ubiquiti_edgerouter', label: 'Ubiquiti EdgeRouter / EdgeSwitch' },
      { value: 'ruckus', label: 'Ruckus Networks / CommScope' },
      { value: 'tplink', label: 'TP-Link Omada / EAP' },
      { value: 'fortinet', label: 'Fortinet FortiGate / FortiWiFi' },
      { value: 'huawei', label: 'Huawei AirEngine / AC' },
      { value: 'juniper', label: 'Juniper Mist / SRX' },
      { value: 'netgear', label: 'Netgear Insight / Orbi / WAC' },
      { value: 'dlink', label: 'D-Link Nuclias / DWL' },
      { value: 'ruijie', label: 'Ruijie Networks / Reyee' },
      { value: 'cambium', label: 'Cambium cnPilot / ePMP' },
      { value: 'grandstream', label: 'Grandstream GWN' },
      { value: 'engenius', label: 'EnGenius / ECB' },
      { value: 'zyxel', label: 'Zyxel NWA / NXC' },
      { value: 'extreme', label: 'Extreme Networks / WiNG' },
      { value: 'alcatel', label: 'Alcatel-Lucent / Nokia OmniAccess' },
      { value: 'samsung', label: 'Samsung SmartThings / WiFi' },
      { value: 'zte', label: 'ZTE WiFi / AXON' },
      { value: 'motorola', label: 'Motorola Solutions / Zebra' },
      { value: 'draytek', label: 'DrayTek Vigor / VigorAP' },
      { value: 'peplink', label: 'Peplink / SpeedFusion' },
      { value: 'sophos', label: 'Sophos Sophos Access' },
      { value: 'avaya', label: 'Avaya ERS / WLAN' },
      { value: 'brocade', label: 'Brocade / ICX Switch' },
      { value: 'meru', label: 'Meru Networks (Fortinet)' },
      { value: 'aerohive', label: 'Aerohive / Extreme HiveManager' },
      { value: 'xirrus', label: 'Xirrus / Xirrus Array' },
      { value: 'enterasys', label: 'Enterasys (Extreme)' },
      { value: 'adc_kentrox', label: 'ADC / Kentrox' },
      { value: 'colubris', label: 'Colubris Networks (HP)' },
      { value: 'trapeze', label: 'Trapeze Networks (Juniper)' },
      { value: 'bluesocket', label: 'BlueSocket (Adtran)' },
      { value: 'wavelink', label: 'Wavelink / Telxon' },
      { value: 'symbol', label: 'Symbol / Zebra WiFi' },
      { value: 'proxim', label: 'Proxim / Orinoco' },
      { value: 'breezecom', label: 'Breezecom / BreezeNET' },
      { value: 'intellinet', label: 'Intellinet / Nfon' },
      { value: 'buffalo', label: 'Buffalo AirStation' },
      { value: 'asus', label: 'ASUS RT / ZenWiFi' },
      { value: 'asuswrt', label: 'ASUSWRT / Merlin' },
      { value: 'openwrt', label: 'OpenWrt (Generic)' },
      { value: 'ddwrt', label: 'DD-WRT (Generic)' },
      { value: 'pfsense', label: 'pfSense / pfSense Plus' },
      { value: 'opnsense', label: 'OPNsense' },
      { value: 'edgecore', label: 'Edgecore / Accton' },
      { value: 'altai', label: 'Altai Technologies' },
      { value: 'wili', label: 'WILI-S / Wili-Mesh' },
    ],
  },
  {
    heading: 'Captive Portal & Hotspot',
    vendors: [
      { value: 'coovachilli', label: 'CoovaChilli (ChilliSpot)' },
      { value: 'wifidog', label: 'WiFiDog / wifidog-ng' },
      { value: 'openmesh', label: 'OpenMesh / CloudTrax' },
      { value: 'nomadix', label: 'Nomadix / AG Series' },
      { value: 'firstspot', label: 'FirstSpot' },
      { value: 'antlabs', label: 'AntLabs InnGate' },
      { value: 'wifika', label: 'WIFIKA' },
      { value: 'socialwifi', label: 'Social WiFi / Purple WiFi' },
      { value: 'patronsoft', label: 'PatronSoft' },
      { value: 'mypublicwifi', label: 'MyPublicWiFi' },
      { value: 'wifisplash', label: 'WiFiSplash' },
      { value: 'guestgate', label: 'GuestGate / Wifigate' },
      { value: 'cloud4wifi', label: 'Cloud4WiFi' },
      { value: 'wirelesslogic', label: 'WirelessLogic' },
      { value: 'sputnik', label: 'Sputnik / SputnikNet' },
      { value: 'wifiglobal', label: 'Wifiglobal' },
      { value: 'iwire', label: 'iWire / MyWiFi' },
      { value: 'captiveportal', label: 'Captive Portal (Generic)' },
      { value: 'handlink', label: 'HandLink / Wive' },
      { value: 'wifiplus', label: 'WiFi Plus / WiFiASP' },
      { value: 'aquipia', label: 'Aquipia Networks' },
      { value: 'bintec', label: 'Bintec / Elmeg' },
      { value: 'eltex', label: 'Eltex' },
      { value: 'velox', label: 'Velox' },
      { value: 'alepo', label: 'Alepo RADIUS' },
      { value: 'aptilo', label: 'Aptilo Networks' },
      { value: 'ipass', label: 'iPass / DeviceScape' },
      { value: 'boingo', label: 'Boingo Wireless' },
      { value: 'gowex', label: 'GOWEX' },
      { value: 'fon', label: 'FON' },
      { value: 'eduroam', label: 'eduroam (802.1X)' },
    ],
  },
  {
    heading: 'Firewall & Security',
    vendors: [
      { value: 'paloalto', label: 'Palo Alto Networks' },
      { value: 'checkpoint', label: 'Check Point / NGX' },
      { value: 'sonicwall', label: 'SonicWALL / Dell SonicWALL' },
      { value: 'watchguard', label: 'WatchGuard Firebox' },
      { value: 'barracuda', label: 'Barracuda Networks' },
      { value: 'juniper_srx', label: 'Juniper SRX / vSRX' },
      { value: 'fortigate', label: 'Fortinet FortiGate (Alias)' },
      { value: 'cisco_asa', label: 'Cisco ASA / FirePOWER' },
      { value: 'endian', label: 'Endian Firewall' },
      { value: 'untangle', label: 'Untangle / NG Firewall' },
      { value: 'smoothwall', label: 'Smoothwall' },
      { value: 'clearos', label: 'ClearOS / ClearOS Server' },
      { value: 'kerio', label: 'Kerio Control (GFI)' },
      { value: 'stonesoft', label: 'Stonesoft / Forcepoint' },
      { value: 'clavister', label: 'Clavister' },
      { value: 'cyberguard', label: 'CyberGuard' },
      { value: 'hillstone', label: 'Hillstone Networks' },
      { value: 'sangfor', label: 'Sangfor / DeepSecure' },
      { value: 'deepedge', label: 'Deep Edge' },
      { value: 'netscreen', label: 'Netscreen (Juniper)' },
      { value: 'redcreek', label: 'RedCreek / Ravlin' },
    ],
  },
  {
    heading: 'DSL / ISP CPE / Access',
    vendors: [
      { value: 'redback', label: 'Redback / Ericsson SmartEdge' },
      { value: 'starent', label: 'Starent (Cisco)' },
      { value: 'juniper_e', label: 'Juniper E-Series / ERX' },
      { value: 'cisco_isg', label: 'Cisco ISG (IP-Session-Manager)' },
      { value: 'ascend', label: 'Ascend / Lucent MAX' },
      { value: 'livingston', label: 'Livingston' },
      { value: 'lucent', label: 'Lucent / Alcatel' },
      { value: 'nortel', label: 'Nortel / Shasta' },
      { value: 'paradigm', label: 'Paradigm' },
      { value: 'shiva', label: 'Shiva / Intel' },
      { value: 'broadband', label: 'Broadband Access Server (Generic)' },
      { value: 'cisco_ios_bras', label: 'Cisco IOS BRAS' },
      { value: 'alcatel_isam', label: 'Alcatel 7302/7330 ISAM' },
      { value: 'huawei_mea', label: 'Huawei ME60 / BRAS' },
      { value: 'zte_bras', label: 'ZTE BRAS / M6000' },
      { value: 'ericsson_se', label: 'Ericsson SmartEdge / SE1200' },
      { value: 'nokia_ips', label: 'Nokia IPS / 7750 SR' },
      { value: 'riverbed', label: 'Riverbed / SteelHead' },
      { value: 'fiberhome', label: 'FiberHome / AN5000' },
    ],
  },
  {
    heading: 'VPN & Router',
    vendors: [
      { value: 'cisco_vpn', label: 'Cisco VPN 3000 / ASA' },
      { value: 'f5_bigip', label: 'F5 BIG-IP / APM' },
      { value: 'citrix', label: 'Citrix Gateway / NetScaler' },
      { value: 'juniper_ive', label: 'Juniper IVE / SA' },
      { value: 'pulsesecure', label: 'Pulse Secure / Ivanti' },
      { value: 'fortinet_vpn', label: 'Fortinet FortiClient / SSLVPN' },
      { value: 'openvpn', label: 'OpenVPN Access Server' },
      { value: 'wireguard', label: 'WireGuard (Generic)' },
      { value: 'ipsec_generic', label: 'IPSec (Generic)' },
      { value: 'sophos_vpn', label: 'Sophos VPN / RED' },
      { value: 'barracuda_vpn', label: 'Barracuda SSL VPN' },
      { value: 'array', label: 'Array Networks / AG Series' },
      { value: 'avedia', label: 'Avedia / CiscoViptela' },
      { value: 'sslvpn_generic', label: 'SSL VPN (Generic)' },
    ],
  },
  {
    heading: 'RADIUS Server / Proxy',
    vendors: [
      { value: 'freeradius', label: 'FreeRADIUS (Proxy/Realm)' },
      { value: 'microsoft_nps', label: 'Microsoft NPS / IAS' },
      { value: 'cisco_acs', label: 'Cisco ACS / ISE' },
      { value: 'aruba_clearpass', label: 'Aruba ClearPass' },
      { value: 'rsa', label: 'RSA SecurID / AM' },
      { value: 'radiator', label: 'Radiator RADIUS Server' },
      { value: 'openradius', label: 'OpenRADIUS' },
      { value: 'tacacs_generic', label: 'TACACS+ (Generic)' },
      { value: 'dialed_number', label: 'Dialed Number Identification (DNIS)' },
    ],
  },
  {
    heading: 'IoT & M2M',
    vendors: [
      { value: 'sierra_wireless', label: 'Sierra Wireless / AirLink' },
      { value: 'teltonika', label: 'Teltonika RUT' },
      { value: 'moxa', label: 'Moxa / NPort' },
      { value: 'digi', label: 'Digi International' },
      { value: 'lantronix', label: 'Lantronix / SLC' },
      { value: 'inhand', label: 'InHand Networks' },
      { value: 'quectel', label: 'Quectel' },
      { value: 'u_blox', label: 'u-blox' },
      { value: 'simcom', label: 'SIMCom / SIMTech' },
      { value: 'neoway', label: 'Neoway' },
      { value: 'sequans', label: 'Sequans' },
      { value: 'multitech', label: 'Multi-Tech / MultiConnect' },
      { value: 'robustel', label: 'Robustel' },
      { value: 'four_faith', label: 'Four-Faith / F2X' },
    ],
  },
  {
    heading: 'Switch / Network Infrastructure',
    vendors: [
      { value: 'hp_procurve', label: 'HP ProCurve / Aruba' },
      { value: 'dell_force10', label: 'Dell / Force10' },
      { value: '3com', label: '3Com / H3C' },
      { value: 'allied_telematics', label: 'Allied Telesis' },
      { value: 'foundry', label: 'Foundry / Brocade' },
      { value: 'smc', label: 'SMC Networks' },
      { value: 'perle', label: 'Perle / IOLAN' },
      { value: 'opengear', label: 'Opengear' },
      { value: 'ubiquti', label: 'Ubiquiti EdgeSwitch / TOUGHSwitch' },
      { value: 'mikrotik_switch', label: 'MikroTik CRS / SwitchOS' },
      { value: 'hpe_officeconnect', label: 'HPE OfficeConnect' },
      { value: 'cisco_meraki_ms', label: 'Cisco Meraki MS Switch' },
      { value: 'netgear_switch', label: 'Netgear Smart/Managed Switch' },
      { value: 'tplink_switch', label: 'TP-Link JetStream Switch' },
      { value: 'zyxel_switch', label: 'Zyxel Managed Switch' },
      { value: 'mellanox', label: 'Mellanox / NVIDIA' },
      { value: 'arista', label: 'Arista Networks' },
      { value: 'cumulus', label: 'Cumulus Linux' },
    ],
  },
  {
    heading: 'Telecom / Mobile Core',
    vendors: [
      { value: 'ericsson_mme', label: 'Ericsson MME / SGSN' },
      { value: 'huawei_mme', label: 'Huawei MME / UGW' },
      { value: 'zte_mme', label: 'ZTE MME / UGW' },
      { value: 'nokia_mme', label: 'Nokia / NSN MME' },
      { value: 'stm', label: 'Starent / Cisco StarOS' },
      { value: 'broadsoft', label: 'BroadSoft / Cisco' },
      { value: 'genband', label: 'Genband / Ribbon' },
      { value: 'metaswitch', label: 'Metaswitch / Microsoft' },
      { value: 'huawei_ims', label: 'Huawei IMS' },
      { value: 'ale_ims', label: 'Alcatel-Lucent IMS' },
      { value: 'sonus', label: 'Sonus / Ribbon SBC' },
      { value: 'audiocodes', label: 'AudioCodes SBC / Mediant' },
      { value: 'inventel', label: 'Inventel' },
      { value: 'efficientip', label: 'EfficientIP' },
    ],
  },
  {
    heading: 'Industrial & Specialty',
    vendors: [
      { value: 'sangoma', label: 'Sangoma / FreePBX' },
      { value: 'digium', label: 'Digium / Asterisk' },
      { value: 'avaya_cmu', label: 'Avaya CM / Aura' },
      { value: 'cisco_cucm', label: 'Cisco CUCM / CME' },
      { value: 'mitel', label: 'Mitel / MiVoice' },
      { value: 'yealink', label: 'Yealink' },
      { value: 'grandstream_pbx', label: 'Grandstream UCM' },
      { value: 'polycom', label: 'Polycom / HP' },
      { value: 'vodafone', label: 'Vodafone' },
      { value: 'telekom', label: 'Deutsche Telekom' },
      { value: 'orange', label: 'Orange' },
      { value: 'att', label: 'AT&T' },
      { value: 'verizon', label: 'Verizon' },
      { value: 'china_telecom', label: 'China Telecom' },
      { value: 'china_mobile', label: 'China Mobile' },
      { value: 'china_unicom', label: 'China Unicom' },
      { value: 'bsnl', label: 'BSNL (India)' },
      { value: 'jio', label: 'Jio / Reliance' },
      { value: 'airtel', label: 'Airtel / Bharti' },
    ],
  },
  {
    heading: 'Other / Generic',
    vendors: [
      { value: 'other', label: 'Other / Generic RADIUS' },
      { value: 'custom', label: 'Custom / User-Defined Attributes' },
    ],
  },
];

// Flat lookup for form value display
const ALL_NAS_VENDORS = NAS_VENDOR_GROUPS.flatMap(g => g.vendors);

// Auth Methods
const AUTH_METHODS = [
  { value: 'pap', label: 'PAP (Password Authentication Protocol)' },
  { value: 'chap', label: 'CHAP (Challenge Handshake)' },
  { value: 'mschapv2', label: 'MS-CHAPv2 (Microsoft)' },
  { value: 'eap', label: 'EAP (Extensible Authentication)' },
];

// Log Levels
const LOG_LEVELS = [
  { value: 'debug', label: 'Debug (Verbose)' },
  { value: 'info', label: 'Info (Normal)' },
  { value: 'warn', label: 'Warning' },
  { value: 'error', label: 'Error Only' },
];

// Default RADIUS auth port
const RADIUS_AUTH_PORT = 1812;

export default function AAAConfig() {
  const { toast } = useToast();
  const { propertyId } = usePropertyId();
  
  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [activeTab, setActiveTab] = useState('status');
  
  // RADIUS Service Status
  const [serviceStatus, setServiceStatus] = useState<RadiusServiceStatus | null>(null);
  
  // NAS Clients
  const [nasClients, setNasClients] = useState<NASClient[]>([]);
  const [nasDialogOpen, setNasDialogOpen] = useState(false);
  const [editingNas, setEditingNas] = useState<NASClient | null>(null);
  const [deleteNasId, setDeleteNasId] = useState<string | null>(null);
  const [vendorOpen, setVendorOpen] = useState(false);
  const [nasForm, setNasForm] = useState({
    name: '',
    shortname: '',
    ipAddress: '',
    type: 'other',
    secret: '',
    coaEnabled: true,
    coaPort: 3799,
    authPort: 1812,
    acctPort: 1813,
  });
  
  // AAA Config
  const [aaaConfig, setAaaConfig] = useState<AAAConfig>({
    propertyId: propertyId || 'property-1',
    defaultDownloadSpeed: 10,
    defaultUploadSpeed: 10,
    autoProvisionOnCheckin: true,
    autoDeprovisionOnCheckout: true,
    autoDeprovisionDelay: 0,
    authMethod: 'pap',
    allowMacAuth: false,
    accountingSyncInterval: 5,
    maxConcurrentSessions: 3,
    sessionTimeoutPolicy: 'hard',
    portalEnabled: true,
    portalBrandColor: '#0d9488',
    // Credential policy defaults
    usernameFormat: 'room_random',
    usernameCase: 'lowercase',
    usernameMinLength: 4,
    usernameMaxLength: 32,
    passwordFormat: 'random_alphanumeric',
    passwordLength: 8,
    passwordIncludeUppercase: true,
    passwordIncludeNumbers: true,
    passwordIncludeSymbols: false,
    credentialSeparator: '_',
    credentialPrintOnVoucher: true,
    credentialShowInPortal: true,
    duplicateUsernameAction: 'append_random',
    defaultPlanId: undefined,
  });

  // WiFi Plans (for Default Plan dropdown)
  const [wifiPlans, setWifiPlans] = useState<WifiPlan[]>([]);
  
  // Server Config
  const [serverConfig, setServerConfig] = useState<RadiusServerConfig>({
    serverIp: '127.0.0.1',
    authPort: 1812,
    acctPort: 1813,
    coaPort: 3799,
    listenAllInterfaces: true,
    bindAddress: '0.0.0.0',
    logLevel: 'info',
    logDestination: 'files',
  });

  // Fetch initial data
  useEffect(() => {
    fetchData();
  }, []);

  // Fetch active WiFi plans
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const res = await fetch('/api/wifi/plans?status=active');
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setWifiPlans(data.data.filter((p: WifiPlan) => p.status === 'active'));
        }
      } catch (e) {
        console.error('Failed to fetch WiFi plans:', e);
      }
    };
    fetchPlans();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch RADIUS service status
      const statusRes = await fetch('/api/wifi/radius?action=status');
      const statusData = await statusRes.json();
      if (statusData.success) {
        setServiceStatus(statusData.data);
      }

      // Fetch NAS clients
      try {
        const nasRes = await fetch(`/api/wifi/nas?propertyId=${propertyId}`);
        const nasData = await nasRes.json();
        if (nasData.success && nasData.data) {
          setNasClients(nasData.data);
        }
      } catch (e) {
        console.error('Failed to fetch NAS clients:', e);
      }

      // Fetch AAA config
      const aaaRes = await fetch(`/api/wifi/aaa?propertyId=${propertyId}`);
      const aaaData = await aaaRes.json();
      if (aaaData.success) {
        setAaaConfig(prev => ({ ...prev, ...aaaData.data }));
      }

    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch AAA configuration',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // RADIUS Service Control
  const handleServiceAction = async (action: 'start' | 'stop' | 'restart') => {
    try {
      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      
      if (data.success) {
        toast({
          title: 'Success',
          description: `RADIUS service ${action}ed successfully`,
        });
        // Refresh status
        fetchData();
      } else {
        toast({
          title: 'Error',
          description: data.error || `Failed to ${action} service`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to ${action} RADIUS service`,
        variant: 'destructive',
      });
    }
  };

  // Test Connection
  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          username: 'guest101',
          password: 'guest101pass',
          nasIp: serverConfig.serverIp,
          authPort: RADIUS_AUTH_PORT,
        }),
      });
      const data = await res.json();
      
      if (data.success && data.tests?.authentication?.status === 'pass') {
        toast({
          title: 'Connection Test Successful',
          description: `RADIUS server responded with Access-Accept. Latency: ${data.latency}ms`,
        });
      } else if (data.success && data.tests?.connectivity?.status === 'pass') {
        toast({
          title: 'Server Connected',
          description: `RADIUS is running but test user not found. Latency: ${data.latency}ms`,
        });
      } else {
        toast({
          title: 'Connection Test Failed',
          description: data.error || data.tests?.authentication?.message || 'Could not connect to RADIUS server',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to test connection - RADIUS service may not be running',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  // Generate Secret
  const generateSecret = async () => {
    try {
      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-secret' }),
      });
      const data = await res.json();
      
      if (data.success) {
        setNasForm(prev => ({ ...prev, secret: data.data.secret }));
      }
    } catch (error) {
      // Generate locally as fallback using Web Crypto API
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      let secret = '';
      for (let i = 0; i < 32; i++) {
        secret += chars[array[i] % chars.length];
      }
      setNasForm(prev => ({ ...prev, secret }));
    }
  };

  // Save NAS Client
  const handleSaveNas = async () => {
    try {
      const url = editingNas ? '/api/wifi/nas' : '/api/wifi/nas';
      const method = editingNas ? 'PUT' : 'POST';
      
      const body = editingNas
        ? { id: editingNas.id, ...nasForm }
        : { tenantId: 'default', propertyId: propertyId, ...nasForm };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast({
          title: 'Success',
          description: `NAS client ${editingNas ? 'updated' : 'created'} successfully`,
        });
        setNasDialogOpen(false);
        resetNasForm();
        fetchData();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to save NAS client',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save NAS client',
        variant: 'destructive',
      });
    }
  };

  // Delete NAS Client
  const handleDeleteNas = (id: string) => {
    setDeleteNasId(id);
  };

  const confirmDeleteNas = async () => {
    if (!deleteNasId) return;

    try {
      const res = await fetch(`/api/wifi/nas?id=${deleteNasId}`, { method: 'DELETE' });
      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: 'NAS client deleted successfully',
        });
        fetchData();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to delete NAS client',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete NAS client',
        variant: 'destructive',
      });
    } finally {
      setDeleteNasId(null);
    }
  };

  // Save AAA Config
  const handleSaveAaaConfig = async () => {
    setSaving(true);
    try {
      // Only send fields that exist on WiFiAAAConfig model — strip UI-only fields
      const {
        interimUpdateInterval: _i, // belongs on RadiusServerConfig, NOT WiFiAAAConfig
        defaultPlan: _dp, // relation object from GET, not a scalar field
        property: _prop, // relation object from GET
        tenant: _ten, // relation object from GET
        status: _st, // managed by backend
        createdAt: _ca, // managed by backend
        updatedAt: _ua, // managed by backend
        lastSyncAt: _lsa, // managed by backend
        lastSyncId: _lsi, // managed by backend
        id: _id, // managed by backend
        ...saveData
      } = aaaConfig as any;

      const res = await fetch('/api/wifi/aaa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: 'default',
          propertyId: aaaConfig.propertyId || propertyId,
          ...saveData,
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast({
          title: 'Success',
          description: 'AAA configuration saved successfully',
        });
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to save AAA configuration',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save AAA configuration',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Reset NAS Form
  const resetNasForm = () => {
    setNasForm({
      name: '',
      shortname: '',
      ipAddress: '',
      type: 'other',
      secret: '',
      coaEnabled: true,
      coaPort: 3799,
      authPort: 1812,
      acctPort: 1813,
    });
    setEditingNas(null);
  };

  // Open Edit Dialog
  const openEditNas = (nas: NASClient) => {
    setEditingNas(nas);
    setNasForm({
      name: nas.name,
      shortname: nas.shortname,
      ipAddress: nas.ipAddress,
      type: nas.type,
      secret: nas.secret,
      coaEnabled: nas.coaEnabled,
      coaPort: nas.coaPort,
      authPort: nas.authPort,
      acctPort: nas.acctPort,
    });
    setNasDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AAA Configuration</h2>
          <p className="text-muted-foreground">
            Configure RADIUS Authentication, Authorization, and Accounting
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Status Banner */}
      {serviceStatus && (
        <Card className={serviceStatus.running ? 'border-green-500' : 'border-yellow-500'}>
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              {serviceStatus.running ? (
                <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-400" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />
              )}
              <div>
                <p className="font-medium">
                  RADIUS Server {serviceStatus.mode === 'not_installed' ? 'Not Installed' : 'Connected'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {serviceStatus.version || 'Version not available'}
                  {' • '}
                  {serviceStatus.nasClientCount} NAS Clients
                  {' • '}
                  {serviceStatus.userCount} Users
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={serviceStatus.running ? 'default' : 'secondary'}>
                {serviceStatus.running ? 'Running' : 'Stopped'}
              </Badge>
              <Badge variant="outline">{serviceStatus.mode}</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-6 w-full max-w-5xl">
          <TabsTrigger value="status" className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            Status
          </TabsTrigger>
          <TabsTrigger value="nas" className="flex items-center gap-2">
            <Wifi className="h-4 w-4" />
            NAS Clients
          </TabsTrigger>
          <TabsTrigger value="authentication" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Auth
          </TabsTrigger>
          <TabsTrigger value="credentials" className="flex items-center gap-2">
            <UserCog className="h-4 w-4" />
            Credentials
          </TabsTrigger>
          <TabsTrigger value="authorization" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Authorization
          </TabsTrigger>
          <TabsTrigger value="accounting" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Accounting
          </TabsTrigger>
        </TabsList>

        {/* Status Tab */}
        <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Service Control</CardTitle>
              <CardDescription>
                Manage the RADIUS service status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button
                  onClick={() => handleServiceAction('start')}
                  disabled={serviceStatus?.running}
                  className="w-full"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start
                </Button>
                <Button
                  onClick={() => handleServiceAction('stop')}
                  disabled={!serviceStatus?.running}
                  variant="destructive"
                  className="w-full"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
                <Button
                  onClick={() => handleServiceAction('restart')}
                  variant="outline"
                  className="w-full"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Restart
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/wifi/radius', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'sync' }),
                      });
                      const data = await res.json();
                      toast({
                        title: data.success ? 'Sync Complete' : 'Sync Failed',
                        description: data.success 
                          ? `Synced ${data.data?.clients?.count || 0} NAS clients, ${data.data?.users?.count || 0} users to RADIUS server`
                          : data.error || 'Unknown error',
                        variant: data.success ? 'default' : 'destructive',
                      });
                    } catch (e) {
                      toast({ title: 'Error', description: 'Sync failed', variant: 'destructive' });
                    }
                  }}
                  variant="outline"
                  className="w-full"
                >
                  <Activity className="h-4 w-4 mr-2" />
                  Sync DB → RADIUS
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Server Configuration</CardTitle>
              <CardDescription>
                RADIUS server connection settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Server IP</Label>
                  <Input
                    value={serverConfig.serverIp}
                    onChange={(e) => setServerConfig(prev => ({ ...prev, serverIp: e.target.value }))}
                    placeholder="127.0.0.1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Authentication Port</Label>
                  <Input
                    type="number"
                    value={serverConfig.authPort}
                    onChange={(e) => setServerConfig(prev => ({ ...prev, authPort: parseInt(e.target.value) }))}
                    placeholder="1812"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Accounting Port</Label>
                  <Input
                    type="number"
                    value={serverConfig.acctPort}
                    onChange={(e) => setServerConfig(prev => ({ ...prev, acctPort: parseInt(e.target.value) }))}
                    placeholder="1813"
                  />
                </div>
                <div className="space-y-2">
                  <Label>CoA Port</Label>
                  <Input
                    type="number"
                    value={serverConfig.coaPort}
                    onChange={(e) => setServerConfig(prev => ({ ...prev, coaPort: parseInt(e.target.value) }))}
                    placeholder="3799"
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Test connection to RADIUS server</span>
                </div>
                <Button onClick={handleTestConnection} disabled={testing} variant="outline">
                  {testing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <TestTube className="h-4 w-4 mr-2" />
                  )}
                  Test Connection
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* NAS Clients Tab */}
        <TabsContent value="nas" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>NAS Clients</CardTitle>
                <CardDescription>
                  Configure routers and access points that connect to the RADIUS server
                </CardDescription>
              </div>
              <Dialog open={nasDialogOpen} onOpenChange={setNasDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={resetNasForm}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add NAS Client
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>
                      {editingNas ? 'Edit NAS Client' : 'Add NAS Client'}
                    </DialogTitle>
                    <DialogDescription>
                      Configure a router or access point as a RADIUS client
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="grid grid-cols-2 gap-4 py-4">
                    <div className="space-y-2">
                      <Label>Name *</Label>
                      <Input
                        value={nasForm.name}
                        onChange={(e) => setNasForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Main Router"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Short Name *</Label>
                      <Input
                        value={nasForm.shortname}
                        onChange={(e) => setNasForm(prev => ({ ...prev, shortname: e.target.value }))}
                        placeholder="main-router"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>IP Address *</Label>
                      <Input
                        value={nasForm.ipAddress}
                        onChange={(e) => setNasForm(prev => ({ ...prev, ipAddress: e.target.value }))}
                        placeholder="192.168.1.1"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>NAS Vendor Type</Label>
                      <Popover open={vendorOpen} onOpenChange={setVendorOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={vendorOpen}
                            className="w-full justify-between font-normal"
                          >
                            {nasForm.type
                              ? ALL_NAS_VENDORS.find(v => v.value === nasForm.type)?.label ?? nasForm.type
                              : 'Search and select vendor...'}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                          <Command shouldFilter={true}>
                            <CommandInput placeholder="Search vendor (e.g. MikroTik, Cisco, Aruba...)" />
                            <CommandList className="max-h-[400px]">
                              <CommandEmpty>No vendor found. Choose "Other / Generic RADIUS" for custom attributes.</CommandEmpty>
                              {NAS_VENDOR_GROUPS.map((group) => (
                                <CommandGroup key={group.heading} heading={group.heading}>
                                  {group.vendors.map((vendor) => (
                                    <CommandItem
                                      key={vendor.value}
                                      value={vendor.value}
                                      onSelect={() => {
                                        setNasForm(prev => ({ ...prev, type: vendor.value }));
                                        setVendorOpen(false);
                                      }}
                                    >
                                      <Check className={cn(
                                        "mr-2 h-4 w-4",
                                        nasForm.type === vendor.value ? "opacity-100" : "opacity-0"
                                      )} />
                                      {vendor.label}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              ))}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2 col-span-2">
                      <div className="flex items-center justify-between">
                        <Label>Shared Secret *</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={generateSecret}
                        >
                          <Key className="h-3 w-3 mr-1" />
                          Generate
                        </Button>
                      </div>
                      <Input
                        value={nasForm.secret}
                        onChange={(e) => setNasForm(prev => ({ ...prev, secret: e.target.value }))}
                        placeholder="Enter or generate a secret"
                        type="password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Auth Port</Label>
                      <Input
                        type="number"
                        value={nasForm.authPort}
                        onChange={(e) => setNasForm(prev => ({ ...prev, authPort: parseInt(e.target.value) }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Acct Port</Label>
                      <Input
                        type="number"
                        value={nasForm.acctPort}
                        onChange={(e) => setNasForm(prev => ({ ...prev, acctPort: parseInt(e.target.value) }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CoA Port</Label>
                      <Input
                        type="number"
                        value={nasForm.coaPort}
                        onChange={(e) => setNasForm(prev => ({ ...prev, coaPort: parseInt(e.target.value) }))}
                      />
                    </div>
                    <div className="flex items-center space-x-2 col-span-2">
                      <Switch
                        checked={nasForm.coaEnabled}
                        onCheckedChange={(checked) => setNasForm(prev => ({ ...prev, coaEnabled: checked }))}
                      />
                      <Label>Enable CoA (Change of Authorization)</Label>
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setNasDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSaveNas}>
                      {editingNas ? 'Update' : 'Create'} NAS Client
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {nasClients.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Wifi className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No NAS clients configured</p>
                  <p className="text-sm">Add a router or access point to get started</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Auth Port</TableHead>
                      <TableHead>Acct Port</TableHead>
                      <TableHead>CoA</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nasClients.map((nas) => (
                      <TableRow key={nas.id}>
                        <TableCell className="font-medium">{nas.name}</TableCell>
                        <TableCell>{nas.ipAddress}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{nas.type}</Badge>
                        </TableCell>
                        <TableCell>{nas.authPort}</TableCell>
                        <TableCell>{nas.acctPort}</TableCell>
                        <TableCell>
                          {nas.coaEnabled ? (
                            <Badge variant="default">Enabled</Badge>
                          ) : (
                            <Badge variant="secondary">Disabled</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={nas.status === 'active' ? 'default' : 'secondary'}>
                            {nas.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditNas(nas)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteNas(nas.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Authentication Tab */}
        <TabsContent value="authentication" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Authentication Settings</CardTitle>
              <CardDescription>
                Configure how users authenticate to the WiFi network
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Authentication Method</Label>
                <Select
                  value={aaaConfig.authMethod}
                  onValueChange={(value) => setAaaConfig(prev => ({ ...prev, authMethod: value }))}
                >
                  <SelectTrigger className="w-full max-w-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUTH_METHODS.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  PAP is most compatible with captive portals. MS-CHAPv2 provides better security.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Allow MAC Authentication</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow devices to authenticate using their MAC address
                  </p>
                </div>
                <Switch
                  checked={aaaConfig.allowMacAuth}
                  onCheckedChange={(checked) => setAaaConfig(prev => ({ ...prev, allowMacAuth: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-provision on Check-in</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically create WiFi credentials when a guest checks in
                  </p>
                </div>
                <Switch
                  checked={aaaConfig.autoProvisionOnCheckin}
                  onCheckedChange={(checked) => setAaaConfig(prev => ({ ...prev, autoProvisionOnCheckin: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-deprovision on Check-out</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically disable WiFi credentials when a guest checks out
                  </p>
                </div>
                <Switch
                  checked={aaaConfig.autoDeprovisionOnCheckout}
                  onCheckedChange={(checked) => setAaaConfig(prev => ({ ...prev, autoDeprovisionOnCheckout: checked }))}
                />
              </div>

              {aaaConfig.autoDeprovisionOnCheckout && (
                <div className="space-y-2">
                  <Label>Deprovision Delay (minutes)</Label>
                  <Input
                    type="number"
                    value={aaaConfig.autoDeprovisionDelay}
                    onChange={(e) => setAaaConfig(prev => ({ ...prev, autoDeprovisionDelay: parseInt(e.target.value) || 0 }))}
                    className="w-32"
                  />
                  <p className="text-sm text-muted-foreground">
                    Delay before disabling credentials after check-out (0 = immediate)
                  </p>
                </div>
              )}

              {/* Default WiFi Plan */}
              <div className="space-y-2">
                <Label>Default WiFi Plan</Label>
                <Select
                  value={aaaConfig.defaultPlanId || '__none__'}
                  onValueChange={(value) =>
                    setAaaConfig(prev => ({
                      ...prev,
                      defaultPlanId: value === '__none__' ? undefined : value,
                    }))
                  }
                >
                  <SelectTrigger className="w-full max-w-md">
                    <SelectValue placeholder="Select a plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      None (Use default bandwidth)
                    </SelectItem>
                    {wifiPlans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} ({plan.downloadSpeed}M/{plan.uploadSpeed}M)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Plan assigned to guests on check-in (if no room-type specific plan is set)
                </p>

                {aaaConfig.defaultPlanId && (() => {
                  const selectedPlan = wifiPlans.find(p => p.id === aaaConfig.defaultPlanId);
                  if (!selectedPlan) return null;
                  return (
                    <div className="flex items-center gap-2 mt-2 p-2 rounded-md bg-muted/50 border text-sm">
                      <Info className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="font-mono">
                          {selectedPlan.downloadSpeed}M/{selectedPlan.uploadSpeed}M
                        </Badge>
                        {selectedPlan.validity != null && selectedPlan.validity > 0 && (
                          <Badge variant="outline">
                            {selectedPlan.validity}h validity
                          </Badge>
                        )}
                        {selectedPlan.dataLimit != null && selectedPlan.dataLimit > 0 && (
                          <Badge variant="outline">
                            {selectedPlan.dataLimit >= 1024
                              ? `${(selectedPlan.dataLimit / 1024).toFixed(1)} GB`
                              : `${selectedPlan.dataLimit} MB`}{' '}
                            data limit
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="pt-4 border-t">
                <Button onClick={handleSaveAaaConfig} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Settings className="h-4 w-4 mr-2" />
                  )}
                  Save Authentication Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Credentials Tab */}
        <TabsContent value="credentials" className="space-y-4">
          <CredentialPolicyTab
            config={aaaConfig as unknown as CredentialConfig}
            onChange={(credConfig) => setAaaConfig(prev => ({ ...prev, ...credConfig }))}
            saving={saving}
            onSave={handleSaveAaaConfig}
          />
        </TabsContent>

        {/* Authorization Tab */}
        <TabsContent value="authorization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Authorization Policies</CardTitle>
              <CardDescription>
                Configure bandwidth limits and session policies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Default Download Speed (Mbps)</Label>
                  <Input
                    type="number"
                    value={aaaConfig.defaultDownloadSpeed}
                    onChange={(e) => setAaaConfig(prev => ({ ...prev, defaultDownloadSpeed: parseInt(e.target.value) || 10 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default Upload Speed (Mbps)</Label>
                  <Input
                    type="number"
                    value={aaaConfig.defaultUploadSpeed}
                    onChange={(e) => setAaaConfig(prev => ({ ...prev, defaultUploadSpeed: parseInt(e.target.value) || 10 }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Default Session Limit (minutes)</Label>
                  <Input
                    type="number"
                    value={aaaConfig.defaultSessionLimit || ''}
                    onChange={(e) => setAaaConfig(prev => ({ ...prev, defaultSessionLimit: parseInt(e.target.value) || null as unknown as undefined }))}
                    placeholder="Leave empty for no limit"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default Data Limit (MB)</Label>
                  <Input
                    type="number"
                    value={aaaConfig.defaultDataLimit || ''}
                    onChange={(e) => setAaaConfig(prev => ({ ...prev, defaultDataLimit: parseInt(e.target.value) || null as unknown as undefined }))}
                    placeholder="Leave empty for no limit"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Max Concurrent Sessions per User</Label>
                <Input
                  type="number"
                  value={aaaConfig.maxConcurrentSessions}
                  onChange={(e) => setAaaConfig(prev => ({ ...prev, maxConcurrentSessions: parseInt(e.target.value) || 1 }))}
                  className="w-32"
                />
                <p className="text-sm text-muted-foreground">
                  Number of devices a user can have connected simultaneously
                </p>
              </div>

              <div className="space-y-2">
                <Label>Session Timeout Policy</Label>
                <Select
                  value={aaaConfig.sessionTimeoutPolicy}
                  onValueChange={(value) => setAaaConfig(prev => ({ ...prev, sessionTimeoutPolicy: value }))}
                >
                  <SelectTrigger className="w-full max-w-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hard">
                      Hard Limit - Disconnect immediately when limit reached
                    </SelectItem>
                    <SelectItem value="soft">
                      Soft Limit - Warn user, allow to continue
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-4 border-t">
                <Button onClick={handleSaveAaaConfig} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Settings className="h-4 w-4 mr-2" />
                  )}
                  Save Authorization Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Accounting Tab */}
        <TabsContent value="accounting" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Accounting Settings</CardTitle>
              <CardDescription>
                Configure how user sessions and data usage are tracked
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Accounting Sync Interval (minutes)</Label>
                <Input
                  type="number"
                  value={aaaConfig.accountingSyncInterval}
                  onChange={(e) => setAaaConfig(prev => ({ ...prev, accountingSyncInterval: parseInt(e.target.value) || 5 }))}
                  className="w-32"
                />
                <p className="text-sm text-muted-foreground">
                  How often session data is synced from the RADIUS server
                </p>
              </div>

              <div className="space-y-2">
                <Label>Interim-Update Interval (seconds)</Label>
                <Input
                  type="number"
                  value={aaaConfig.interimUpdateInterval}
                  onChange={(e) => setAaaConfig(prev => ({ ...prev, interimUpdateInterval: parseInt(e.target.value) || 300 }))}
                  className="w-32"
                />
                <p className="text-sm text-muted-foreground">
                  How often the NAS sends accounting updates. Sent as Acct-Interim-Interval to the NAS device.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Captive Portal</Label>
                  <p className="text-sm text-muted-foreground">
                    Show a login/registration page before granting internet access
                  </p>
                </div>
                <Switch
                  checked={aaaConfig.portalEnabled}
                  onCheckedChange={(checked) => setAaaConfig(prev => ({ ...prev, portalEnabled: checked }))}
                />
              </div>

              {aaaConfig.portalEnabled && (
                <>
                  <div className="space-y-2">
                    <Label>Portal Title</Label>
                    <Input
                      value={aaaConfig.portalTitle || ''}
                      onChange={(e) => setAaaConfig(prev => ({ ...prev, portalTitle: e.target.value }))}
                      placeholder="Welcome to Our Hotel"
                      className="max-w-md"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Redirect URL (after login)</Label>
                    <Input
                      value={aaaConfig.portalRedirectUrl || ''}
                      onChange={(e) => setAaaConfig(prev => ({ ...prev, portalRedirectUrl: e.target.value }))}
                      placeholder="https://www.example.com"
                      className="max-w-md"
                    />
                    <p className="text-sm text-muted-foreground">
                      Leave empty to redirect to the default hotel page
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Portal Brand Color</Label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={aaaConfig.portalBrandColor}
                        onChange={(e) => setAaaConfig(prev => ({ ...prev, portalBrandColor: e.target.value }))}
                        className="w-10 h-10 rounded cursor-pointer border border-border"
                      />
                      <Input
                        value={aaaConfig.portalBrandColor}
                        onChange={(e) => setAaaConfig(prev => ({ ...prev, portalBrandColor: e.target.value }))}
                        className="w-32"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="pt-4 border-t">
                <Button onClick={handleSaveAaaConfig} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Settings className="h-4 w-4 mr-2" />
                  )}
                  Save Accounting Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Delete NAS Confirmation Dialog */}
      <AlertDialog open={!!deleteNasId} onOpenChange={(open) => !open && setDeleteNasId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete NAS Client</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this NAS client? This will remove it from the RADIUS server configuration.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteNas} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


    </div>
  );
}
