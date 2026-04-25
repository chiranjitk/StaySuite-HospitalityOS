'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Globe, Languages, Save } from 'lucide-react';
import { toast } from 'sonner';
import { locales, localeNames, localeFlags, type Locale } from '@/i18n/config';

interface LocalizationSettings {
  language: {
    default: string;
    available: Array<{ code: string; name: string; native: string; enabled: boolean }>;
  };
  region: {
    timezone: string;
    country: string;
    locale: string;
  };
  formats: {
    dateFormat: string;
    timeFormat: string;
    firstDayOfWeek: number;
    numberFormat: {
      decimal: string;
      thousand: string;
      currency: string;
    };
  };
  translations: {
    autoTranslate: boolean;
    provider: string;
    defaultSourceLanguage: string;
  };
  guestFacing: {
    languageDetection: string;
    rememberPreference: boolean;
    showLanguageSelector: boolean;
  };
}

export default function LocalizationSettings() {
  const [settings, setSettings] = useState<LocalizationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings/localization');
      const data = await response.json();
      if (data.success) {
        setSettings(data.data);
      }
    } catch {
      toast.error('Failed to fetch localization settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    
    setSaving(true);
    try {
      const response = await fetch('/api/settings/localization', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        toast.success('Settings saved successfully');
      }
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const toggleLanguage = (code: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      language: {
        ...settings.language,
        available: settings.language.available.map(l => 
          l.code === code ? { ...l, enabled: !l.enabled } : l
        ),
      },
    });
  };

  if (loading || !settings) {
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
          <h2 className="text-2xl font-bold tracking-tight">Localization Settings</h2>
          <p className="text-muted-foreground">Configure languages, regions, and formats</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>

      {/* Language Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5" />
            Language Settings
          </CardTitle>
          <CardDescription>Configure default and available languages</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Default Language</Label>
            <Select value={settings.language.default} onValueChange={(v) => setSettings({ ...settings, language: { ...settings.language, default: v } })}>
              <SelectTrigger className="w-full md:w-[300px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {locales.map((locale) => (
                  <SelectItem key={locale} value={locale}>
                    <span className="flex items-center gap-2">
                      <span>{localeFlags[locale]}</span>
                      {localeNames[locale]}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="pt-4">
            <Label className="mb-4 block">Available Languages</Label>
            <div className="grid gap-2 md:grid-cols-2">
              {settings.language.available.map((lang) => (
                <div key={lang.code} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">{lang.name}</p>
                    <p className="text-sm text-muted-foreground">{lang.native}</p>
                  </div>
                  <Switch checked={lang.enabled} onCheckedChange={() => toggleLanguage(lang.code)} />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Region Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Region Settings
          </CardTitle>
          <CardDescription>Configure regional preferences</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select value={settings.region.timezone} onValueChange={(v) => setSettings({ ...settings, region: { ...settings.region, timezone: v } })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Asia/Kolkata">IST - India Standard Time (UTC+5:30)</SelectItem>
                  <SelectItem value="America/New_York">Eastern Time (ET) - New York</SelectItem>
                  <SelectItem value="America/Chicago">Central Time (CT) - Chicago</SelectItem>
                  <SelectItem value="America/Denver">Mountain Time (MT) - Denver</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific Time (PT) - Los Angeles</SelectItem>
                  <SelectItem value="Europe/London">London (GMT)</SelectItem>
                  <SelectItem value="Europe/Paris">Paris (CET)</SelectItem>
                  <SelectItem value="Asia/Dubai">GST - Gulf Standard Time (UTC+4)</SelectItem>
                  <SelectItem value="Asia/Singapore">SGT - Singapore Time (UTC+8)</SelectItem>
                  <SelectItem value="Asia/Tokyo">JST - Japan Standard Time (UTC+9)</SelectItem>
                  <SelectItem value="Australia/Sydney">AEST - Australian Eastern Time (UTC+10)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Select value={settings.region.country} onValueChange={(v) => setSettings({ ...settings, region: { ...settings.region, country: v } })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="IN">India</SelectItem>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="CA">Canada</SelectItem>
                  <SelectItem value="GB">United Kingdom</SelectItem>
                  <SelectItem value="AU">Australia</SelectItem>
                  <SelectItem value="AE">UAE</SelectItem>
                  <SelectItem value="SG">Singapore</SelectItem>
                  <SelectItem value="FR">France</SelectItem>
                  <SelectItem value="DE">Germany</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Locale</Label>
              <Select value={settings.region.locale} onValueChange={(v) => setSettings({ ...settings, region: { ...settings.region, locale: v } })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en-IN">English (India)</SelectItem>
                  <SelectItem value="en-US">English (US)</SelectItem>
                  <SelectItem value="en-GB">English (UK)</SelectItem>
                  <SelectItem value="hi-IN">Hindi (India)</SelectItem>
                  <SelectItem value="fr-FR">French</SelectItem>
                  <SelectItem value="de-DE">German</SelectItem>
                  <SelectItem value="es-ES">Spanish</SelectItem>
                  <SelectItem value="ar-AE">Arabic (UAE)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Guest-Facing Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Guest-Facing Settings</CardTitle>
          <CardDescription>Configure how guests experience language options</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">Auto Language Detection</p>
                <p className="text-sm text-muted-foreground">Detect language from browser settings</p>
              </div>
              <Switch checked={settings.guestFacing.languageDetection === 'browser'} onCheckedChange={(v) => setSettings({ ...settings, guestFacing: { ...settings.guestFacing, languageDetection: v ? 'browser' : 'default' } })} />
            </div>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">Remember Preference</p>
                <p className="text-sm text-muted-foreground">Save guest language preference</p>
              </div>
              <Switch checked={settings.guestFacing.rememberPreference} onCheckedChange={(v) => setSettings({ ...settings, guestFacing: { ...settings.guestFacing, rememberPreference: v } })} />
            </div>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">Show Language Selector</p>
                <p className="text-sm text-muted-foreground">Display language switcher</p>
              </div>
              <Switch checked={settings.guestFacing.showLanguageSelector} onCheckedChange={(v) => setSettings({ ...settings, guestFacing: { ...settings.guestFacing, showLanguageSelector: v } })} />
            </div>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">Auto Translate</p>
                <p className="text-sm text-muted-foreground">Automatically translate content</p>
              </div>
              <Switch checked={settings.translations.autoTranslate} onCheckedChange={(v) => setSettings({ ...settings, translations: { ...settings.translations, autoTranslate: v } })} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
