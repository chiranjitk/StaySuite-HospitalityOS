'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Bell, Mail, MessageSquare, Smartphone, Clock, Save } from 'lucide-react';
import { toast } from 'sonner';

interface NotificationSettings {
  email: {
    enabled: boolean;
    provider: string;
    fromAddress: string;
    fromName: string;
    replyTo: string;
    trackOpens: boolean;
    trackClicks: boolean;
  };
  sms: {
    enabled: boolean;
    provider: string;
    fromNumber: string;
    alphanumericSenderId: string;
  };
  push: {
    enabled: boolean;
    provider: string;
    projectId: string;
  };
  inApp: {
    enabled: boolean;
    persistNotifications: boolean;
    retentionDays: number;
  };
  triggers: {
    bookingConfirmation: { email: boolean; sms: boolean; push: boolean };
    checkInReminder: { email: boolean; sms: boolean; push: boolean };
    checkOutReminder: { email: boolean; sms: boolean; push: boolean };
    paymentReceipt: { email: boolean; sms: boolean; push: boolean };
    roomReady: { email: boolean; sms: boolean; push: boolean };
    marketingOffers: { email: boolean; sms: boolean; push: boolean };
  };
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
    timezone: string;
  };
}

export default function NotificationSettingsComponent() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/notifications/settings');
      const data = await response.json();
      if (data.success) {
        setSettings(data.data);
      }
    } catch {
      toast.error('Failed to fetch notification settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    
    setSaving(true);
    try {
      const response = await fetch('/api/notifications/settings', {
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

  const updateTrigger = (trigger: keyof NotificationSettings['triggers'], channel: 'email' | 'sms' | 'push', value: boolean) => {
    if (!settings) return;
    setSettings({
      ...settings,
      triggers: {
        ...settings.triggers,
        [trigger]: { ...settings.triggers[trigger], [channel]: value },
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
          <h2 className="text-2xl font-bold tracking-tight">Notification Settings</h2>
          <p className="text-muted-foreground">Configure notification channels and triggers</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>

      {/* Channel Settings */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Email Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Enable Email Notifications</Label>
              <Switch checked={settings.email.enabled} onCheckedChange={(v) => setSettings({ ...settings, email: { ...settings.email, enabled: v } })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select value={settings.email.provider} onValueChange={(v) => setSettings({ ...settings, email: { ...settings.email, provider: v } })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sendgrid">SendGrid</SelectItem>
                    <SelectItem value="mailgun">Mailgun</SelectItem>
                    <SelectItem value="ses">AWS SES</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>From Address</Label>
                <Input value={settings.email.fromAddress} onChange={(e) => setSettings({ ...settings, email: { ...settings.email, fromAddress: e.target.value } })} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Track Opens</Label>
              <Switch checked={settings.email.trackOpens} onCheckedChange={(v) => setSettings({ ...settings, email: { ...settings.email, trackOpens: v } })} />
            </div>
          </CardContent>
        </Card>

        {/* SMS Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              SMS Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Enable SMS Notifications</Label>
              <Switch checked={settings.sms.enabled} onCheckedChange={(v) => setSettings({ ...settings, sms: { ...settings.sms, enabled: v } })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select value={settings.sms.provider} onValueChange={(v) => setSettings({ ...settings, sms: { ...settings.sms, provider: v } })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="twilio">Twilio</SelectItem>
                    <SelectItem value="nexmo">Nexmo</SelectItem>
                    <SelectItem value="plivo">Plivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>From Number</Label>
                <Input value={settings.sms.fromNumber} onChange={(e) => setSettings({ ...settings, sms: { ...settings.sms, fromNumber: e.target.value } })} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Push Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Push Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Enable Push Notifications</Label>
              <Switch checked={settings.push.enabled} onCheckedChange={(v) => setSettings({ ...settings, push: { ...settings.push, enabled: v } })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select value={settings.push.provider} onValueChange={(v) => setSettings({ ...settings, push: { ...settings.push, provider: v } })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="firebase">Firebase</SelectItem>
                    <SelectItem value="onesignal">OneSignal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Project ID</Label>
                <Input value={settings.push.projectId} onChange={(e) => setSettings({ ...settings, push: { ...settings.push, projectId: e.target.value } })} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quiet Hours */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Quiet Hours
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Enable Quiet Hours</Label>
              <Switch checked={settings.quietHours.enabled} onCheckedChange={(v) => setSettings({ ...settings, quietHours: { ...settings.quietHours, enabled: v } })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input type="time" value={settings.quietHours.start} onChange={(e) => setSettings({ ...settings, quietHours: { ...settings.quietHours, start: e.target.value } })} />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input type="time" value={settings.quietHours.end} onChange={(e) => setSettings({ ...settings, quietHours: { ...settings.quietHours, end: e.target.value } })} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trigger Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Triggers</CardTitle>
          <CardDescription>Configure which notifications are sent for each event</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead className="text-center">Email</TableHead>
                <TableHead className="text-center">SMS</TableHead>
                <TableHead className="text-center">Push</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(settings.triggers).map(([key, value]) => (
                <TableRow key={key}>
                  <TableCell className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</TableCell>
                  <TableCell className="text-center">
                    <Switch checked={value.email} onCheckedChange={(v) => updateTrigger(key as keyof NotificationSettings['triggers'], 'email', v)} />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch checked={value.sms} onCheckedChange={(v) => updateTrigger(key as keyof NotificationSettings['triggers'], 'sms', v)} />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch checked={value.push} onCheckedChange={(v) => updateTrigger(key as keyof NotificationSettings['triggers'], 'push', v)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
