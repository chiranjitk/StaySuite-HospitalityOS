'use client';

/**
 * AAA Configuration Component
 * 
 * Comprehensive FreeRADIUS AAA (Authentication, Authorization, Accounting) configuration
 * with connection to backend FreeRADIUS service.
 * 
 * Features:
 * - Server Status & Control
 * - Authentication Settings
 * - Authorization Policies
 * - Accounting Configuration
 * - NAS Client Management
 * - Captive Portal Settings
 * - Connection Testing
 */

import { useState, useEffect } from 'react';
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
  CheckCircle,
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
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Types
interface FreeRADIUSStatus {
  installed: boolean;
  running: boolean;
  version?: string;
  mode: 'production' | 'demo';
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

// NAS Device Types
const NAS_TYPES = [
  { value: 'mikrotik', label: 'MikroTik RouterOS' },
  { value: 'cisco', label: 'Cisco' },
  { value: 'aruba', label: 'Aruba Networks' },
  { value: 'tplink', label: 'TP-Link Omada' },
  { value: 'unifi', label: 'Ubiquiti UniFi' },
  { value: 'ruckus', label: 'Ruckus Networks' },
  { value: 'ruijie', label: 'Ruijie Networks' },
  { value: 'huawei', label: 'Huawei' },
  { value: 'juniper', label: 'Juniper Mist' },
  { value: 'fortinet', label: 'Fortinet' },
  { value: 'other', label: 'Other/Generic' },
];

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

// RADIUS auth port (FreeRADIUS runs on non-privileged port 18120)
const RADIUS_AUTH_PORT = 18120;

export default function AAAConfig() {
  const { toast } = useToast();
  
  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [activeTab, setActiveTab] = useState('status');
  
  // FreeRADIUS Status
  const [freeradiusStatus, setFreeradiusStatus] = useState<FreeRADIUSStatus | null>(null);
  
  // NAS Clients
  const [nasClients, setNasClients] = useState<NASClient[]>([]);
  const [nasDialogOpen, setNasDialogOpen] = useState(false);
  const [editingNas, setEditingNas] = useState<NASClient | null>(null);
  const [deleteNasId, setDeleteNasId] = useState<string | null>(null);
  const [nasForm, setNasForm] = useState({
    name: '',
    shortname: '',
    ipAddress: '',
    type: 'other',
    secret: '',
    coaEnabled: true,
    coaPort: 3799,
    authPort: 18120,
    acctPort: 18130,
  });
  
  // AAA Config
  const [aaaConfig, setAaaConfig] = useState<AAAConfig>({
    propertyId: 'property-2',
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
  });
  
  // Server Config
  const [serverConfig, setServerConfig] = useState<RadiusServerConfig>({
    serverIp: '127.0.0.1',
    authPort: 18120,
    acctPort: 18130,
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

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch FreeRADIUS status
      const statusRes = await fetch('/api/wifi/freeradius?action=status');
      const statusData = await statusRes.json();
      if (statusData.success) {
        setFreeradiusStatus(statusData.data);
      }

      // Fetch NAS clients - try from FreeRADIUS service first, then database
      try {
        const nasRes = await fetch('/api/wifi/nas?propertyId=property-2');
        const nasData = await nasRes.json();
        if (nasData.success && nasData.data) {
          setNasClients(nasData.data);
        }
      } catch (e) {
        console.error('Failed to fetch NAS clients:', e);
      }

      // Fetch AAA config
      const aaaRes = await fetch('/api/wifi/aaa?propertyId=property-2');
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

  // FreeRADIUS Service Control
  const handleServiceAction = async (action: 'start' | 'stop' | 'restart') => {
    try {
      const res = await fetch('/api/wifi/freeradius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      
      if (data.success) {
        toast({
          title: 'Success',
          description: `FreeRADIUS service ${action}ed successfully`,
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
        description: `Failed to ${action} FreeRADIUS service`,
        variant: 'destructive',
      });
    }
  };

  // Test Connection - uses real RADIUS authentication test
  const handleTestConnection = async () => {
    setTesting(true);
    try {
      // Use a test user to verify RADIUS is working
      const res = await fetch('/api/wifi/freeradius', {
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
          description: `FreeRADIUS is running but test user not found. Latency: ${data.latency}ms`,
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
        description: 'Failed to test connection - FreeRADIUS service may not be running',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  // Generate Secret
  const generateSecret = async () => {
    try {
      const res = await fetch('/api/wifi/freeradius', {
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
        : { tenantId: 'default', propertyId: 'property-2', ...nasForm };

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
      const res = await fetch('/api/wifi/aaa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: 'default',
          propertyId: aaaConfig.propertyId || 'property-2',
          ...aaaConfig,
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
      authPort: 18120,
      acctPort: 18130,
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
            Configure FreeRADIUS Authentication, Authorization, and Accounting
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Status Banner */}
      {freeradiusStatus && (
        <Card className={freeradiusStatus.running ? 'border-green-500' : 'border-yellow-500'}>
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              {freeradiusStatus.running ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              )}
              <div>
                <p className="font-medium">
                  FreeRADIUS {freeradiusStatus.mode === 'demo' ? 'Demo Mode' : 'Connected'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {freeradiusStatus.version || 'Version not available'}
                  {' • '}
                  {freeradiusStatus.nasClientCount} NAS Clients
                  {' • '}
                  {freeradiusStatus.userCount} Users
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={freeradiusStatus.running ? 'default' : 'secondary'}>
                {freeradiusStatus.running ? 'Running' : 'Stopped'}
              </Badge>
              <Badge variant="outline">{freeradiusStatus.mode}</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full max-w-3xl">
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
                Manage the FreeRADIUS service status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button
                  onClick={() => handleServiceAction('start')}
                  disabled={freeradiusStatus?.running}
                  className="w-full"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start
                </Button>
                <Button
                  onClick={() => handleServiceAction('stop')}
                  disabled={!freeradiusStatus?.running}
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
                      const res = await fetch('/api/wifi/freeradius', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'sync' }),
                      });
                      const data = await res.json();
                      toast({
                        title: data.success ? 'Sync Complete' : 'Sync Failed',
                        description: data.success 
                          ? `Synced ${data.data?.clients?.count || 0} NAS clients, ${data.data?.users?.count || 0} users to FreeRADIUS`
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
                  Configure routers and access points that connect to FreeRADIUS
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
                      <Label>Type</Label>
                      <Select
                        value={nasForm.type}
                        onValueChange={(value) => setNasForm(prev => ({ ...prev, type: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {NAS_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
              <CardTitle>Accounting Configuration</CardTitle>
              <CardDescription>
                Configure session tracking and usage accounting
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
                  How often to sync accounting data from FreeRADIUS
                </p>
              </div>

              <div className="space-y-2">
                <Label>Log Level</Label>
                <Select
                  value={serverConfig.logLevel}
                  onValueChange={(value) => setServerConfig(prev => ({ ...prev, logLevel: value }))}
                >
                  <SelectTrigger className="w-full max-w-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOG_LEVELS.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Log Destination</Label>
                <Select
                  value={serverConfig.logDestination}
                  onValueChange={(value) => setServerConfig(prev => ({ ...prev, logDestination: value }))}
                >
                  <SelectTrigger className="w-full max-w-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="files">Files</SelectItem>
                    <SelectItem value="syslog">Syslog</SelectItem>
                    <SelectItem value="stdout">Stdout</SelectItem>
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
                  Save Accounting Settings
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* RADIUS Groups Card */}
          <Card>
            <CardHeader>
              <CardTitle>RADIUS Groups</CardTitle>
              <CardDescription>
                Predefined user groups for different access levels
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium">Premium Guests</h4>
                  <p className="text-sm text-muted-foreground">50 Mbps Down / 25 Mbps Up</p>
                  <Badge className="mt-2">premium-guests</Badge>
                </div>
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium">Standard Guests</h4>
                  <p className="text-sm text-muted-foreground">10 Mbps Down / 5 Mbps Up</p>
                  <Badge className="mt-2">standard-guests</Badge>
                </div>
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium">Basic Guests</h4>
                  <p className="text-sm text-muted-foreground">2 Mbps Down / 1 Mbps Up</p>
                  <Badge className="mt-2">basic-guests</Badge>
                </div>
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium">Staff</h4>
                  <p className="text-sm text-muted-foreground">100 Mbps Down / 50 Mbps Up</p>
                  <Badge className="mt-2">staff</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteNasId} onOpenChange={(open) => !open && setDeleteNasId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete NAS Client</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this NAS client? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteNas} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
