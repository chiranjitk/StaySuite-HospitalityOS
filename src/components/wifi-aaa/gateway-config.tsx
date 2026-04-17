'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Router,
  Plus,
  Search,
  Power,
  Settings,
  RefreshCw,
  Check,
  X,
  AlertTriangle,
  Wifi,
  Server,
  Globe,
} from 'lucide-react';
import { toast } from 'sonner';

// Supported gateway vendors
const GATEWAY_VENDORS = [
  // Tier 1
  { value: 'mikrotik', label: 'MikroTik', tier: 1 },
  { value: 'unifi', label: 'Ubiquiti UniFi', tier: 1 },
  { value: 'cisco', label: 'Cisco', tier: 1 },
  { value: 'aruba', label: 'Aruba Networks', tier: 1 },
  // Tier 2
  { value: 'tplink', label: 'TP-Link Omada', tier: 2 },
  { value: 'ruijie', label: 'Ruijie Networks', tier: 2 },
  { value: 'cambium', label: 'Cambium Networks', tier: 2 },
  { value: 'grandstream', label: 'Grandstream', tier: 2 },
  // Tier 3
  { value: 'ruckus', label: 'Ruckus Networks', tier: 3 },
  { value: 'juniper', label: 'Juniper Mist', tier: 3 },
  { value: 'fortinet', label: 'Fortinet', tier: 3 },
  // Generic
  { value: 'generic', label: 'Generic RADIUS', tier: 0 },
];

interface Gateway {
  id: string;
  name: string;
  vendor: string;
  ipAddress: string;
  status: string;
  radiusSecret: string;
  radiusAuthPort: number;
  radiusAcctPort: number;
  coaEnabled: boolean;
  totalClients: number;
  lastSeenAt: string | null;
}

export function WiFiGatewayConfig() {
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);

  // Load gateways from API on mount
  useEffect(() => {
    async function loadGateways() {
      try {
        setLoading(true);
        const response = await fetch('/api/integrations/wifi-gateways');
        const result = await response.json();
        if (result.success && result.data?.gateways) {
          const mapped: Gateway[] = result.data.gateways.map((g: Record<string, unknown>) => ({
            id: g.id as string,
            name: (g.name || g.type || 'Gateway') as string,
            vendor: (g.type || 'generic') as string,
            ipAddress: (g.ipAddress || '') as string,
            status: (g.status === 'connected' ? 'active' : g.status === 'error' ? 'inactive' : 'inactive') as string,
            radiusSecret: '********',
            radiusAuthPort: (g.port || 1812) as number,
            radiusAcctPort: 1813,
            coaEnabled: false,
            totalClients: (g.activeSessions || 0) as number,
            lastSeenAt: (g.lastSync || null) as string | null,
          }));
          setGateways(mapped);
        }
      } catch (error) {
        console.error('Error loading gateways:', error);
      } finally {
        setLoading(false);
      }
    }
    loadGateways();
  }, []);

  const [formData, setFormData] = useState({
    name: '',
    vendor: 'mikrotik',
    ipAddress: '',
    radiusSecret: '',
    radiusAuthPort: 1812,
    radiusAcctPort: 1813,
    coaEnabled: false,
    coaPort: 3799,
    coaSecret: '',
  });

  const testConnection = async (gatewayId: string) => {
    setTestingConnection(gatewayId);
    
    try {
      const response = await fetch(`/api/integrations/wifi-gateways?action=test-connection&id=${gatewayId}`);
      const result = await response.json();
      if (result.success && result.data?.connected) {
        toast.success(result.data.message || 'Connection successful');
      } else {
        toast.error(result.data?.message || 'Connection failed');
      }
    } catch {
      toast.error('Connection test failed');
    }
    
    setTestingConnection(null);
  };

  const handleAddGateway = async () => {
    if (!formData.name || !formData.ipAddress || !formData.radiusSecret) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const response = await fetch('/api/integrations/wifi-gateways', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          type: formData.vendor,
          ipAddress: formData.ipAddress,
          port: formData.radiusAuthPort,
          apiKey: formData.radiusSecret,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(result.message || 'Gateway added successfully');
        setShowAddDialog(false);
        // Reload gateways from API
        const listResponse = await fetch('/api/integrations/wifi-gateways');
        const listResult = await listResponse.json();
        if (listResult.success && listResult.data?.gateways) {
          const mapped: Gateway[] = listResult.data.gateways.map((g: Record<string, unknown>) => ({
            id: g.id as string,
            name: (g.name || g.type || 'Gateway') as string,
            vendor: (g.type || 'generic') as string,
            ipAddress: (g.ipAddress || '') as string,
            status: (g.status === 'connected' ? 'active' : g.status === 'error' ? 'inactive' : 'inactive') as string,
            radiusSecret: '********',
            radiusAuthPort: (g.port || 1812) as number,
            radiusAcctPort: 1813,
            coaEnabled: false,
            totalClients: (g.activeSessions || 0) as number,
            lastSeenAt: (g.lastSync || null) as string | null,
          }));
          setGateways(mapped);
        }
      } else {
        toast.error(result.error?.message || 'Failed to add gateway');
      }
    } catch {
      toast.error('Failed to add gateway');
    }

    // Reset form
    setFormData({
      name: '',
      vendor: 'mikrotik',
      ipAddress: '',
      radiusSecret: '',
      radiusAuthPort: 1812,
      radiusAcctPort: 1813,
      coaEnabled: false,
      coaPort: 3799,
      coaSecret: '',
    });
  };

  const getVendorLabel = (vendor: string) => {
    return GATEWAY_VENDORS.find(v => v.value === vendor)?.label || vendor;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-600">Online</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Offline</Badge>;
      case 'maintenance':
        return <Badge variant="outline" className="border-amber-500 text-amber-500">Maintenance</Badge>;
      default:
        return <Badge variant="destructive">Error</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gateway Configuration</h2>
          <p className="text-muted-foreground">
            Configure WiFi gateways and access points
          </p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Gateway
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Gateway</DialogTitle>
              <DialogDescription>
                Configure a new WiFi gateway or access point
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  All gateways must support standard RADIUS authentication and accounting.
                </AlertDescription>
              </Alert>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Gateway Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Main Router"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vendor">Vendor *</Label>
                  <Select
                    value={formData.vendor}
                    onValueChange={(value) => setFormData({ ...formData, vendor: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="" disabled>Tier 1 (Priority)</SelectItem>
                      {GATEWAY_VENDORS.filter(v => v.tier === 1).map(v => (
                        <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                      ))}
                      <SelectItem value="" disabled>Tier 2 (SMB / India Focus)</SelectItem>
                      {GATEWAY_VENDORS.filter(v => v.tier === 2).map(v => (
                        <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                      ))}
                      <SelectItem value="" disabled>Tier 3 (Enterprise)</SelectItem>
                      {GATEWAY_VENDORS.filter(v => v.tier === 3).map(v => (
                        <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                      ))}
                      <SelectItem value="" disabled>Other</SelectItem>
                      {GATEWAY_VENDORS.filter(v => v.tier === 0).map(v => (
                        <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ipAddress">IP Address *</Label>
                  <Input
                    id="ipAddress"
                    placeholder="192.168.1.1"
                    value={formData.ipAddress}
                    onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="radiusSecret">RADIUS Secret *</Label>
                  <Input
                    id="radiusSecret"
                    type="password"
                    placeholder="Shared secret"
                    value={formData.radiusSecret}
                    onChange={(e) => setFormData({ ...formData, radiusSecret: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="authPort">Auth Port</Label>
                  <Input
                    id="authPort"
                    type="number"
                    value={formData.radiusAuthPort}
                    onChange={(e) => setFormData({ ...formData, radiusAuthPort: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="acctPort">Accounting Port</Label>
                  <Input
                    id="acctPort"
                    type="number"
                    value={formData.radiusAcctPort}
                    onChange={(e) => setFormData({ ...formData, radiusAcctPort: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="space-y-0.5">
                  <Label>Enable CoA</Label>
                  <p className="text-sm text-muted-foreground">
                    Change of Authorization for session management
                  </p>
                </div>
                <Switch
                  checked={formData.coaEnabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, coaEnabled: checked })}
                />
              </div>

              {formData.coaEnabled && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="coaPort">CoA Port</Label>
                    <Input
                      id="coaPort"
                      type="number"
                      value={formData.coaPort}
                      onChange={(e) => setFormData({ ...formData, coaPort: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="coaSecret">CoA Secret (optional)</Label>
                    <Input
                      id="coaSecret"
                      type="password"
                      placeholder="Defaults to RADIUS secret"
                      value={formData.coaSecret}
                      onChange={(e) => setFormData({ ...formData, coaSecret: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddGateway}>
                <Router className="h-4 w-4 mr-2" />
                Add Gateway
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Architecture Info */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <Server className="h-8 w-8 text-primary" />
            <div>
              <h3 className="font-semibold">Architecture</h3>
              <p className="text-sm text-muted-foreground mt-1">
                PMS (NestJS) → PostgreSQL (Shared DB) → FreeRADIUS → Gateway (MikroTik / UniFi)
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                <strong>Communication Model:</strong> No REST API required. PMS writes to DB, FreeRADIUS reads from DB.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gateways Table */}
      <Card>
        <CardHeader>
          <CardTitle>Configured Gateways</CardTitle>
          <CardDescription>
            All gateways must support RADIUS authentication and accounting
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Auth Port</TableHead>
                <TableHead>CoA</TableHead>
                <TableHead>Clients</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : gateways.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    No gateways configured
                  </TableCell>
                </TableRow>
              ) : (
                gateways.map((gateway) => (
                  <TableRow key={gateway.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Router className="h-4 w-4 text-muted-foreground" />
                        {gateway.name}
                      </div>
                    </TableCell>
                    <TableCell>{getVendorLabel(gateway.vendor)}</TableCell>
                    <TableCell>
                      <span className="font-mono">{gateway.ipAddress}</span>
                    </TableCell>
                    <TableCell>{getStatusBadge(gateway.status)}</TableCell>
                    <TableCell>{gateway.radiusAuthPort}</TableCell>
                    <TableCell>
                      {gateway.coaEnabled ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell>{gateway.totalClients}</TableCell>
                    <TableCell>
                      {gateway.lastSeenAt 
                        ? new Date(gateway.lastSeenAt).toLocaleString()
                        : 'Never'
                      }
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => testConnection(gateway.id)}
                          disabled={testingConnection === gateway.id}
                        >
                          {testingConnection === gateway.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Globe className="h-4 w-4" />
                          )}
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Vendor Support Info */}
      <Card>
        <CardHeader>
          <CardTitle>Supported Vendors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h4 className="font-semibold text-sm mb-2">Tier 1 (Priority)</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                {GATEWAY_VENDORS.filter(v => v.tier === 1).map(v => (
                  <li key={v.value}>• {v.label}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-2">Tier 2 (SMB / India Focus)</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                {GATEWAY_VENDORS.filter(v => v.tier === 2).map(v => (
                  <li key={v.value}>• {v.label}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-2">Tier 3 (Enterprise)</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                {GATEWAY_VENDORS.filter(v => v.tier === 3).map(v => (
                  <li key={v.value}>• {v.label}</li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
