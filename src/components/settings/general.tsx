'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, Building2, Clock, Bell, Globe, Save, Info, DollarSign, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings } from '@/contexts/SettingsContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTimezone } from '@/contexts/TimezoneContext';
import { SectionGuard } from '@/components/common/section-guard';

// Comprehensive timezone list organized by region
const TIMEZONES = [
  { group: 'India', options: [
    { value: 'Asia/Kolkata', label: 'India Standard Time (IST)' },
  ]},
  { group: 'Asia', options: [
    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
    { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)' },
    { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'Asia/Seoul', label: 'Seoul (KST)' },
    { value: 'Asia/Bangkok', label: 'Bangkok (ICT)' },
    { value: 'Asia/Jakarta', label: 'Jakarta (WIB)' },
  ]},
  { group: 'Europe', options: [
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'Europe/Paris', label: 'Paris (CET)' },
    { value: 'Europe/Berlin', label: 'Berlin (CET)' },
    { value: 'Europe/Rome', label: 'Rome (CET)' },
    { value: 'Europe/Amsterdam', label: 'Amsterdam (CET)' },
    { value: 'Europe/Moscow', label: 'Moscow (MSK)' },
  ]},
  { group: 'North America', options: [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'America/Phoenix', label: 'Arizona (MST)' },
    { value: 'America/Toronto', label: 'Toronto (ET)' },
    { value: 'America/Vancouver', label: 'Vancouver (PT)' },
  ]},
  { group: 'South America', options: [
    { value: 'America/Sao_Paulo', label: 'São Paulo (BRT)' },
    { value: 'America/Buenos_Aires', label: 'Buenos Aires (ART)' },
    { value: 'America/Lima', label: 'Lima (PET)' },
  ]},
  { group: 'Australia & Pacific', options: [
    { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
    { value: 'Australia/Melbourne', label: 'Melbourne (AEST)' },
    { value: 'Australia/Perth', label: 'Perth (AWST)' },
    { value: 'Pacific/Auckland', label: 'Auckland (NZST)' },
  ]},
  { group: 'Middle East & Africa', options: [
    { value: 'Africa/Cairo', label: 'Cairo (EET)' },
    { value: 'Africa/Johannesburg', label: 'Johannesburg (SAST)' },
    { value: 'Africa/Lagos', label: 'Lagos (WAT)' },
    { value: 'Asia/Riyadh', label: 'Riyadh (AST)' },
    { value: 'Asia/Jerusalem', label: 'Jerusalem (IST)' },
  ]},
  { group: 'UTC', options: [
    { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  ]},
];

// Comprehensive currency list
const CURRENCIES = [
  { group: 'Indian Subcontinent', options: [
    { value: 'INR', label: 'INR (₹) - Indian Rupee' },
    { value: 'PKR', label: 'PKR (Rs) - Pakistani Rupee' },
    { value: 'BDT', label: 'BDT (৳) - Bangladeshi Taka' },
    { value: 'LKR', label: 'LKR (Rs) - Sri Lankan Rupee' },
    { value: 'NPR', label: 'NPR (Rs) - Nepalese Rupee' },
  ]},
  { group: 'Asia Pacific', options: [
    { value: 'CNY', label: 'CNY (¥) - Chinese Yuan' },
    { value: 'JPY', label: 'JPY (¥) - Japanese Yen' },
    { value: 'KRW', label: 'KRW (₩) - South Korean Won' },
    { value: 'SGD', label: 'SGD (S$) - Singapore Dollar' },
    { value: 'HKD', label: 'HKD (HK$) - Hong Kong Dollar' },
    { value: 'THB', label: 'THB (฿) - Thai Baht' },
    { value: 'VND', label: 'VND (₫) - Vietnamese Dong' },
    { value: 'MYR', label: 'MYR (RM) - Malaysian Ringgit' },
    { value: 'IDR', label: 'IDR (Rp) - Indonesian Rupiah' },
    { value: 'PHP', label: 'PHP (₱) - Philippine Peso' },
  ]},
  { group: 'Europe', options: [
    { value: 'EUR', label: 'EUR (€) - Euro' },
    { value: 'GBP', label: 'GBP (£) - British Pound' },
    { value: 'CHF', label: 'CHF (Fr) - Swiss Franc' },
    { value: 'SEK', label: 'SEK (kr) - Swedish Krona' },
    { value: 'NOK', label: 'NOK (kr) - Norwegian Krone' },
    { value: 'DKK', label: 'DKK (kr) - Danish Krone' },
    { value: 'PLN', label: 'PLN (zł) - Polish Zloty' },
    { value: 'TRY', label: 'TRY (₺) - Turkish Lira' },
    { value: 'RUB', label: 'RUB (₽) - Russian Ruble' },
  ]},
  { group: 'Americas', options: [
    { value: 'USD', label: 'USD ($) - US Dollar' },
    { value: 'CAD', label: 'CAD (C$) - Canadian Dollar' },
    { value: 'MXN', label: 'MXN ($) - Mexican Peso' },
    { value: 'BRL', label: 'BRL (R$) - Brazilian Real' },
    { value: 'ARS', label: 'ARS ($) - Argentine Peso' },
    { value: 'CLP', label: 'CLP ($) - Chilean Peso' },
    { value: 'COP', label: 'COP ($) - Colombian Peso' },
    { value: 'PEN', label: 'PEN (S/) - Peruvian Sol' },
  ]},
  { group: 'Middle East & Africa', options: [
    { value: 'AED', label: 'AED (د.إ) - UAE Dirham' },
    { value: 'SAR', label: 'SAR (﷼) - Saudi Riyal' },
    { value: 'QAR', label: 'QAR (﷼) - Qatari Riyal' },
    { value: 'KWD', label: 'KWD (د.ك) - Kuwaiti Dinar' },
    { value: 'BHD', label: 'BHD (د.ب) - Bahraini Dinar' },
    { value: 'EGP', label: 'EGP (£) - Egyptian Pound' },
    { value: 'ZAR', label: 'ZAR (R) - South African Rand' },
    { value: 'NGN', label: 'NGN (₦) - Nigerian Naira' },
    { value: 'KES', label: 'KES (KSh) - Kenyan Shilling' },
  ]},
  { group: 'Oceania', options: [
    { value: 'AUD', label: 'AUD (A$) - Australian Dollar' },
    { value: 'NZD', label: 'NZD (NZ$) - New Zealand Dollar' },
  ]},
];

interface GeneralSettings {
  property: {
    name: string;
    legalName: string;
    description: string;
    website: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    country: string;
    postalCode: string;
  };
  operations: {
    checkInTime: string;
    checkOutTime: string;
    timezone: string;
    defaultCurrency: string;
    dateFormat: string;
    timeFormat: '12h' | '24h';
  };
  notifications: {
    emailNotifications: boolean;
    smsNotifications: boolean;
    pushNotifications: boolean;
    weeklyReport: boolean;
    dailyDigest: boolean;
  };
}

export default function GeneralSettingsComponent() {
  const [settings, setSettings] = useState<GeneralSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { refreshAllSettings } = useSettings();
  const { currency } = useCurrency();
  const { settings: tzSettings } = useTimezone();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings/general');
      const data = await response.json();
      if (data.success) {
        setSettings(data.data);
      }
    } catch {
      toast.error('Failed to fetch general settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    
    setSaving(true);
    try {
      const response = await fetch('/api/settings/general', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        toast.success('Settings saved successfully');
        setHasChanges(false);
        // Refresh all contexts to apply new currency and timezone settings
        await refreshAllSettings();
      }
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateProperty = (key: string, value: string) => {
    if (!settings) return;
    setSettings({ ...settings, property: { ...settings.property, [key]: value } });
  };

  const updateOperations = (key: string, value: string) => {
    if (!settings) return;
    setSettings({ ...settings, operations: { ...settings.operations, [key]: value } });
    setHasChanges(true);
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <SectionGuard permission="settings.view">
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text">General Settings</h2>
          <p className="text-muted-foreground">Configure your property information and preferences</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200">
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>

      {/* Gradient section divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* Property Information */}
      <Card className="border-0 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 p-2 transition-transform duration-300 group-hover:scale-110">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Property Information</CardTitle>
              <CardDescription>Basic information about your property</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Property Name</Label>
              <Input value={settings.property.name} onChange={(e) => updateProperty('name', e.target.value)} className="transition-all duration-300 focus:ring-2 focus:ring-primary/10 hover:border-primary/30 rounded-xl hover:shadow-sm focus:shadow-md focus:shadow-primary/5" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Legal Name</Label>
              <Input value={settings.property.legalName} onChange={(e) => updateProperty('legalName', e.target.value)} className="transition-all duration-300 focus:ring-2 focus:ring-primary/10 hover:border-primary/30 rounded-xl hover:shadow-sm focus:shadow-md focus:shadow-primary/5" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Description</Label>
            <Input value={settings.property.description} onChange={(e) => updateProperty('description', e.target.value)} className="transition-all duration-300 focus:ring-2 focus:ring-primary/10 hover:border-primary/30 rounded-xl hover:shadow-sm focus:shadow-md focus:shadow-primary/5" />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Website</Label>
              <Input value={settings.property.website} onChange={(e) => updateProperty('website', e.target.value)} className="transition-all duration-300 focus:ring-2 focus:ring-primary/10 hover:border-primary/30 rounded-xl hover:shadow-sm focus:shadow-md focus:shadow-primary/5" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Email</Label>
              <Input type="email" value={settings.property.email} onChange={(e) => updateProperty('email', e.target.value)} className="transition-all duration-300 focus:ring-2 focus:ring-primary/10 hover:border-primary/30 rounded-xl hover:shadow-sm focus:shadow-md focus:shadow-primary/5" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Phone</Label>
              <Input value={settings.property.phone} onChange={(e) => updateProperty('phone', e.target.value)} className="transition-all duration-300 focus:ring-2 focus:ring-primary/10 hover:border-primary/30 rounded-xl hover:shadow-sm focus:shadow-md focus:shadow-primary/5" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Address</Label>
              <Input value={settings.property.address} onChange={(e) => updateProperty('address', e.target.value)} className="transition-all duration-300 focus:ring-2 focus:ring-primary/10 hover:border-primary/30 rounded-xl hover:shadow-sm focus:shadow-md focus:shadow-primary/5" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">City</Label>
              <Input value={settings.property.city} onChange={(e) => updateProperty('city', e.target.value)} className="transition-all duration-300 focus:ring-2 focus:ring-primary/10 hover:border-primary/30 rounded-xl hover:shadow-sm focus:shadow-md focus:shadow-primary/5" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Country</Label>
              <Select value={settings.property.country} onValueChange={(v) => updateProperty('country', v)}>
                <SelectTrigger className="rounded-xl transition-all duration-300 hover:border-primary/30 focus:ring-2 focus:ring-primary/10 hover:shadow-sm focus:shadow-md focus:shadow-primary/5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="United States">United States</SelectItem>
                  <SelectItem value="Canada">Canada</SelectItem>
                  <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                  <SelectItem value="Australia">Australia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Postal Code</Label>
              <Input value={settings.property.postalCode} onChange={(e) => updateProperty('postalCode', e.target.value)} className="transition-all duration-300 focus:ring-2 focus:ring-primary/10 hover:border-primary/30 rounded-xl hover:shadow-sm focus:shadow-md focus:shadow-primary/5" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gradient section divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* Operations Settings */}
      <Card className="border-0 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-2">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <CardTitle>Operations</CardTitle>
              <CardDescription>Configure check-in/out times and operational preferences</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Check-in Time</Label>
              <Input type="time" value={settings.operations.checkInTime} onChange={(e) => updateOperations('checkInTime', e.target.value)} className="transition-all duration-200 focus:ring-2 focus:ring-amber-400/10 hover:border-amber-300/50 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Check-out Time</Label>
              <Input type="time" value={settings.operations.checkOutTime} onChange={(e) => updateOperations('checkOutTime', e.target.value)} className="transition-all duration-200 focus:ring-2 focus:ring-amber-400/10 hover:border-amber-300/50 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select value={settings.operations.timezone} onValueChange={(v) => updateOperations('timezone', v)}>
                <SelectTrigger className="rounded-xl transition-all duration-200 hover:border-primary/30 focus:ring-2 focus:ring-primary/10"><SelectValue placeholder="Select timezone" /></SelectTrigger>
                <SelectContent className="max-h-80">
                  {TIMEZONES.map((group) => (
                    <div key={group.group}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                        {group.group}
                      </div>
                      {group.options.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Default Currency</Label>
              <Select value={settings.operations.defaultCurrency} onValueChange={(v) => updateOperations('defaultCurrency', v)}>
                <SelectTrigger className="rounded-xl transition-all duration-200 hover:border-primary/30 focus:ring-2 focus:ring-primary/10"><SelectValue placeholder="Select currency" /></SelectTrigger>
                <SelectContent className="max-h-80">
                  {CURRENCIES.map((group) => (
                    <div key={group.group}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                        {group.group}
                      </div>
                      {group.options.map((curr) => (
                        <SelectItem key={curr.value} value={curr.value}>
                          {curr.label}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date Format</Label>
              <Select value={settings.operations.dateFormat} onValueChange={(v) => updateOperations('dateFormat', v)}>
                <SelectTrigger className="rounded-xl transition-all duration-200 hover:border-primary/30 focus:ring-2 focus:ring-primary/10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                  <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                  <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Time Format</Label>
              <Select value={settings.operations.timeFormat} onValueChange={(v) => updateOperations('timeFormat', v)}>
                <SelectTrigger className="rounded-xl transition-all duration-200 hover:border-primary/30 focus:ring-2 focus:ring-primary/10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="12h">12-hour (AM/PM)</SelectItem>
                  <SelectItem value="24h">24-hour</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications Settings */}
      <Card className="border-0 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 p-2">
              <Bell className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Configure how you receive notifications</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors duration-200 -mx-1">
            <div>
              <Label className="cursor-pointer">Email Notifications</Label>
              <p className="text-sm text-muted-foreground">Receive notifications via email</p>
            </div>
            <Switch
              checked={settings.notifications.emailNotifications}
              onCheckedChange={(checked) => {
                setSettings({
                  ...settings,
                  notifications: { ...settings.notifications, emailNotifications: checked },
                });
                setHasChanges(true);
              }}
              className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-primary data-[state=checked]:to-primary/80 data-[state=checked]:border-primary transition-all duration-300 data-[state=checked]:shadow-md data-[state=checked]:shadow-primary/20"
            />
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors duration-200 -mx-1">
            <div>
              <Label className="cursor-pointer">SMS Notifications</Label>
              <p className="text-sm text-muted-foreground">Receive notifications via SMS</p>
            </div>
            <Switch
              checked={settings.notifications.smsNotifications}
              onCheckedChange={(checked) => {
                setSettings({
                  ...settings,
                  notifications: { ...settings.notifications, smsNotifications: checked },
                });
                setHasChanges(true);
              }}
              className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-primary data-[state=checked]:to-primary/80 data-[state=checked]:border-primary transition-all duration-300 data-[state=checked]:shadow-md data-[state=checked]:shadow-primary/20"
            />
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors duration-200 -mx-1">
            <div>
              <Label className="cursor-pointer">Push Notifications</Label>
              <p className="text-sm text-muted-foreground">Receive push notifications in browser</p>
            </div>
            <Switch
              checked={settings.notifications.pushNotifications}
              onCheckedChange={(checked) => {
                setSettings({
                  ...settings,
                  notifications: { ...settings.notifications, pushNotifications: checked },
                });
                setHasChanges(true);
              }}
              className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-primary data-[state=checked]:to-primary/80 data-[state=checked]:border-primary transition-all duration-300 data-[state=checked]:shadow-md data-[state=checked]:shadow-primary/20"
            />
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors duration-200 -mx-1">
            <div>
              <Label className="cursor-pointer">Weekly Report</Label>
              <p className="text-sm text-muted-foreground">Receive a weekly summary report</p>
            </div>
            <Switch
              checked={settings.notifications.weeklyReport}
              onCheckedChange={(checked) => {
                setSettings({
                  ...settings,
                  notifications: { ...settings.notifications, weeklyReport: checked },
                });
                setHasChanges(true);
              }}
              className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-primary data-[state=checked]:to-primary/80 data-[state=checked]:border-primary transition-all duration-300 data-[state=checked]:shadow-md data-[state=checked]:shadow-primary/20"
            />
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors duration-200 -mx-1">
            <div>
              <Label className="cursor-pointer">Daily Digest</Label>
              <p className="text-sm text-muted-foreground">Receive a daily digest of activity</p>
            </div>
            <Switch
              checked={settings.notifications.dailyDigest}
              onCheckedChange={(checked) => {
                setSettings({
                  ...settings,
                  notifications: { ...settings.notifications, dailyDigest: checked },
                });
                setHasChanges(true);
              }}
              className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-primary data-[state=checked]:to-primary/80 data-[state=checked]:border-primary transition-all duration-300 data-[state=checked]:shadow-md data-[state=checked]:shadow-primary/20"
            />
          </div>
        </CardContent>
      </Card>

      {/* Settings Impact Information */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Currency Impact */}
        <Card className="border-0 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 rounded-2xl bg-gradient-to-br from-emerald-50/50 to-transparent dark:from-emerald-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 p-1.5">
                <DollarSign className="h-4 w-4 text-emerald-500" />
              </div>
              Currency Setting Impact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Current: <Badge variant="secondary">{currency.code} ({currency.symbol})</Badge>
              </AlertDescription>
            </Alert>
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">Affects all monetary displays across:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Dashboard revenue cards & charts</li>
                <li>Booking rates & folios</li>
                <li>Invoices & payments</li>
                <li>POS orders & menu prices</li>
                <li>Reports & analytics</li>
                <li>Channel rate synchronization</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Timezone & Format Impact */}
        <Card className="border-0 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 rounded-2xl bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-500/5 p-1.5">
                <Calendar className="h-4 w-4 text-blue-500" />
              </div>
              Timezone & Format Impact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Timezone: <Badge variant="secondary">{tzSettings.timezone}</Badge>
                <span className="mx-2">|</span>
                Format: <Badge variant="secondary">{tzSettings.dateFormat}</Badge>
              </AlertDescription>
            </Alert>
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">Affects all date/time displays across:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Check-in/Check-out times</li>
                <li>Booking calendar views</li>
                <li>Night audit scheduling</li>
                <li>Report date boundaries</li>
                <li>Guest portal timestamps</li>
                <li>Automated task scheduling</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </SectionGuard>
  );
}
