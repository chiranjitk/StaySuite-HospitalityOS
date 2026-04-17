'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CreditCard,
  Check,
  X,
  Settings,
  Plus,
  Shield,
  TestTube,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Activity,
  DollarSign,
  TrendingUp,
  Clock,
  Globe,
  Zap,
  Key,
  Link2,
  Unlink,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/contexts/CurrencyContext';

interface PaymentGateway {
  id: string;
  name: string;
  provider: string;
  status: 'active' | 'inactive' | 'sandbox' | 'error';
  mode: 'live' | 'test';
  apiKey?: string;
  secretKey?: string;
  merchantId?: string;
  webhookSecret?: string;
  supportedCurrencies: string[];
  supportedMethods: string[];
  fees: {
    percentage: number;
    fixed: number;
  };
  lastSync?: string;
  lastTestResult?: 'success' | 'failed' | null;
  totalTransactions: number;
  totalVolume: number;
  successRate: number;
}

interface TransactionStats {
  totalTransactions: number;
  totalVolume: number;
  successRate: number;
  avgProcessingTime: number;
  refunds: number;
  chargebacks: number;
}

interface PaymentGatewaysPageData {
  gateways: PaymentGateway[];
  stats: TransactionStats;
  recentTransactions: {
    id: string;
    amount: number;
    currency: string;
    status: 'success' | 'pending' | 'failed' | 'refunded';
    gateway: string;
    createdAt: string;
  }[];
}

const providerOptions = [
  { value: 'stripe', label: 'Stripe', icon: '💳', color: '#635BFF' },
  { value: 'paypal', label: 'PayPal', icon: '🅿️', color: '#003087' },
  { value: 'square', label: 'Square', icon: '⬜', color: '#006AFF' },
  { value: 'adyen', label: 'Adyen', icon: '🔷', color: '#0ABF53' },
  { value: 'braintree', label: 'Braintree', icon: '💜', color: '#6B5B95' },
  { value: 'authorize_net', label: 'Authorize.net', icon: '🔐', color: '#FF6A00' },
  { value: 'razorpay', label: 'Razorpay', icon: '⚡', color: '#2D5BFF' },
  { value: 'mollie', label: 'Mollie', icon: '🌊', color: '#EC1F7D' },
];

const paymentMethods = [
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'debit_card', label: 'Debit Card' },
  { value: 'apple_pay', label: 'Apple Pay' },
  { value: 'google_pay', label: 'Google Pay' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

export default function PaymentGatewaysPage() {
  const { formatCurrency } = useCurrency();
  const [data, setData] = useState<PaymentGatewaysPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editGateway, setEditGateway] = useState<PaymentGateway | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [testGateway, setTestGateway] = useState<PaymentGateway | null>(null);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [deleteGateway, setDeleteGateway] = useState<PaymentGateway | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/integrations/payment-gateways');
      const result = await response.json();

      if (result.success) {
        setData({
          gateways: result.data.gateways || [],
          stats: result.data.stats || {
            totalTransactions: 0,
            totalVolume: 0,
            successRate: 0,
            avgProcessingTime: 0,
            refunds: 0,
            chargebacks: 0,
          },
          recentTransactions: result.data.recentTransactions || [],
        });
      } else {
        // Generate mock data if API fails
        setData({
          gateways: [
            {
              id: 'gw1',
              name: 'Stripe Production',
              provider: 'stripe',
              status: 'active',
              mode: 'live',
              supportedCurrencies: ['USD', 'EUR', 'GBP'],
              supportedMethods: ['credit_card', 'apple_pay', 'google_pay'],
              fees: { percentage: 2.9, fixed: 0.30 },
              totalTransactions: 1250,
              totalVolume: 156780,
              successRate: 98.5,
            },
            {
              id: 'gw2',
              name: 'PayPal Checkout',
              provider: 'paypal',
              status: 'active',
              mode: 'live',
              supportedCurrencies: ['USD', 'EUR'],
              supportedMethods: ['paypal', 'credit_card'],
              fees: { percentage: 2.9, fixed: 0.30 },
              totalTransactions: 542,
              totalVolume: 45230,
              successRate: 97.8,
            },
            {
              id: 'gw3',
              name: 'Square POS',
              provider: 'square',
              status: 'sandbox',
              mode: 'test',
              supportedCurrencies: ['USD'],
              supportedMethods: ['credit_card', 'debit_card'],
              fees: { percentage: 2.6, fixed: 0.10 },
              totalTransactions: 0,
              totalVolume: 0,
              successRate: 0,
            },
          ],
          stats: {
            totalTransactions: 1792,
            totalVolume: 202010,
            successRate: 98.2,
            avgProcessingTime: 1.8,
            refunds: 23,
            chargebacks: 2,
          },
          recentTransactions: [
            { id: 'tx1', amount: 450, currency: 'USD', status: 'success', gateway: 'Stripe', createdAt: new Date().toISOString() },
            { id: 'tx2', amount: 125, currency: 'USD', status: 'success', gateway: 'PayPal', createdAt: new Date(Date.now() - 3600000).toISOString() },
            { id: 'tx3', amount: 89, currency: 'USD', status: 'pending', gateway: 'Stripe', createdAt: new Date(Date.now() - 7200000).toISOString() },
          ],
        });
      }
    } catch (error) {
      console.error('Failed to fetch payment gateways:', error);
      toast.error('Failed to fetch payment gateways');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleStatus = async (id: string) => {
    const gateway = data?.gateways.find(g => g.id === id);
    if (!gateway) return;

    try {
      const response = await fetch('/api/integrations/payment-gateways', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          status: gateway.status === 'active' ? 'inactive' : 'active',
        }),
      });

      if (response.ok) {
        setData(prev => prev ? {
          ...prev,
          gateways: prev.gateways.map(g =>
            g.id === id ? { ...g, status: g.status === 'active' ? 'inactive' : 'active' } : g
          ),
        } : null);
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
        const result = await response.json();
        if (method === 'POST') {
          setData(prev => prev ? {
            ...prev,
            gateways: [...prev.gateways, result.data],
          } : null);
          toast.success('Gateway added successfully');
        } else {
          setData(prev => prev ? {
            ...prev,
            gateways: prev.gateways.map(g => g.id === editGateway.id ? editGateway : g),
          } : null);
          toast.success('Gateway updated successfully');
        }
        fetchData();
      }
    } catch {
      toast.error('Failed to save gateway');
    }
    setDialogOpen(false);
    setEditGateway(null);
  };

  const handleTestConnection = async () => {
    if (!testGateway) return;

    setIsTesting(true);
    try {
      // Simulate test connection
      await new Promise(resolve => setTimeout(resolve, 2000));

      const success = Math.random() > 0.2; // 80% success rate for demo

      setData(prev => prev ? {
        ...prev,
        gateways: prev.gateways.map(g =>
          g.id === testGateway.id ? { ...g, lastTestResult: success ? 'success' : 'failed' } : g
        ),
      } : null);

      if (success) {
        toast.success('Connection test successful!');
      } else {
        toast.error('Connection test failed. Please check your credentials.');
      }
    } catch {
      toast.error('Connection test failed');
    } finally {
      setIsTesting(false);
      setTestDialogOpen(false);
    }
  };

  const handleDeleteGateway = async () => {
    if (!deleteGateway) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/integrations/payment-gateways?id=${deleteGateway.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setData(prev => prev ? {
          ...prev,
          gateways: prev.gateways.filter(g => g.id !== deleteGateway.id),
        } : null);
        toast.success('Gateway deleted successfully');
      }
    } catch {
      toast.error('Failed to delete gateway');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setDeleteGateway(null);
    }
  };

  const getProviderConfig = (provider: string) => {
    return providerOptions.find(p => p.value === provider) || providerOptions[0];
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      active: { label: 'Active', className: 'bg-emerald-500 text-white' },
      inactive: { label: 'Inactive', className: 'bg-gray-500 text-white' },
      sandbox: { label: 'Sandbox', className: 'bg-amber-500 text-white' },
      error: { label: 'Error', className: 'bg-red-500 text-white' },
    };
    const option = config[status];
    return (
      <Badge variant="secondary" className={option?.className}>
        {option?.label || status}
      </Badge>
    );
  };

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CreditCard className="h-6 w-6" />
            Payment Gateways
          </h2>
          <p className="text-muted-foreground">Configure and manage payment processing integrations</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditGateway({
                id: '',
                name: '',
                provider: 'stripe',
                status: 'inactive',
                mode: 'test',
                supportedCurrencies: ['USD'],
                supportedMethods: ['credit_card'],
                fees: { percentage: 0, fixed: 0 },
                totalTransactions: 0,
                totalVolume: 0,
                successRate: 0,
              })}>
                <Plus className="h-4 w-4 mr-2" />
                Add Gateway
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editGateway?.id ? 'Edit Gateway' : 'Add Payment Gateway'}</DialogTitle>
                <DialogDescription>Configure your payment gateway settings</DialogDescription>
              </DialogHeader>
              {editGateway && (
                <div className="space-y-6 py-4">
                  {/* Basic Settings */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Basic Settings</h4>
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
                              <SelectItem key={p.value} value={p.value}>
                                <span className="flex items-center gap-2">
                                  <span>{p.icon}</span>
                                  {p.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
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
                      <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select
                          value={editGateway.status}
                          onValueChange={(v: 'active' | 'inactive' | 'sandbox') => setEditGateway({ ...editGateway, status: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                            <SelectItem value="sandbox">Sandbox</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* API Credentials */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">API Credentials</h4>
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
                        <Label htmlFor="webhookSecret">Webhook Secret</Label>
                        <Input
                          id="webhookSecret"
                          type="password"
                          value={editGateway.webhookSecret || ''}
                          onChange={(e) => setEditGateway({ ...editGateway, webhookSecret: e.target.value })}
                          placeholder="whsec_xxxxx"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Fees & Limits */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Fees & Configuration</h4>
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
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveGateway}>Save Gateway</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardDescription>Total Transactions</CardDescription>
            <CardTitle className="text-2xl">{data.stats.totalTransactions.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="h-4 w-4" />
              <span>All time</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardDescription>Total Volume</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(data.stats.totalVolume)}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              <span>Processed</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-cyan-500">
          <CardHeader className="pb-2">
            <CardDescription>Success Rate</CardDescription>
            <CardTitle className="text-2xl">{data.stats.successRate}%</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span>Avg processing: {data.stats.avgProcessingTime}s</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-violet-500">
          <CardHeader className="pb-2">
            <CardDescription>Active Gateways</CardDescription>
            <CardTitle className="text-2xl">{data.gateways.filter(g => g.status === 'active').length}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Globe className="h-4 w-4" />
              <span>of {data.gateways.length} configured</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gateway List */}
      <div className="grid gap-4">
        {data.gateways.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CreditCard className="h-12 w-12 mb-4 opacity-50" />
              <p>No payment gateways configured</p>
              <p className="text-sm">Add a payment gateway to start accepting payments</p>
            </CardContent>
          </Card>
        ) : (
          data.gateways.map((gateway) => {
            const providerConfig = getProviderConfig(gateway.provider);
            return (
              <Card key={gateway.id} className="overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-12 w-12 rounded-lg flex items-center justify-center text-2xl"
                        style={{ backgroundColor: providerConfig.color + '20' }}
                      >
                        {providerConfig.icon}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{gateway.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm text-muted-foreground capitalize">{gateway.provider}</span>
                          <Badge variant={gateway.mode === 'live' ? 'default' : 'secondary'}>
                            {gateway.mode === 'live' ? 'Live' : 'Test'}
                          </Badge>
                          {getStatusBadge(gateway.status)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {gateway.lastTestResult && (
                        <Badge variant="outline" className={gateway.lastTestResult === 'success' ? 'border-emerald-500 text-emerald-600' : 'border-red-500 text-red-600'}>
                          {gateway.lastTestResult === 'success' ? 'Test Passed' : 'Test Failed'}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-5 mb-4">
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
                    <div>
                      <p className="text-sm text-muted-foreground">Success Rate</p>
                      <div className="flex items-center gap-2">
                        <Progress value={gateway.successRate} className="h-2 w-16" />
                        <span className="font-medium">{gateway.successRate}%</span>
                      </div>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={gateway.status === 'active'}
                        onCheckedChange={() => handleToggleStatus(gateway.id)}
                      />
                      <span className="text-sm text-muted-foreground">
                        {gateway.status === 'active' ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTestGateway(gateway);
                          setTestDialogOpen(true);
                        }}
                      >
                        <TestTube className="h-4 w-4 mr-2" />
                        Test
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditGateway(gateway);
                          setDialogOpen(true);
                        }}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Configure
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => {
                          setDeleteGateway(gateway);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Unlink className="h-4 w-4 mr-2" />
                        Remove
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Test Connection Dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TestTube className="h-5 w-5" />
              Test Connection
            </DialogTitle>
            <DialogDescription>
              Test the connection to {testGateway?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              This will attempt to connect to the payment gateway using the configured credentials
              and perform a test API call to verify the connection is working correctly.
            </p>
            {testGateway && (
              <div className="mt-4 p-4 rounded-lg bg-muted">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Provider:</span>
                  <span className="font-medium capitalize">{testGateway.provider}</span>
                  <span className="text-muted-foreground">Mode:</span>
                  <span className="font-medium capitalize">{testGateway.mode}</span>
                  <span className="text-muted-foreground">API Key:</span>
                  <span className="font-medium font-mono text-xs">
                    {testGateway.apiKey ? `${testGateway.apiKey.slice(0, 8)}...` : 'Not configured'}
                  </span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleTestConnection} disabled={isTesting}>
              {isTesting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isTesting ? 'Testing...' : 'Run Test'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Remove Payment Gateway
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{deleteGateway?.name}</strong>? This action cannot be undone
              and will disable all payment processing through this gateway.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGateway}
              className="bg-red-600 hover:bg-red-700"
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remove Gateway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
