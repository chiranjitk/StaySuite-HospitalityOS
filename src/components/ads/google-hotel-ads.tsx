'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  Line,
  LineChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Link2,
  Unlink2,
  Settings,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Zap,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  Eye,
  MousePointer,
  ShoppingCart,
  BarChart3,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useCurrency } from '@/contexts/CurrencyContext';
import { usePropertyId } from '@/hooks/use-property';

interface GoogleAdsConnection {
  id: string;
  propertyId: string;
  accountId: string | null;
  subAccountId: string | null;
  hotelId: string | null;
  status: string;
  connectionMode: string;
  partnerId: string | null;
  hotelCenterId: string | null;
  priceFeedUrl: string | null;
  priceFeedFormat: string;
  lastPriceFeedAt: string | null;
  lastBookingFeedAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
  totalBookings: number;
  totalRevenue: number;
  totalSpend: number;
  avgRoas: number;
  bidStrategy: string;
  baseBidModifier: number;
  autoBidEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CampaignOverview {
  total: number;
  active: number;
  paused: number;
  totalBudget: number;
  totalSpent: number;
  totalRevenue: number;
  avgRoas: number;
  avgCtr: number;
}

interface PerformanceData {
  date: string;
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
  revenue: number;
}

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  connected: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
  error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  disconnected: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

const chartConfig = {
  impressions: {
    label: 'Impressions',
    color: '#10b981',
  },
  clicks: {
    label: 'Clicks',
    color: '#f59e0b',
  },
  conversions: {
    label: 'Conversions',
    color: '#8b5cf6',
  },
} satisfies ChartConfig;

export default function GoogleHotelAds() {
  const { formatCurrency } = useCurrency();
  const { propertyId } = usePropertyId();
  const [connection, setConnection] = useState<GoogleAdsConnection | null>(null);
  const [campaignOverview, setCampaignOverview] = useState<CampaignOverview | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectDialog, setConnectDialog] = useState(false);
  const [settingsDialog, setSettingsDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  const [formData, setFormData] = useState({
    accountId: '',
    subAccountId: '',
    hotelId: '',
    partnerId: '',
    hotelCenterId: '',
    connectionMode: 'live',
    bidStrategy: 'auto',
    baseBidModifier: 1.0,
    autoBidEnabled: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [connectionRes, overviewRes, performanceRes] = await Promise.all([
        fetch('/api/ads/google'),
        fetch('/api/ads/campaigns?overview=true'),
        fetch('/api/ads/performance?days=14'),
      ]);

      if (connectionRes.ok) {
        const data = await connectionRes.json();
        if (data.success && data.data) {
          setConnection(data.data);
          setFormData({
            accountId: data.data.accountId || '',
            subAccountId: data.data.subAccountId || '',
            hotelId: data.data.hotelId || '',
            partnerId: data.data.partnerId || '',
            hotelCenterId: data.data.hotelCenterId || '',
            connectionMode: data.data.connectionMode || 'live',
            bidStrategy: data.data.bidStrategy || 'auto',
            baseBidModifier: data.data.baseBidModifier || 1.0,
            autoBidEnabled: data.data.autoBidEnabled ?? true,
          });
        }
      }

      if (overviewRes.ok) {
        const data = await overviewRes.json();
        if (data.success) {
          setCampaignOverview(data.data.overview);
        }
      }

      if (performanceRes.ok) {
        const data = await performanceRes.json();
        if (data.success) {
          setPerformanceData(data.data.performance);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load Google Hotel Ads data');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/ads/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, propertyId }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Google Hotel Ads connected successfully');
        setConnectDialog(false);
        fetchData();
      } else {
        toast.error(data.error?.message || 'Failed to connect');
      }
    } catch (error) {
      console.error('Error connecting:', error);
      toast.error('Failed to connect Google Hotel Ads');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/ads/google', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Settings updated successfully');
        setSettingsDialog(false);
        fetchData();
      } else {
        toast.error(data.error?.message || 'Failed to update settings');
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = () => {
    setShowDisconnectConfirm(true);
  };

  const confirmDisconnect = async () => {
    try {
      const params = new URLSearchParams();
      if (connection?.id) params.append('id', connection.id);
      if (connection?.propertyId) params.append('propertyId', connection.propertyId);
      else if (propertyId) params.append('propertyId', propertyId);

      const response = await fetch(`/api/ads/google?${params}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Disconnected successfully');
        setConnection(null);
      } else {
        toast.error(data.error?.message || 'Failed to disconnect');
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast.error('Failed to disconnect');
    } finally {
      setShowDisconnectConfirm(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return format(new Date(dateStr), 'MMM dd, yyyy HH:mm');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600 dark:text-teal-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Google Hotel Ads</h2>
          <p className="text-muted-foreground">
            Connect and manage Google Hotel Ads campaigns
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {connection?.status === 'connected' ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setSettingsDialog(true)}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
              <Button variant="outline" size="sm" className="text-red-600 dark:text-red-400" onClick={handleDisconnect}>
                <Unlink2 className="h-4 w-4 mr-2" />
                Disconnect
              </Button>
            </>
          ) : (
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => setConnectDialog(true)}>
              <Link2 className="h-4 w-4 mr-2" />
              Connect
            </Button>
          )}
        </div>
      </div>

      {/* Connection Status */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${
                connection?.status === 'connected' 
                  ? 'bg-emerald-100 dark:bg-emerald-900' 
                  : connection?.status === 'error'
                  ? 'bg-red-100 dark:bg-red-900'
                  : 'bg-amber-100 dark:bg-amber-900'
              }`}>
                {connection?.status === 'connected' ? (
                  <CheckCircle className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                ) : connection?.status === 'error' ? (
                  <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                ) : (
                  <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                )}
              </div>
              <div>
                <h3 className="font-semibold">
                  {connection?.status === 'connected' 
                    ? 'Connected to Google Hotel Ads' 
                    : connection?.status === 'error'
                    ? 'Connection Error'
                    : 'Not Connected'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {connection?.status === 'connected'
                    ? `Account: ${connection.accountId || 'N/A'} | Hotel ID: ${connection.hotelId || 'N/A'}`
                    : connection?.lastError || 'Connect your Google Hotel Ads account to start advertising'}
                </p>
              </div>
            </div>
            <Badge className={statusColors[connection?.status || 'disconnected']}>
              {connection?.status || 'disconnected'}
            </Badge>
          </div>
          {connection?.lastError && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-950 rounded-lg text-sm text-red-700 dark:text-red-300">
              {connection.lastError}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Campaign Overview */}
      {campaignOverview && (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Active Campaigns</p>
                  <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">{campaignOverview.active}</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                    of {campaignOverview.total} total
                  </p>
                </div>
                <div className="p-3 rounded-full bg-emerald-200 dark:bg-emerald-800">
                  <Target className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950 dark:to-purple-950">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-violet-700 dark:text-violet-400">Total Budget</p>
                  <p className="text-2xl font-bold text-violet-900 dark:text-violet-100">{formatCurrency(campaignOverview.totalBudget)}</p>
                  <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">
                    Spent: {formatCurrency(campaignOverview.totalSpent)}
                  </p>
                </div>
                <div className="p-3 rounded-full bg-violet-200 dark:bg-violet-800">
                  <DollarSign className="h-5 w-5 text-violet-700 dark:text-violet-300" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Total Revenue</p>
                  <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">{formatCurrency(campaignOverview.totalRevenue)}</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    ROAS: {campaignOverview.avgRoas.toFixed(2)}x
                  </p>
                </div>
                <div className="p-3 rounded-full bg-amber-200 dark:bg-amber-800">
                  <TrendingUp className="h-5 w-5 text-amber-700 dark:text-amber-300" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-950 dark:to-sky-950">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-cyan-700 dark:text-cyan-400">Avg CTR</p>
                  <p className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">{campaignOverview.avgCtr.toFixed(2)}%</p>
                  <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-1">
                    Click-through rate
                  </p>
                </div>
                <div className="p-3 rounded-full bg-cyan-200 dark:bg-cyan-800">
                  <MousePointer className="h-5 w-5 text-cyan-700 dark:text-cyan-300" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Performance Chart */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Performance Trend</CardTitle>
          <CardDescription>Last 14 days performance</CardDescription>
        </CardHeader>
        <CardContent>
          {performanceData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => format(new Date(v), 'MMM dd')}
                  className="text-xs"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  className="text-xs"
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="impressions" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="clicks" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
              <BarChart3 className="h-12 w-12 mb-2" />
              <p>No performance data available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bid Management */}
      {connection?.status === 'connected' && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500 dark:text-amber-400" />
              <CardTitle className="text-lg">Bid Management</CardTitle>
            </div>
            <CardDescription>Automated bidding settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Bid Strategy</p>
                    <p className="text-sm text-muted-foreground">How bids are calculated</p>
                  </div>
                  <Badge variant="outline" className="capitalize">{connection.bidStrategy}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Auto Bidding</p>
                    <p className="text-sm text-muted-foreground">Automatically adjust bids</p>
                  </div>
                  <Badge variant={connection.autoBidEnabled ? 'default' : 'secondary'}>
                    {connection.autoBidEnabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Base Bid Modifier</p>
                    <p className="text-sm text-muted-foreground">Applied to all bids</p>
                  </div>
                  <Badge variant="outline">{(connection.baseBidModifier * 100).toFixed(0)}%</Badge>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Last Price Feed</p>
                    <p className="text-sm text-muted-foreground">Price update sync</p>
                  </div>
                  <span className="text-sm">{formatDate(connection.lastPriceFeedAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Last Booking Feed</p>
                    <p className="text-sm text-muted-foreground">Booking data sync</p>
                  </div>
                  <span className="text-sm">{formatDate(connection.lastBookingFeedAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Feed Format</p>
                    <p className="text-sm text-muted-foreground">Data format type</p>
                  </div>
                  <Badge variant="outline" className="uppercase">{connection.priceFeedFormat}</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connect Dialog */}
      <Dialog open={connectDialog} onOpenChange={setConnectDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Connect Google Hotel Ads</DialogTitle>
            <DialogDescription>
              Enter your Google Hotel Ads account details to connect
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Account ID</Label>
              <Input
                value={formData.accountId}
                onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                placeholder="123-456-7890"
              />
            </div>
            <div className="space-y-2">
              <Label>Sub Account ID</Label>
              <Input
                value={formData.subAccountId}
                onChange={(e) => setFormData({ ...formData, subAccountId: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label>Hotel ID</Label>
              <Input
                value={formData.hotelId}
                onChange={(e) => setFormData({ ...formData, hotelId: e.target.value })}
                placeholder="Your hotel ID"
              />
            </div>
            <div className="space-y-2">
              <Label>Partner ID</Label>
              <Input
                value={formData.partnerId}
                onChange={(e) => setFormData({ ...formData, partnerId: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label>Connection Mode</Label>
              <Select
                value={formData.connectionMode}
                onValueChange={(v) => setFormData({ ...formData, connectionMode: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="live">Live</SelectItem>
                  <SelectItem value="test">Test</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectDialog(false)}>Cancel</Button>
            <Button onClick={handleConnect} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={settingsDialog} onOpenChange={setSettingsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bid Settings</DialogTitle>
            <DialogDescription>
              Configure bidding strategy and modifiers
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Bid Strategy</Label>
              <Select
                value={formData.bidStrategy}
                onValueChange={(v) => setFormData({ ...formData, bidStrategy: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automatic</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="enhanced">Enhanced CPC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Base Bid Modifier</Label>
              <Input
                type="number"
                step="0.1"
                min="0.1"
                max="10"
                value={formData.baseBidModifier}
                onChange={(e) => setFormData({ ...formData, baseBidModifier: parseFloat(e.target.value) || 1 })}
              />
              <p className="text-xs text-muted-foreground">Multiplier applied to all bids (e.g., 1.0 = 100%)</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Auto Bidding</p>
                <p className="text-sm text-muted-foreground">Automatically adjust bids based on performance</p>
              </div>
              <Switch
                checked={formData.autoBidEnabled}
                onCheckedChange={(v) => setFormData({ ...formData, autoBidEnabled: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsDialog(false)}>Cancel</Button>
            <Button onClick={handleUpdateSettings} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog open={showDisconnectConfirm} onOpenChange={setShowDisconnectConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Google Hotel Ads</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect Google Hotel Ads? You will need to reconnect to resume advertising.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDisconnect} className="bg-red-600 hover:bg-red-700">
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
