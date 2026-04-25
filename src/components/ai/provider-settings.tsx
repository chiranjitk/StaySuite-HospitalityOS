'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Loader2, Bot, Save, Key, Settings } from 'lucide-react';
import { toast } from 'sonner';

interface AIProvider {
  id: string;
  name: string;
  enabled: boolean;
  model: string;
  apiKey: string;
  temperature: number;
  maxTokens: number;
  usage: { total: number; limit: number; period: string };
}

interface AISettings {
  providers: AIProvider[];
  features: {
    copilotEnabled: boolean;
    insightsEnabled: boolean;
    recommendationsEnabled: boolean;
    autoTagging: boolean;
    sentimentAnalysis: boolean;
  };
  defaultProvider: string;
}

export default function AIProviderSettings() {
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/ai/provider-settings');
      const data = await response.json();
      if (data.success) {
        setSettings(data.data);
      }
    } catch {
      toast.error('Failed to fetch AI provider settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    
    setSaving(true);
    try {
      const response = await fetch('/api/ai/provider-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        toast.success('AI settings saved successfully');
      }
    } catch {
      toast.error('Failed to save AI settings');
    } finally {
      setSaving(false);
    }
  };

  const updateProvider = (id: string, key: keyof AIProvider, value: unknown) => {
    if (!settings) return;
    setSettings({
      ...settings,
      providers: settings.providers.map(p => 
        p.id === id ? { ...p, [key]: value } : p
      ),
    });
  };

  const updateFeature = (key: keyof AISettings['features'], value: boolean) => {
    if (!settings) return;
    setSettings({
      ...settings,
      features: { ...settings.features, [key]: value },
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
          <h2 className="text-2xl font-bold tracking-tight">AI Provider Settings</h2>
          <p className="text-muted-foreground">Configure AI providers and features</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>

      {/* AI Features */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Features
          </CardTitle>
          <CardDescription>Enable or disable AI-powered features</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">AI Copilot</p>
                <p className="text-sm text-muted-foreground">AI assistant for staff operations</p>
              </div>
              <Switch checked={settings.features.copilotEnabled} onCheckedChange={(v) => updateFeature('copilotEnabled', v)} />
            </div>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">AI Insights</p>
                <p className="text-sm text-muted-foreground">Automated insights and recommendations</p>
              </div>
              <Switch checked={settings.features.insightsEnabled} onCheckedChange={(v) => updateFeature('insightsEnabled', v)} />
            </div>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">Smart Recommendations</p>
                <p className="text-sm text-muted-foreground">Pricing and upsell suggestions</p>
              </div>
              <Switch checked={settings.features.recommendationsEnabled} onCheckedChange={(v) => updateFeature('recommendationsEnabled', v)} />
            </div>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">Sentiment Analysis</p>
                <p className="text-sm text-muted-foreground">Analyze guest feedback sentiment</p>
              </div>
              <Switch checked={settings.features.sentimentAnalysis} onCheckedChange={(v) => updateFeature('sentimentAnalysis', v)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Providers */}
      {settings.providers.map((provider) => (
        <Card key={provider.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                {provider.name}
              </CardTitle>
              <Switch checked={provider.enabled} onCheckedChange={(v) => updateProvider(provider.id, 'enabled', v)} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Model</Label>
                <Input value={provider.model} onChange={(e) => updateProvider(provider.id, 'model', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>API Key</Label>
                <Input type="password" value={provider.apiKey} onChange={(e) => updateProvider(provider.id, 'apiKey', e.target.value)} placeholder="sk-xxxxx" />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Temperature</Label>
                <Input type="number" step="0.1" value={provider.temperature} onChange={(e) => updateProvider(provider.id, 'temperature', parseFloat(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Max Tokens</Label>
                <Input type="number" value={provider.maxTokens} onChange={(e) => updateProvider(provider.id, 'maxTokens', parseInt(e.target.value))} />
              </div>
            </div>
            {provider.enabled && (
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-2">
                  <Label>Usage This Month</Label>
                  <span className="text-sm">{provider.usage.total.toLocaleString()} / {provider.usage.limit.toLocaleString()} tokens</span>
                </div>
                <Progress value={(provider.usage.total / provider.usage.limit) * 100} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Default Provider */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Default Provider
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={settings.defaultProvider} onValueChange={(v) => setSettings({ ...settings, defaultProvider: v })}>
            <SelectTrigger className="w-full md:w-[300px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {settings.providers.filter(p => p.enabled).map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
    </div>
  );
}
