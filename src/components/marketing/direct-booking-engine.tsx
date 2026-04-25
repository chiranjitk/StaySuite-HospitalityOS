'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Globe,
  RefreshCw,
  Loader2,
  Settings,
  CheckCircle,
  ExternalLink,
  Copy,
  Palette,
  Code,
  BarChart3,
  Percent,
  DollarSign,
  Users,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCurrency } from '@/contexts/CurrencyContext';

interface BookingEngineSettings {
  enabled: boolean;
  domain: string;
  customDomain: string | null;
  primaryColor: string;
  secondaryColor: string;
  logo: string | null;
  showPrices: boolean;
  requirePayment: boolean;
  depositPercentage: number;
  cancellationPolicy: string;
  termsUrl: string | null;
  privacyUrl: string | null;
  googleAnalyticsId: string | null;
  facebookPixelId: string | null;
}

interface BookingStats {
  totalBookings: number;
  totalRevenue: number;
  conversionRate: number;
  avgBookingValue: number;
  directBookings: number;
  otaBookings: number;
  savingsFromOta: number;
}

const emptyStats: BookingStats = {
  totalBookings: 0,
  totalRevenue: 0,
  conversionRate: 0,
  avgBookingValue: 0,
  directBookings: 0,
  otaBookings: 0,
  savingsFromOta: 0,
};

export default function DirectBookingEngine() {
  const { formatCurrency } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<BookingEngineSettings>({
    enabled: true,
    domain: 'book.staysuite.com/grand-hotel',
    customDomain: null,
    primaryColor: '#0d9488',
    secondaryColor: '#f0fdfa',
    logo: null,
    showPrices: true,
    requirePayment: false,
    depositPercentage: 20,
    cancellationPolicy: 'free_24h',
    termsUrl: null,
    privacyUrl: null,
    googleAnalyticsId: null,
    facebookPixelId: null,
  });
  const [stats, setStats] = useState<BookingStats | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchSettings = async () => {
    setLoading(true);
    try {
      // Fetch real booking stats from the dedicated endpoint
      const statsPromise = fetch('/api/booking-engine/stats').then(res => {
        if (res.ok) return res.json();
        return null;
      }).catch(() => null);

      // Fetch booking engine settings from the dedicated settings endpoint
      const settingsPromise = fetch('/api/booking-engine/settings').then(res => {
        if (res.ok) return res.json();
        return null;
      }).catch(() => null);

      const [statsResult, settingsResult] = await Promise.all([statsPromise, settingsPromise]);

      // Load real stats from the booking engine stats endpoint
      if (statsResult?.success && statsResult.data) {
        const d = statsResult.data;
        setStats({
          totalBookings: d.totalBookings || 0,
          totalRevenue: d.totalRevenue || 0,
          conversionRate: d.conversionRate || 0,
          avgBookingValue: d.avgBookingValue || 0,
          directBookings: d.directBookings || 0,
          otaBookings: d.otaBookings || 0,
          savingsFromOta: d.savingsFromOta || 0,
        });
      } else {
        setStats(emptyStats);
      }

      // Load settings from the dedicated booking engine settings endpoint
      if (settingsResult?.success && settingsResult.data) {
        const s = settingsResult.data;
        setSettings(prev => ({
          ...prev,
          enabled: s.enabled !== undefined ? s.enabled : prev.enabled,
          domain: s.domain || prev.domain,
          customDomain: s.customDomain || null,
          primaryColor: s.primaryColor || prev.primaryColor,
          secondaryColor: s.secondaryColor || prev.secondaryColor,
          logo: s.logo || null,
          showPrices: s.showPrices !== undefined ? s.showPrices : prev.showPrices,
          requirePayment: s.requirePayment !== undefined ? s.requirePayment : prev.requirePayment,
          depositPercentage: s.depositPercentage || prev.depositPercentage,
          cancellationPolicy: s.cancellationPolicy || prev.cancellationPolicy,
          termsUrl: s.termsUrl || null,
          privacyUrl: s.privacyUrl || null,
          googleAnalyticsId: s.googleAnalyticsId || null,
          facebookPixelId: s.facebookPixelId || null,
        }));
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load booking engine settings');
      setStats(emptyStats);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/booking-engine/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: settings.enabled,
          domain: settings.domain,
          customDomain: settings.customDomain,
          primaryColor: settings.primaryColor,
          secondaryColor: settings.secondaryColor,
          showPrices: settings.showPrices,
          requirePayment: settings.requirePayment,
          depositPercentage: settings.depositPercentage,
          cancellationPolicy: settings.cancellationPolicy,
          termsUrl: settings.termsUrl,
          privacyUrl: settings.privacyUrl,
          googleAnalyticsId: settings.googleAnalyticsId,
          facebookPixelId: settings.facebookPixelId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || errorData?.message || 'Failed to save settings');
      }

      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const bookingUrl = settings.customDomain || `https://${settings.domain}`;

  const embedCode = `<script src="https://book.staysuite.com/widget.js" 
  data-property="grand-hotel" 
  data-primary-color="${settings.primaryColor}"
  data-secondary-color="${settings.secondaryColor}">
</script>
<div id="staysuite-booking-widget"></div>`;

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Direct Booking Engine</h2>
          <p className="text-muted-foreground">
            Configure your commission-free direct booking system
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={settings.enabled ? 'default' : 'secondary'} className={settings.enabled ? 'bg-green-100 text-green-800 dark:text-green-200' : ''}>
            {settings.enabled ? 'Active' : 'Inactive'}
          </Badge>
          <Button onClick={() => window.open(bookingUrl, '_blank')} variant="outline" size="sm">
            <ExternalLink className="h-4 w-4 mr-2" />
            Preview
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Direct Bookings</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalBookings || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.directBookings || 0} via direct booking engine
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.totalRevenue || 0)}</div>
            <p className="text-xs text-muted-foreground">
              Avg {formatCurrency(stats?.avgBookingValue || 0)} per booking
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.conversionRate || 0}%</div>
            <Progress value={stats?.conversionRate || 0} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">OTA Savings</CardTitle>
            <Percent className="h-4 w-4 text-green-500 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(stats?.savingsFromOta || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Commission saved vs OTAs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Booking Engine Status */}
      <Card className="border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-950/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-teal-100 dark:bg-teal-900/30 p-2">
                <Globe className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <h3 className="font-semibold">Your Booking Page is Live</h3>
                <p className="text-sm text-muted-foreground">{bookingUrl}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(bookingUrl)}>
                <Copy className="h-4 w-4 mr-2" />
                Copy URL
              </Button>
              <Button size="sm" onClick={() => window.open(bookingUrl, '_blank')}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Open
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="integration">Integration</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Booking Sources</CardTitle>
                <CardDescription>Distribution of bookings by source</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">Direct Booking</span>
                      <span className="text-sm font-medium">{stats?.directBookings || 0}</span>
                    </div>
                    <Progress 
                      value={(stats?.directBookings || 0) / (stats?.totalBookings || 1) * 100} 
                      className="h-2" 
                    />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">OTA Channels</span>
                      <span className="text-sm font-medium">{stats?.otaBookings || 0}</span>
                    </div>
                    <Progress 
                      value={(stats?.otaBookings || 0) / (stats?.totalBookings || 1) * 100} 
                      className="h-2 bg-gray-200 dark:bg-gray-700" 
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Performance</CardTitle>
                <CardDescription>Last 30 days performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Page Views</span>
                    <span className="font-medium">
                      {stats?.conversionRate
                        ? Math.round((stats.directBookings || 0) / (stats.conversionRate / 100))
                        : 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Booking Attempts</span>
                    <span className="font-medium">
                      {stats?.conversionRate
                        ? Math.round((stats.directBookings || 0) / (stats.conversionRate / 100) * 0.05)
                        : 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Completed Bookings</span>
                    <span className="font-medium">{stats?.directBookings || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Abandonment Rate</span>
                    <span className="font-medium text-orange-600 dark:text-orange-400">
                      {stats?.conversionRate
                        ? (100 - stats.conversionRate).toFixed(1)
                        : '—'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Commission Comparison</CardTitle>
              <CardDescription>How much you save by driving direct bookings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-red-600 dark:text-red-400 font-medium">OTA Commission (15-25%)</span>
                  </div>
                  <span className="font-bold text-red-600 dark:text-red-400">
                    -{formatCurrency(Math.round((stats?.totalRevenue || 0) * 0.20))}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <span className="text-green-600 dark:text-green-400 font-medium">Direct Booking Savings</span>
                  </div>
                  <span className="font-bold text-green-600 dark:text-green-400">
                    +{formatCurrency(stats?.savingsFromOta || 0)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Booking Settings</CardTitle>
              <CardDescription>Configure how your booking engine works</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Booking Engine</Label>
                  <p className="text-sm text-muted-foreground">
                    Turn on/off your direct booking page
                  </p>
                </div>
                <Switch
                  checked={settings.enabled}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, enabled: checked }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="domain">Booking Page URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="domain"
                    value={settings.domain}
                    onChange={(e) => setSettings(prev => ({ ...prev, domain: e.target.value }))}
                  />
                  <Button variant="outline" onClick={() => copyToClipboard(bookingUrl)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customDomain">Custom Domain (Optional)</Label>
                <Input
                  id="customDomain"
                  value={settings.customDomain || ''}
                  onChange={(e) => setSettings(prev => ({ ...prev, customDomain: e.target.value }))}
                  placeholder="book.yourhotel.com"
                />
                <p className="text-xs text-muted-foreground">
                  Use your own domain for the booking page
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show Prices</Label>
                  <p className="text-sm text-muted-foreground">
                    Display room prices on the booking page
                  </p>
                </div>
                <Switch
                  checked={settings.showPrices}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, showPrices: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Require Payment</Label>
                  <p className="text-sm text-muted-foreground">
                    Require payment at time of booking
                  </p>
                </div>
                <Switch
                  checked={settings.requirePayment}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, requirePayment: checked }))}
                />
              </div>

              {settings.requirePayment && (
                <div className="space-y-2">
                  <Label htmlFor="deposit">Deposit Percentage</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="deposit"
                      type="number"
                      value={settings.depositPercentage}
                      onChange={(e) => setSettings(prev => ({ ...prev, depositPercentage: parseInt(e.target.value) }))}
                      min={0}
                      max={100}
                      className="w-24"
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="cancellation">Cancellation Policy</Label>
                <Select
                  value={settings.cancellationPolicy}
                  onValueChange={(value) => setSettings(prev => ({ ...prev, cancellationPolicy: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free_24h">Free cancellation up to 24 hours</SelectItem>
                    <SelectItem value="free_48h">Free cancellation up to 48 hours</SelectItem>
                    <SelectItem value="free_7d">Free cancellation up to 7 days</SelectItem>
                    <SelectItem value="non_refundable">Non-refundable</SelectItem>
                    <SelectItem value="custom">Custom policy</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="termsUrl">Terms & Conditions URL</Label>
                  <Input
                    id="termsUrl"
                    value={settings.termsUrl || ''}
                    onChange={(e) => setSettings(prev => ({ ...prev, termsUrl: e.target.value }))}
                    placeholder="https://yourhotel.com/terms"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="privacyUrl">Privacy Policy URL</Label>
                  <Input
                    id="privacyUrl"
                    value={settings.privacyUrl || ''}
                    onChange={(e) => setSettings(prev => ({ ...prev, privacyUrl: e.target.value }))}
                    placeholder="https://yourhotel.com/privacy"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveSettings} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Settings
            </Button>
          </div>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Branding & Appearance
              </CardTitle>
              <CardDescription>Customize the look of your booking page</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="primaryColor">Primary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primaryColor"
                      type="color"
                      value={settings.primaryColor}
                      onChange={(e) => setSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                      className="w-12 h-10 p-1"
                    />
                    <Input
                      value={settings.primaryColor}
                      onChange={(e) => setSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secondaryColor">Secondary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="secondaryColor"
                      type="color"
                      value={settings.secondaryColor}
                      onChange={(e) => setSettings(prev => ({ ...prev, secondaryColor: e.target.value }))}
                      className="w-12 h-10 p-1"
                    />
                    <Input
                      value={settings.secondaryColor}
                      onChange={(e) => setSettings(prev => ({ ...prev, secondaryColor: e.target.value }))}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Logo</Label>
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <img
                    src={settings.logo || '/placeholder-logo.png'}
                    alt="Logo"
                    className="mx-auto h-16 object-contain mb-4"
                  />
                  <Button variant="outline" onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          setSettings(prev => ({ ...prev, logo: ev.target?.result as string }));
                          toast.success('Logo uploaded successfully');
                        };
                        reader.readAsDataURL(file);
                      }
                    };
                    input.click();
                  }}>
                    Upload Logo
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Recommended: PNG or SVG, max 500KB, 200x80px
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Preview</Label>
                <div 
                  className="border rounded-lg p-6"
                  style={{ backgroundColor: settings.secondaryColor }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div 
                      className="h-8 w-32 rounded"
                      style={{ backgroundColor: settings.primaryColor }}
                    />
                    <div className="flex gap-2">
                      <div 
                        className="h-8 w-20 rounded text-white flex items-center justify-center text-sm"
                        style={{ backgroundColor: settings.primaryColor }}
                      >
                        Book Now
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="bg-white rounded-lg p-3 shadow-sm">
                        <div className="h-20 bg-gray-200 rounded mb-2" />
                        <div className="h-3 bg-gray-200 rounded w-2/3 mb-2" />
                        <div className="h-3 bg-gray-200 rounded w-1/2" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveSettings} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Appearance
            </Button>
          </div>
        </TabsContent>

        {/* Integration Tab */}
        <TabsContent value="integration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Embed Widget
              </CardTitle>
              <CardDescription>Add booking to your website</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Add this code to your website to embed the booking widget:
              </p>
              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
                  {embedCode}
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(embedCode)}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Analytics Integration
              </CardTitle>
              <CardDescription>Track bookings with analytics tools</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gaId">Google Analytics ID</Label>
                <Input
                  id="gaId"
                  value={settings.googleAnalyticsId || ''}
                  onChange={(e) => setSettings(prev => ({ ...prev, googleAnalyticsId: e.target.value }))}
                  placeholder="G-XXXXXXXXXX"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fbPixelId">Facebook Pixel ID</Label>
                <Input
                  id="fbPixelId"
                  value={settings.facebookPixelId || ''}
                  onChange={(e) => setSettings(prev => ({ ...prev, facebookPixelId: e.target.value }))}
                  placeholder="XXXXXXXXXX"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveSettings} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Integration
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
