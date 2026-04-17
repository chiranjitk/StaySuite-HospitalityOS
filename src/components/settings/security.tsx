'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Shield, Key, Lock, Save, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { SectionGuard } from '@/components/common/section-guard';

interface SecuritySettings {
  authentication: {
    mfaEnabled: boolean;
    mfaMethod: string;
    ssoEnabled: boolean;
    ssoProvider: string | null;
    passwordPolicy: {
      minLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumbers: boolean;
      requireSpecialChars: boolean;
      expiryDays: number;
      preventReuse: number;
    };
    sessionTimeout: number;
    maxConcurrentSessions: number;
  };
  accessControl: {
    ipWhitelist: string[];
    ipBlacklist: string[];
    allowedCountries: string[];
    vpnDetection: boolean;
  };
  dataProtection: {
    encryptionAtRest: boolean;
    encryptionInTransit: boolean;
    dataRetentionDays: number;
    anonymizeOnDelete: boolean;
    auditLogging: boolean;
  };
  apiSecurity: {
    rateLimiting: boolean;
    requestsPerMinute: number;
    apiKeyRotation: boolean;
    rotationDays: number;
  };
  compliance: {
    pciDss: boolean;
    gdpr: boolean;
    ccpa: boolean;
    dataProcessingAgreement: boolean;
  };
  recentActivity: Array<{ action: string; user: string; time: string }>;
}

export default function SecuritySettings() {
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings/security');
      const data = await response.json();
      if (data.success) {
        setSettings(data.data);
      }
    } catch {
      toast.error('Failed to fetch security settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    
    setSaving(true);
    try {
      const response = await fetch('/api/settings/security', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        toast.success('Security settings saved successfully');
      }
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <SectionGuard permission="settings.manage">
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Security Settings</h2>
          <p className="text-muted-foreground">Configure security and access control settings</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>

      {/* Authentication Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Authentication
          </CardTitle>
          <CardDescription>Configure authentication methods and policies</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">Multi-Factor Authentication</p>
                <p className="text-sm text-muted-foreground">Require MFA for all users</p>
              </div>
              <Switch checked={settings.authentication.mfaEnabled} onCheckedChange={(v) => setSettings({ ...settings, authentication: { ...settings.authentication, mfaEnabled: v } })} />
            </div>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">Single Sign-On (SSO)</p>
                <p className="text-sm text-muted-foreground">Enable SSO integration</p>
              </div>
              <Switch checked={settings.authentication.ssoEnabled} onCheckedChange={(v) => setSettings({ ...settings, authentication: { ...settings.authentication, ssoEnabled: v } })} />
            </div>
          </div>
          
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>MFA Method</Label>
              <Select value={settings.authentication.mfaMethod} onValueChange={(v) => setSettings({ ...settings, authentication: { ...settings.authentication, mfaMethod: v } })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="totp">Authenticator App</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Session Timeout (minutes)</Label>
              <Input type="number" value={settings.authentication.sessionTimeout} onChange={(e) => setSettings({ ...settings, authentication: { ...settings.authentication, sessionTimeout: parseInt(e.target.value) } })} />
            </div>
            <div className="space-y-2">
              <Label>Max Concurrent Sessions</Label>
              <Input type="number" value={settings.authentication.maxConcurrentSessions} onChange={(e) => setSettings({ ...settings, authentication: { ...settings.authentication, maxConcurrentSessions: parseInt(e.target.value) } })} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Password Policy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Password Policy
          </CardTitle>
          <CardDescription>Configure password requirements</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Minimum Length</Label>
              <Input type="number" value={settings.authentication.passwordPolicy.minLength} onChange={(e) => setSettings({ ...settings, authentication: { ...settings.authentication, passwordPolicy: { ...settings.authentication.passwordPolicy, minLength: parseInt(e.target.value) } } })} />
            </div>
            <div className="space-y-2">
              <Label>Password Expiry (days)</Label>
              <Input type="number" value={settings.authentication.passwordPolicy.expiryDays} onChange={(e) => setSettings({ ...settings, authentication: { ...settings.authentication, passwordPolicy: { ...settings.authentication.passwordPolicy, expiryDays: parseInt(e.target.value) } } })} />
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-4">
            <div className="flex items-center space-x-2">
              <Switch checked={settings.authentication.passwordPolicy.requireUppercase} onCheckedChange={(v) => setSettings({ ...settings, authentication: { ...settings.authentication, passwordPolicy: { ...settings.authentication.passwordPolicy, requireUppercase: v } } })} />
              <Label>Uppercase</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch checked={settings.authentication.passwordPolicy.requireLowercase} onCheckedChange={(v) => setSettings({ ...settings, authentication: { ...settings.authentication, passwordPolicy: { ...settings.authentication.passwordPolicy, requireLowercase: v } } })} />
              <Label>Lowercase</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch checked={settings.authentication.passwordPolicy.requireNumbers} onCheckedChange={(v) => setSettings({ ...settings, authentication: { ...settings.authentication, passwordPolicy: { ...settings.authentication.passwordPolicy, requireNumbers: v } } })} />
              <Label>Numbers</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch checked={settings.authentication.passwordPolicy.requireSpecialChars} onCheckedChange={(v) => setSettings({ ...settings, authentication: { ...settings.authentication, passwordPolicy: { ...settings.authentication.passwordPolicy, requireSpecialChars: v } } })} />
              <Label>Special Chars</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Protection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Data Protection
          </CardTitle>
          <CardDescription>Configure data security settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">Encryption at Rest</p>
                <p className="text-sm text-muted-foreground">Encrypt stored data</p>
              </div>
              <Switch checked={settings.dataProtection.encryptionAtRest} onCheckedChange={(v) => setSettings({ ...settings, dataProtection: { ...settings.dataProtection, encryptionAtRest: v } })} />
            </div>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">Encryption in Transit</p>
                <p className="text-sm text-muted-foreground">TLS/SSL encryption</p>
              </div>
              <Switch checked={settings.dataProtection.encryptionInTransit} onCheckedChange={(v) => setSettings({ ...settings, dataProtection: { ...settings.dataProtection, encryptionInTransit: v } })} />
            </div>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">Audit Logging</p>
                <p className="text-sm text-muted-foreground">Log all security events</p>
              </div>
              <Switch checked={settings.dataProtection.auditLogging} onCheckedChange={(v) => setSettings({ ...settings, dataProtection: { ...settings.dataProtection, auditLogging: v } })} />
            </div>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">Anonymize on Delete</p>
                <p className="text-sm text-muted-foreground">Anonymize data when deleted</p>
              </div>
              <Switch checked={settings.dataProtection.anonymizeOnDelete} onCheckedChange={(v) => setSettings({ ...settings, dataProtection: { ...settings.dataProtection, anonymizeOnDelete: v } })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Data Retention Period (days)</Label>
            <Input type="number" value={settings.dataProtection.dataRetentionDays} onChange={(e) => setSettings({ ...settings, dataProtection: { ...settings.dataProtection, dataRetentionDays: parseInt(e.target.value) } })} />
          </div>
        </CardContent>
      </Card>

      {/* API Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            API Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">Rate Limiting</p>
                <p className="text-sm text-muted-foreground">Limit API requests</p>
              </div>
              <Switch checked={settings.apiSecurity.rateLimiting} onCheckedChange={(v) => setSettings({ ...settings, apiSecurity: { ...settings.apiSecurity, rateLimiting: v } })} />
            </div>
            <div className="space-y-2">
              <Label>Requests per Minute</Label>
              <Input type="number" value={settings.apiSecurity.requestsPerMinute} onChange={(e) => setSettings({ ...settings, apiSecurity: { ...settings.apiSecurity, requestsPerMinute: parseInt(e.target.value) } })} />
            </div>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">API Key Rotation</p>
                <p className="text-sm text-muted-foreground">Auto-rotate keys</p>
              </div>
              <Switch checked={settings.apiSecurity.apiKeyRotation} onCheckedChange={(v) => setSettings({ ...settings, apiSecurity: { ...settings.apiSecurity, apiKeyRotation: v } })} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compliance */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance</CardTitle>
          <CardDescription>Regulatory compliance settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">PCI DSS</p>
                <p className="text-sm text-muted-foreground">Payment Card Industry compliance</p>
              </div>
              <Badge variant={settings.compliance.pciDss ? 'default' : 'outline'} className={settings.compliance.pciDss ? 'bg-emerald-500' : ''}>
                {settings.compliance.pciDss ? 'Compliant' : 'Not Configured'}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">GDPR</p>
                <p className="text-sm text-muted-foreground">EU data protection</p>
              </div>
              <Badge variant={settings.compliance.gdpr ? 'default' : 'outline'} className={settings.compliance.gdpr ? 'bg-emerald-500' : ''}>
                {settings.compliance.gdpr ? 'Compliant' : 'Not Configured'}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">CCPA</p>
                <p className="text-sm text-muted-foreground">California privacy law</p>
              </div>
              <Badge variant={settings.compliance.ccpa ? 'default' : 'outline'} className={settings.compliance.ccpa ? 'bg-emerald-500' : ''}>
                {settings.compliance.ccpa ? 'Compliant' : 'Not Configured'}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">DPA</p>
                <p className="text-sm text-muted-foreground">Data Processing Agreement</p>
              </div>
              <Badge variant={settings.compliance.dataProcessingAgreement ? 'default' : 'outline'} className={settings.compliance.dataProcessingAgreement ? 'bg-emerald-500' : ''}>
                {settings.compliance.dataProcessingAgreement ? 'Signed' : 'Not Signed'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Security Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Security Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {settings.recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">{activity.action}</p>
                  <p className="text-sm text-muted-foreground">{activity.user}</p>
                </div>
                <span className="text-sm text-muted-foreground">{activity.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
    </SectionGuard>
  );
}
