'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Smartphone,
  Bell,
  Key,
  Shield,
  Wifi,
  Settings,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Fingerprint,
  QrCode,
  Mail,
  MessageSquare,
  Globe,
  User,
  Lock,
  Unlock,
  Zap,
  Battery,
  Signal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useUIStore } from '@/store';
import { useAuth } from '@/contexts/AuthContext';
import { format, formatDistanceToNow } from 'date-fns';

interface NotificationSetting {
  id: string;
  type: string;
  channel: 'app' | 'sms' | 'email';
  enabled: boolean;
  label: string;
  description: string;
}

interface FeatureToggle {
  id: string;
  name: string;
  key: string;
  enabled: boolean;
  description: string;
  category: string;
  icon: React.ElementType;
}

interface DigitalKeyData {
  id: string;
  roomNumber: string;
  status: 'active' | 'inactive' | 'expired';
  lastUsed?: string;
  accessCount: number;
  expiresAt: string;
  keyType: 'mobile' | 'wallet' | 'qr';
  deviceId?: string;
  batteryLevel?: number;
}

interface GuestAppData {
  guestName: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  appVersion: string;
  lastActive: string;
  notificationSettings: NotificationSetting[];
  featureToggles: FeatureToggle[];
  digitalKeys: DigitalKeyData[];
  deviceInfo: {
    platform: string;
    osVersion: string;
    notificationsEnabled: boolean;
    locationEnabled: boolean;
  };
}

const featureCategories = [
  { value: 'room', label: 'Room Features' },
  { value: 'services', label: 'Services' },
  { value: 'communication', label: 'Communication' },
  { value: 'payments', label: 'Payments' },
];

export default function GuestAppControls() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [appData, setAppData] = useState<GuestAppData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState<DigitalKeyData | null>(null);
  const [isKeyDialogOpen, setIsKeyDialogOpen] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const fetchAppData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch digital keys from real API
      const keysResponse = await fetch('/api/digital-keys');
      const keysResult = await keysResponse.json();

      // Fetch notification settings from real API
      const notifResponse = await fetch('/api/notifications/settings');
      let notificationSettings: NotificationSetting[] = [];
      try {
        const notifResult = await notifResponse.json();
        if (notifResult.success && Array.isArray(notifResult.data)) {
          notificationSettings = notifResult.data.map((s: any) => ({
            id: s.id,
            type: s.type || s.channel || 'app',
            channel: s.channel || 'app',
            enabled: s.enabled ?? true,
            label: s.label || s.name || 'Notification',
            description: s.description || '',
          }));
        }
      } catch {
        // Fallback: API not available
      }

      // Default notification settings if none from API
      if (notificationSettings.length === 0) {
        notificationSettings = [
          { id: '1', type: 'booking', channel: 'app', enabled: true, label: 'Booking Confirmations', description: 'Get notified when your booking is confirmed' },
          { id: '2', type: 'checkout', channel: 'app', enabled: true, label: 'Checkout Reminders', description: 'Reminders before checkout time' },
          { id: '3', type: 'services', channel: 'app', enabled: true, label: 'Service Updates', description: 'Updates on your service orders' },
          { id: '4', type: 'promotions', channel: 'app', enabled: false, label: 'Promotions', description: 'Special offers and deals' },
          { id: '5', type: 'booking', channel: 'email', enabled: true, label: 'Email Confirmations', description: 'Booking confirmations via email' },
          { id: '6', type: 'services', channel: 'sms', enabled: false, label: 'SMS Updates', description: 'Service updates via SMS' },
        ];
      }

      // Fetch feature flags from real API
      const featureResponse = await fetch('/api/settings/feature-flags');
      let featureToggles: FeatureToggle[] = [];
      try {
        const featureResult = await featureResponse.json();
        if (featureResult.success && Array.isArray(featureResult.data)) {
          featureToggles = featureResult.data.map((f: any, i: number) => ({
            id: f.id || `f${i}`,
            name: f.name || f.label || 'Feature',
            key: f.key || f.id || `feature_${i}`,
            enabled: f.enabled ?? f.isActive ?? true,
            description: f.description || '',
            category: f.category || 'room',
            icon: f.icon ? (() => { const icons: Record<string, React.ElementType> = { Key, Settings, Smartphone, Zap, MessageSquare, Globe }; return icons[f.icon] || Smartphone; })() : Smartphone,
          }));
        }
      } catch {
        // Fallback: API not available
      }

      // Default feature toggles if none from API
      if (featureToggles.length === 0) {
        featureToggles = [
          { id: 'f1', name: 'Digital Room Key', key: 'digital_key', enabled: true, description: 'Use your phone as room key', category: 'room', icon: Key },
          { id: 'f2', name: 'Room Controls', key: 'room_controls', enabled: true, description: 'Control lights, AC, and TV', category: 'room', icon: Settings },
          { id: 'f3', name: 'In-Room Dining', key: 'room_service', enabled: true, description: 'Order food and beverages', category: 'services', icon: Smartphone },
          { id: 'f4', name: 'Spa Booking', key: 'spa_booking', enabled: true, description: 'Book spa appointments', category: 'services', icon: Zap },
          { id: 'f5', name: 'Guest Chat', key: 'guest_chat', enabled: true, description: 'Chat with hotel staff', category: 'communication', icon: MessageSquare },
          { id: 'f6', name: 'Digital Concierge', key: 'concierge', enabled: true, description: 'AI-powered recommendations', category: 'communication', icon: Globe },
          { id: 'f7', name: 'Mobile Payments', key: 'mobile_payments', enabled: false, description: 'Pay using saved cards', category: 'payments', icon: Smartphone },
          { id: 'f8', name: 'Express Checkout', key: 'express_checkout', enabled: true, description: 'Quick checkout without front desk', category: 'payments', icon: CheckCircle2 },
        ];
      }

      // Digital keys from real API
      let digitalKeys: DigitalKeyData[] = [];
      if (keysResult.success && keysResult.data) {
        digitalKeys = keysResult.data.map((key: any) => ({
          id: key.id,
          roomNumber: key.roomNumber,
          status: key.status,
          lastUsed: key.lastAccess,
          accessCount: key.accessCount,
          expiresAt: key.checkOut,
          keyType: 'mobile' as const,
        }));
      }

      // Fetch properties to get real property info
      const propsResponse = await fetch('/api/properties');
      const propsResult = await propsResponse.json();
      const firstProperty = (propsResult.properties || propsResult.data || [])[0];

      setAppData({
        guestName: user?.name || 'Guest',
        roomNumber: digitalKeys.length > 0 ? digitalKeys[0].roomNumber : '-',
        checkIn: new Date().toISOString(),
        checkOut: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        appVersion: '2.5.1',
        lastActive: new Date().toISOString(),
        notificationSettings,
        featureToggles,
        digitalKeys,
        deviceInfo: {
          platform: 'Web',
          osVersion: navigator?.userAgent ? 'Browser' : 'Unknown',
          notificationsEnabled: notificationSettings.some(s => s.enabled),
          locationEnabled: false,
        },
      });
    } catch (error) {
      console.error('Error fetching app data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load guest app controls',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, user]);

  useEffect(() => {
    fetchAppData();
  }, [fetchAppData]);

  const handleNotificationToggle = async (settingId: string, enabled: boolean) => {
    if (!appData) return;

    setAppData({
      ...appData,
      notificationSettings: appData.notificationSettings.map(s =>
        s.id === settingId ? { ...s, enabled } : s
      ),
    });

    toast({
      title: 'Setting Updated',
      description: `Notification setting ${enabled ? 'enabled' : 'disabled'}`,
    });
  };

  const handleFeatureToggle = async (featureId: string, enabled: boolean) => {
    if (!appData) return;

    setAppData({
      ...appData,
      featureToggles: appData.featureToggles.map(f =>
        f.id === featureId ? { ...f, enabled } : f
      ),
    });

    toast({
      title: 'Feature Updated',
      description: `Feature ${enabled ? 'enabled' : 'disabled'}`,
    });
  };

  const handleRegenerateKey = async () => {
    if (!selectedKey) return;

    setIsRegenerating(true);
    try {
      const response = await fetch('/api/digital-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: selectedKey.id,
          action: 'regenerate',
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Key Regenerated',
          description: 'A new digital key has been generated',
        });
        fetchAppData();
      } else {
        throw new Error(result.error?.message || 'Failed to regenerate key');
      }
    } catch (error) {
      console.error('Error regenerating key:', error);
      toast({
        title: 'Error',
        description: 'Failed to regenerate key',
        variant: 'destructive',
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleToggleKeyStatus = async (keyId: string, enabled: boolean) => {
    try {
      const response = await fetch('/api/digital-keys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: keyId,
          keyEnabled: enabled,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: enabled ? 'Key Activated' : 'Key Deactivated',
          description: `Digital key has been ${enabled ? 'enabled' : 'disabled'}`,
        });
        fetchAppData();
      } else {
        throw new Error(result.error?.message || 'Failed to update key');
      }
    } catch (error) {
      console.error('Error updating key:', error);
      toast({
        title: 'Error',
        description: 'Failed to update key status',
        variant: 'destructive',
      });
    }
  };

  const filteredFeatures = appData?.featureToggles.filter(
    f => activeCategory === 'all' || f.category === activeCategory
  ) || [];

  if (isLoading || !appData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-4">
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
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Guest App Controls
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage app features and notification settings
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchAppData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Device Info */}
      <Card className="bg-gradient-to-r from-violet-500/10 to-purple-500/10">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-violet-500/20">
                <Smartphone className="h-6 w-6 text-violet-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{appData.guestName}</h3>
                <p className="text-sm text-muted-foreground">
                  {appData.digitalKeys.length > 0 ? `Room ${appData.digitalKeys[0].roomNumber}` : 'No active room'} • {appData.deviceInfo.platform}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-700">
                <Signal className="h-3 w-3 mr-1" />
                Connected
              </Badge>
              <Badge variant="outline">
                v{appData.appVersion}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Digital Keys Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Key className="h-5 w-5 text-amber-500" />
            Digital Keys
          </CardTitle>
          <CardDescription>Manage mobile room keys for this guest</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {appData.digitalKeys.map((key) => (
              <Card key={key.id} className={cn(
                'overflow-hidden',
                key.status === 'active' ? 'border-emerald-500/50' : key.status === 'expired' ? 'border-red-500/50' : 'border-muted'
              )}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'p-2 rounded-lg',
                        key.status === 'active' ? 'bg-emerald-500/20 text-emerald-600' :
                        key.status === 'expired' ? 'bg-red-500/20 text-red-600' : 'bg-muted text-muted-foreground'
                      )}>
                        {key.keyType === 'mobile' ? <Fingerprint className="h-4 w-4" /> : <QrCode className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className="font-medium">Room {key.roomNumber}</p>
                        <p className="text-xs text-muted-foreground capitalize">{key.keyType} key</p>
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-white',
                        key.status === 'active' ? 'bg-emerald-500' :
                        key.status === 'expired' ? 'bg-red-500' : 'bg-gray-500'
                      )}
                    >
                      {key.status}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Access Count</span>
                      <span className="font-medium">{key.accessCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Expires</span>
                      <span className="font-medium">{format(new Date(key.expiresAt), 'MMM d, yyyy')}</span>
                    </div>
                    {key.batteryLevel !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Device Battery</span>
                        <div className="flex items-center gap-1">
                          <Battery className={cn('h-4 w-4', key.batteryLevel < 20 ? 'text-red-500' : 'text-emerald-500')} />
                          <span className="font-medium">{key.batteryLevel}%</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator className="my-3" />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={key.status === 'active'}
                        onCheckedChange={(checked) => handleToggleKeyStatus(key.id, checked)}
                        disabled={key.status === 'expired'}
                      />
                      <span className="text-sm text-muted-foreground">
                        {key.status === 'active' ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedKey(key);
                        setIsKeyDialogOpen(true);
                      }}
                    >
                      Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5 text-cyan-500" />
            Notification Settings
          </CardTitle>
          <CardDescription>Configure how the guest receives notifications</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-4">
              {['app', 'email', 'sms'].map(channel => (
                <div key={channel}>
                  <h4 className="text-sm font-medium capitalize mb-2 flex items-center gap-2">
                    {channel === 'app' && <Smartphone className="h-4 w-4 text-muted-foreground" />}
                    {channel === 'email' && <Mail className="h-4 w-4 text-muted-foreground" />}
                    {channel === 'sms' && <MessageSquare className="h-4 w-4 text-muted-foreground" />}
                    {channel === 'app' ? 'In-App' : channel === 'email' ? 'Email' : 'SMS'} Notifications
                  </h4>
                  <div className="space-y-2 pl-6">
                    {appData.notificationSettings
                      .filter(s => s.channel === channel)
                      .map(setting => (
                        <div
                          key={setting.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <div>
                            <p className="text-sm font-medium">{setting.label}</p>
                            <p className="text-xs text-muted-foreground">{setting.description}</p>
                          </div>
                          <Switch
                            checked={setting.enabled}
                            onCheckedChange={(checked) => handleNotificationToggle(setting.id, checked)}
                          />
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Feature Toggles */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="h-5 w-5 text-violet-500" />
                App Features
              </CardTitle>
              <CardDescription>Enable or disable app features for this guest</CardDescription>
            </div>
            <Select value={activeCategory} onValueChange={setActiveCategory}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Features</SelectItem>
                {featureCategories.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
            {filteredFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={feature.id}
                  className={cn(
                    'transition-all',
                    feature.enabled ? 'border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/10' : ''
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'p-2 rounded-lg',
                          feature.enabled ? 'bg-emerald-500/20 text-emerald-600' : 'bg-muted text-muted-foreground'
                        )}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{feature.name}</p>
                          <p className="text-xs text-muted-foreground">{feature.description}</p>
                        </div>
                      </div>
                      <Switch
                        checked={feature.enabled}
                        onCheckedChange={(checked) => handleFeatureToggle(feature.id, checked)}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Device Permissions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-500" />
            Device Permissions
          </CardTitle>
          <CardDescription>Required permissions for app functionality</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'p-2 rounded-lg',
                  appData.deviceInfo.notificationsEnabled ? 'bg-emerald-500/20 text-emerald-600' : 'bg-red-500/20 text-red-600'
                )}>
                  <Bell className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium text-sm">Notifications</p>
                  <p className="text-xs text-muted-foreground">Push notifications</p>
                </div>
              </div>
              {appData.deviceInfo.notificationsEnabled ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'p-2 rounded-lg',
                  appData.deviceInfo.locationEnabled ? 'bg-emerald-500/20 text-emerald-600' : 'bg-amber-500/20 text-amber-600'
                )}>
                  <Globe className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium text-sm">Location</p>
                  <p className="text-xs text-muted-foreground">For nearby services</p>
                </div>
              </div>
              {appData.deviceInfo.locationEnabled ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              )}
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-600">
                  <Wifi className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium text-sm">WiFi</p>
                  <p className="text-xs text-muted-foreground">Auto-connect to hotel WiFi</p>
                </div>
              </div>
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-600">
                  <Key className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium text-sm">Bluetooth</p>
                  <p className="text-xs text-muted-foreground">For digital room key</p>
                </div>
              </div>
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Detail Dialog */}
      <Dialog open={isKeyDialogOpen} onOpenChange={setIsKeyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Digital Key Details
            </DialogTitle>
          </DialogHeader>
          {selectedKey && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-lg">Room {selectedKey.roomNumber}</h3>
                  <p className="text-sm text-muted-foreground capitalize">{selectedKey.keyType} key</p>
                </div>
                <Badge
                  variant="secondary"
                  className={cn(
                    'text-white',
                    selectedKey.status === 'active' ? 'bg-emerald-500' :
                    selectedKey.status === 'expired' ? 'bg-red-500' : 'bg-gray-500'
                  )}
                >
                  {selectedKey.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Access Count</p>
                  <p className="font-medium">{selectedKey.accessCount}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Expires</p>
                  <p className="font-medium">{format(new Date(selectedKey.expiresAt), 'MMM d, yyyy')}</p>
                </div>
                {selectedKey.lastUsed && (
                  <div>
                    <p className="text-muted-foreground">Last Used</p>
                    <p className="font-medium">
                      {formatDistanceToNow(new Date(selectedKey.lastUsed), { addSuffix: true })}
                    </p>
                  </div>
                )}
                {selectedKey.deviceId && (
                  <div>
                    <p className="text-muted-foreground">Device ID</p>
                    <p className="font-medium font-mono text-xs">{selectedKey.deviceId.slice(0, 12)}...</p>
                  </div>
                )}
              </div>

              {selectedKey.batteryLevel !== undefined && (
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Device Battery</span>
                    <span className="text-sm">{selectedKey.batteryLevel}%</span>
                  </div>
                  <Progress value={selectedKey.batteryLevel} className="h-2" />
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleRegenerateKey}
                  disabled={isRegenerating}
                >
                  {isRegenerating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Regenerate
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => useUIStore.getState().setActiveSection('experience-keys')}>
                  <QrCode className="h-4 w-4 mr-2" />
                  QR Code
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
