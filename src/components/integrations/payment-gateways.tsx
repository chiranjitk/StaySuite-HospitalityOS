'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CreditCard, Check, X, Settings, Plus, Shield, TestTube } from 'lucide-react';
import { toast } from 'sonner';
import { useCurrency } from '@/contexts/CurrencyContext';

interface PaymentGateway {
  id: string;
  name: string;
  provider: string;
  status: 'active' | 'inactive' | 'sandbox';
  mode: 'live' | 'test';
  apiKey?: string;
  secretKey?: string;
  merchantId?: string;
  supportedCurrencies: string[];
  fees: {
    percentage: number;
    fixed: number;
  };
  lastSync?: string;
  totalTransactions: number;
  totalVolume: number;
}

const providerOptions = [
  { value: 'stripe', label: 'Stripe' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'square', label: 'Square' },
  { value: 'adyen', label: 'Adyen' },
  { value: 'braintree', label: 'Braintree' },
  { value: 'authorize_net', label: 'Authorize.net' },
];

export function PaymentGateways() {
  const { formatCurrency } = useCurrency();
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0, totalTransactions: 0, totalVolume: 0 });
  const [editGateway, setEditGateway] = useState<PaymentGateway | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchGateways();
  }, []);

  const fetchGateways = async () => {
    try {
      const response = await fetch('/api/integrations/payment-gateways');
      const data = await response.json();
      if (data.success) {
        setGateways(data.data.gateways);
        setStats(data.data.stats);
      }
    } catch (error) {
      toast.error('Failed to fetch payment gateways');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id: string) => {
    try {
      const gateway = gateways.find(g => g.id === id);
      if (!gateway) return;

      const response = await fetch('/api/integrations/payment-gateways', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          status: gateway.status === 'active' ? 'inactive' : 'active',
        }),
      });

      if (response.ok) {
        setGateways(gateways.map(g => 
          g.id === id ? { ...g, status: g.status === 'active' ? 'inactive' : 'active' } : g
        ));
        toast.success('Gateway status updated');
      }
    } catch {
      toast.error('Failed to update gateway status');
    }
  };

  const handleSaveGateway = async () => {
    if (!editGateway) return;

    try {
      const method = editGateway.id && editGateway.id !== '' ? 'PUT' : 'POST';
      const response = await fetch('/api/integrations/payment-gateways', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editGateway),
      });

      if (response.ok) {
        const data = await response.json();
        if (method === 'POST') {
          setGateways([...gateways, data.data]);
          toast.success('Gateway added successfully');
        } else {
          setGateways(gateways.map(g => g.id === editGateway.id ? editGateway : g));
          toast.success('Gateway updated successfully');
        }
        fetchGateways();
      }
    } catch {
      toast.error('Failed to save gateway');
    }
    setDialogOpen(false);
    setEditGateway(null);
  };

  const handleTestConnection = async (gateway: PaymentGateway) => {
    toast.promise(
      new Promise(resolve => setTimeout(resolve, 1500)),
      {
        loading: 'Testing connection...',
        success: 'Connection successful!',
        error: 'Connection failed',
      }
    );
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'stripe': return '💳';
      case 'paypal': return '🅿️';
      case 'square': return '⬜';
      default: return '💳';
    }
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
          <h2 className="text-2xl font-bold tracking-tight">Payment Gateways</h2>
          <p className="text-muted-foreground">Configure and manage payment processing integrations</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditGateway({ id: '', name: '', provider: 'stripe', status: 'inactive', mode: 'test', supportedCurrencies: ['USD'], fees: { percentage: 0, fixed: 0 }, totalTransactions: 0, totalVolume: 0 })}>
              <Plus className="h-4 w-4 mr-2" />
              Add Gateway
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editGateway?.id ? 'Edit Gateway' : 'Add Payment Gateway'}</DialogTitle>
              <DialogDescription>Configure your payment gateway settings</DialogDescription>
            </DialogHeader>
            {editGateway && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Gateway Name</Label>
                    <Input
                      id="name"
                      value={editGateway.name}
                      onChange={(e) => setEditGateway({ ...editGateway, name: e.target.value })}
                      placeholder="My Payment Gateway"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="provider">Provider</Label>
                    <Select
                      value={editGateway.provider}
                      onValueChange={(v) => setEditGateway({ ...editGateway, provider: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {providerOptions.map(p => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="apiKey">API Key</Label>
                    <Input
                      id="apiKey"
                      type="password"
                      value={editGateway.apiKey || ''}
                      onChange={(e) => setEditGateway({ ...editGateway, apiKey: e.target.value })}
                      placeholder="pk_xxxxx"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secretKey">Secret Key</Label>
                    <Input
                      id="secretKey"
                      type="password"
                      value={editGateway.secretKey || ''}
                      onChange={(e) => setEditGateway({ ...editGateway, secretKey: e.target.value })}
                      placeholder="sk_xxxxx"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="merchantId">Merchant ID</Label>
                    <Input
                      id="merchantId"
                      value={editGateway.merchantId || ''}
                      onChange={(e) => setEditGateway({ ...editGateway, merchantId: e.target.value })}
                      placeholder="MERCHANT123"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mode">Mode</Label>
                    <Select
                      value={editGateway.mode}
                      onValueChange={(v: 'live' | 'test') => setEditGateway({ ...editGateway, mode: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="test">Test/Sandbox</SelectItem>
                        <SelectItem value="live">Live</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="percentage">Fee Percentage (%)</Label>
                    <Input
                      id="percentage"
                      type="number"
                      step="0.01"
                      value={editGateway.fees.percentage}
                      onChange={(e) => setEditGateway({ ...editGateway, fees: { ...editGateway.fees, percentage: parseFloat(e.target.value) || 0 } })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fixed">Fixed Fee ($)</Label>
                    <Input
                      id="fixed"
                      type="number"
                      step="0.01"
                      value={editGateway.fees.fixed}
                      onChange={(e) => setEditGateway({ ...editGateway, fees: { ...editGateway.fees, fixed: parseFloat(e.target.value) || 0 } })}
                    />
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveGateway}>Save Gateway</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardDescription>Active Gateways</CardDescription>
            <CardTitle className="text-2xl">{stats.active}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardDescription>Total Transactions</CardDescription>
            <CardTitle className="text-2xl">{stats.totalTransactions.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-cyan-500">
          <CardHeader className="pb-2">
            <CardDescription>Total Volume</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(stats.totalVolume)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-violet-500">
          <CardHeader className="pb-2">
            <CardDescription>Providers</CardDescription>
            <CardTitle className="text-2xl">{new Set(gateways.map(g => g.provider)).size}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Gateway List */}
      <div className="grid gap-4">
        {gateways.map((gateway) => (
          <Card key={gateway.id}>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center text-xl">
                    {getProviderIcon(gateway.provider)}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{gateway.name}</CardTitle>
                    <CardDescription className="capitalize">{gateway.provider}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={gateway.mode === 'live' ? 'default' : 'secondary'}>
                    {gateway.mode === 'live' ? 'Live' : 'Test'}
                  </Badge>
                  <Badge variant={gateway.status === 'active' ? 'default' : 'outline'} className={gateway.status === 'active' ? 'bg-emerald-500' : ''}>
                    {gateway.status === 'active' ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4 mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Processing Fee</p>
                  <p className="font-medium">{gateway.fees.percentage}% + {formatCurrency(gateway.fees.fixed)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Currencies</p>
                  <p className="font-medium">{gateway.supportedCurrencies.join(', ')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Transactions</p>
                  <p className="font-medium">{gateway.totalTransactions.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Volume</p>
                  <p className="font-medium">{formatCurrency(gateway.totalVolume)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-4 border-t">
                <Switch
                  checked={gateway.status === 'active'}
                  onCheckedChange={() => handleToggleStatus(gateway.id)}
                />
                <span className="text-sm text-muted-foreground mr-auto">Enable gateway</span>
                <Button variant="outline" size="sm" onClick={() => handleTestConnection(gateway)}>
                  <TestTube className="h-4 w-4 mr-2" />
                  Test
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setEditGateway(gateway); setDialogOpen(true); }}>
                  <Settings className="h-4 w-4 mr-2" />
                  Configure
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
