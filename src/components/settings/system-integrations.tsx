'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Mail,
  MessageSquare,
  HardDrive,
  Bell,
  Chrome,
  Wifi,
  Sparkles,
  MessageCircle,
  Shield,
  Check,
  X,
  Eye,
  EyeOff,
  Settings,
  ExternalLink,
  Save,
  Trash2,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { SectionGuard } from '@/components/common/section-guard';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

type IntegrationType =
  | 'smtp'
  | 'sms_twilio'
  | 's3_storage'
  | 'fcm'
  | 'google_oauth'
  | 'radius'
  | 'ai'
  | 'whatsapp';

interface IntegrationMeta {
  type: IntegrationType;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  hoverBorder: string;
}

interface FieldSchema {
  key: string;
  label: string;
  type: 'text' | 'password' | 'number' | 'boolean' | 'url';
  placeholder?: string;
  description?: string;
  required?: boolean;
}

interface IntegrationSchema {
  fields: FieldSchema[];
  description: string;
}

interface StoredIntegration {
  type: IntegrationType;
  config: Record<string, string | number | boolean>;
  source: 'database' | 'env';
  updatedAt?: string;
}

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const SENSITIVE_MASK = '****';

const INTEGRATION_META: IntegrationMeta[] = [
  {
    type: 'smtp',
    label: 'Email / SMTP',
    sublabel: 'Email delivery',
    icon: Mail,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/40',
    hoverBorder: 'hover:border-blue-300',
  },
  {
    type: 'sms_twilio',
    label: 'SMS / Twilio',
    sublabel: 'SMS gateway',
    icon: MessageSquare,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/40',
    hoverBorder: 'hover:border-red-300',
  },
  {
    type: 's3_storage',
    label: 'S3 Storage',
    sublabel: 'File storage',
    icon: HardDrive,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/40',
    hoverBorder: 'hover:border-amber-300',
  },
  {
    type: 'fcm',
    label: 'FCM Push',
    sublabel: 'Push notifications',
    icon: Bell,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-950/40',
    hoverBorder: 'hover:border-orange-300',
  },
  {
    type: 'google_oauth',
    label: 'Google OAuth',
    sublabel: 'SSO login',
    icon: Chrome,
    color: 'text-teal-600 dark:text-teal-400',
    bgColor: 'bg-teal-50 dark:bg-teal-950/40',
    hoverBorder: 'hover:border-teal-300',
  },
  {
    type: 'radius',
    label: 'RADIUS / WiFi',
    sublabel: 'WiFi auth',
    icon: Wifi,
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-50 dark:bg-violet-950/40',
    hoverBorder: 'hover:border-violet-300',
  },
  {
    type: 'ai',
    label: 'AI Provider',
    sublabel: 'AI services',
    icon: Sparkles,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950/40',
    hoverBorder: 'hover:border-purple-300',
  },
  {
    type: 'whatsapp',
    label: 'WhatsApp Business',
    sublabel: 'WhatsApp API',
    icon: MessageCircle,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950/40',
    hoverBorder: 'hover:border-green-300',
  },
];

const INTEGRATION_SCHEMAS: Record<IntegrationType, IntegrationSchema> = {
  smtp: {
    description:
      'Configure your SMTP server for sending emails such as booking confirmations, notifications, and password resets.',
    fields: [
      { key: 'host', label: 'SMTP Host', type: 'text', placeholder: 'smtp.gmail.com', required: true },
      { key: 'port', label: 'SMTP Port', type: 'number', placeholder: '587', required: true },
      { key: 'username', label: 'Username', type: 'text', placeholder: 'user@example.com', required: true },
      { key: 'password', label: 'Password', type: 'password', placeholder: 'Enter SMTP password', required: true },
      { key: 'fromEmail', label: 'From Email', type: 'text', placeholder: 'noreply@yourhotel.com', required: true },
      { key: 'fromName', label: 'From Name', type: 'text', placeholder: 'StaySuite Hotel' },
      { key: 'useTls', label: 'Use TLS', type: 'boolean', description: 'Enable TLS encryption for SMTP connections' },
    ],
  },
  sms_twilio: {
    description:
      'Configure your SMS gateway (Twilio, Vonage, etc.) for sending SMS notifications and OTP codes.',
    fields: [
      { key: 'provider', label: 'SMS Provider', type: 'text', placeholder: 'twilio', required: true },
      { key: 'accountSid', label: 'Account SID', type: 'text', placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', required: true },
      { key: 'authToken', label: 'Auth Token', type: 'password', placeholder: 'Enter your auth token', required: true },
      { key: 'phoneNumber', label: 'From Phone Number', type: 'text', placeholder: '+1234567890', required: true },
    ],
  },
  s3_storage: {
    description:
      'Configure S3-compatible storage (AWS S3, MinIO, Cloudflare R2) for file uploads, invoices, and guest documents.',
    fields: [
      { key: 'endpoint', label: 'S3 Endpoint', type: 'url', placeholder: 'https://s3.amazonaws.com', required: true },
      { key: 'bucket', label: 'Bucket Name', type: 'text', placeholder: 'staysuite-uploads', required: true },
      { key: 'accessKeyId', label: 'Access Key ID', type: 'text', placeholder: 'AKIAIOSFODNN7EXAMPLE', required: true },
      { key: 'secretAccessKey', label: 'Secret Access Key', type: 'password', placeholder: 'Enter your secret key', required: true },
      { key: 'region', label: 'Region', type: 'text', placeholder: 'us-east-1' },
      { key: 'forcePathStyle', label: 'Force Path Style', type: 'boolean', description: 'Use path-style URLs (needed for MinIO)' },
    ],
  },
  fcm: {
    description:
      'Configure Firebase Cloud Messaging for sending push notifications to guest and staff mobile apps.',
    fields: [
      { key: 'projectId', label: 'Firebase Project ID', type: 'text', placeholder: 'my-hotel-app', required: true },
      { key: 'clientEmail', label: 'Client Email', type: 'text', placeholder: 'firebase-adminsdk@my-hotel-app.iam.gserviceaccount.com', required: true },
      { key: 'privateKey', label: 'Private Key', type: 'password', placeholder: 'Enter Firebase private key', required: true },
    ],
  },
  google_oauth: {
    description:
      'Configure Google OAuth 2.0 for Single Sign-On (SSO) login. Users can sign in with their Google account.',
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', placeholder: 'xxxxxxxxxxxx.apps.googleusercontent.com', required: true },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', placeholder: 'GOCSPX-xxxxxxxx', required: true },
      { key: 'redirectUri', label: 'Redirect URI', type: 'url', placeholder: 'https://yourhotel.com/api/auth/google/callback' },
      { key: 'allowedDomains', label: 'Allowed Domains', type: 'text', placeholder: 'hotelgroup.com (comma-separated)' },
    ],
  },
  radius: {
    description:
      'Configure RADIUS server for WiFi authentication. Guests receive auto-generated credentials upon check-in.',
    fields: [
      { key: 'serverIp', label: 'RADIUS Server IP', type: 'text', placeholder: '192.168.1.100', required: true },
      { key: 'sharedSecret', label: 'Shared Secret', type: 'password', placeholder: 'Enter RADIUS shared secret', required: true },
      { key: 'authPort', label: 'Auth Port', type: 'number', placeholder: '1812' },
      { key: 'acctPort', label: 'Accounting Port', type: 'number', placeholder: '1813' },
      { key: 'nasIdentifier', label: 'NAS Identifier', type: 'text', placeholder: 'staysuite-gateway' },
      { key: 'coaEnabled', label: 'Change of Authorization', type: 'boolean', description: 'Enable CoA for disconnecting sessions' },
    ],
  },
  ai: {
    description:
      'Configure your AI provider for smart recommendations, chat, revenue forecasting, and other AI-powered features.',
    fields: [
      { key: 'provider', label: 'AI Provider', type: 'text', placeholder: 'openai, anthropic, google', required: true },
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'Enter your API key', required: true },
      { key: 'baseUrl', label: 'Base URL', type: 'url', placeholder: 'https://api.openai.com/v1' },
      { key: 'model', label: 'Default Model', type: 'text', placeholder: 'gpt-4o-mini' },
    ],
  },
  whatsapp: {
    description:
      'Configure WhatsApp Business API for sending booking confirmations, check-in instructions, and guest communications.',
    fields: [
      { key: 'phoneNumberId', label: 'Phone Number ID', type: 'text', placeholder: '100234567890', required: true },
      { key: 'accessToken', label: 'Access Token', type: 'password', placeholder: 'EAAxxxxxxxx', required: true },
      { key: 'verifyToken', label: 'Webhook Verify Token', type: 'text', placeholder: 'my_custom_verify_token', required: true },
      { key: 'businessAccountId', label: 'Business Account ID', type: 'text', placeholder: '1234567890' },
    ],
  },
};

// ──────────────────────────────────────────────
// Helper: is a field considered sensitive?
// ──────────────────────────────────────────────

function isSensitiveField(field: FieldSchema): boolean {
  return field.type === 'password';
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function SystemIntegrations() {
  // ── State ──
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [selectedType, setSelectedType] = useState<IntegrationType | null>(null);
  const [integrations, setIntegrations] = useState<Record<string, StoredIntegration>>({});
  const [formData, setFormData] = useState<Record<string, string | number | boolean>>({});
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({});
  const [originalSensitiveValues, setOriginalSensitiveValues] = useState<Record<string, string>>({});
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  // ── Derived ──
  const selectedMeta = INTEGRATION_META.find((m) => m.type === selectedType);
  const selectedSchema = selectedType ? INTEGRATION_SCHEMAS[selectedType] : null;
  const selectedIntegration = selectedType ? integrations[selectedType] : null;

  // ── Fetch integrations on mount ──
  const fetchIntegrations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/integrations');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();

      // data.integrations is an array or record of stored integrations
      const map: Record<string, StoredIntegration> = {};
      const raw = data.integrations ?? [];
      const arr = Array.isArray(raw) ? raw : Object.values(raw);
      for (const item of arr) {
        if (item && item.type) {
          map[item.type] = item;
        }
      }
      setIntegrations(map);
    } catch {
      toast.error('Failed to load integration settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  // ── When an integration card is selected, populate form ──
  useEffect(() => {
    if (!selectedType || !selectedSchema) return;

    const stored = integrations[selectedType];
    const initial: Record<string, string | number | boolean> = {};
    const sensitiveOriginals: Record<string, string> = {};

    for (const field of selectedSchema.fields) {
      if (stored && stored.config[field.key] !== undefined) {
        if (isSensitiveField(field)) {
          initial[field.key] = SENSITIVE_MASK;
          sensitiveOriginals[field.key] = String(stored.config[field.key]);
        } else {
          initial[field.key] = stored.config[field.key];
        }
      } else if (field.type === 'boolean') {
        initial[field.key] = false;
      } else {
        initial[field.key] = '';
      }
    }

    setFormData(initial);
    setOriginalSensitiveValues(sensitiveOriginals);
    setVisibleFields({});
  }, [selectedType, integrations, selectedSchema]);

  // ── Handlers ──
  const handleSelectType = (type: IntegrationType) => {
    setSelectedType(type);
  };

  const handleFieldChange = (key: string, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const toggleFieldVisibility = (key: string) => {
    setVisibleFields((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const buildCleanFormData = (): Record<string, string | number | boolean> => {
    const clean: Record<string, string | number | boolean> = {};
    if (!selectedSchema) return clean;

    for (const field of selectedSchema.fields) {
      const val = formData[field.key];
      if (isSensitiveField(field) && val === SENSITIVE_MASK) {
        // Keep original value — don't send ****
        if (originalSensitiveValues[field.key]) {
          clean[field.key] = originalSensitiveValues[field.key];
        }
      } else if (val !== undefined && val !== '') {
        clean[field.key] = val;
      }
    }
    return clean;
  };

  const handleSave = async () => {
    if (!selectedType) return;
    const cleanConfig = buildCleanFormData();

    // Validate required fields
    if (selectedSchema) {
      for (const field of selectedSchema.fields) {
        if (field.required) {
          const val = cleanConfig[field.key];
          if (val === undefined || val === '') {
            toast.error(`${field.label} is required`);
            return;
          }
        }
      }
    }

    setSaving(true);
    try {
      const res = await fetch('/api/settings/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: selectedType, config: cleanConfig }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'Failed to save');
      }

      toast.success(`${selectedMeta?.label} settings saved successfully`);
      await fetchIntegrations();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save integration settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!selectedType) return;

    setTesting(true);
    try {
      const cleanConfig = buildCleanFormData();

      const res = await fetch('/api/settings/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: selectedType, config: cleanConfig, test: true }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.success) {
        toast.success(`Connection test passed for ${selectedMeta?.label}`);
      } else {
        toast.error(data?.error || `Connection test failed for ${selectedMeta?.label}`);
      }
    } catch {
      toast.error('Connection test failed — check your settings');
    } finally {
      setTesting(false);
    }
  };

  const handleReset = async () => {
    if (!selectedType) return;

    try {
      const res = await fetch('/api/settings/integrations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: selectedType }),
      });

      if (res.ok) {
        toast.success(`${selectedMeta?.label} settings cleared — using .env values`);
        await fetchIntegrations();
        // Reset form
        if (selectedSchema) {
          const initial: Record<string, string | number | boolean> = {};
          for (const field of selectedSchema.fields) {
            initial[field.key] = field.type === 'boolean' ? false : '';
          }
          setFormData(initial);
          setOriginalSensitiveValues({});
        }
      } else {
        toast.error('Failed to clear integration settings');
      }
    } catch {
      toast.error('Failed to clear integration settings');
    } finally {
      setResetDialogOpen(false);
    }
  };

  const isConfigured = (type: IntegrationType): boolean => {
    const integration = integrations[type];
    return !!integration && Object.keys(integration.config).length > 0;
  };

  const getSourceBadge = (type: IntegrationType): React.ReactNode => {
    const integration = integrations[type];
    if (!integration) {
      return (
        <Badge variant="secondary" className="bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          Not configured
        </Badge>
      );
    }
    if (integration.source === 'database') {
      return (
        <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
          Database
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
        .env
      </Badge>
    );
  };

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-56 mb-2" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // ── Render ──
  return (
    <SectionGuard permission="settings.manage">
      <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Settings className="h-7 w-7 text-primary" />
          <h2 className="text-2xl font-bold tracking-tight">System Integrations</h2>
        </div>
        <p className="text-muted-foreground">
          Configure email, SMS, storage, and other services. Settings are encrypted and stored securely in the
          database.
        </p>
      </div>

      {/* ── Info Banner ── */}
      <div className="rounded-lg border border-teal-200 bg-teal-50 dark:border-teal-800 dark:bg-teal-950/40 px-4 py-3 flex items-start gap-3">
        <Shield className="h-5 w-5 text-teal-600 dark:text-teal-400 mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-medium text-teal-800 dark:text-teal-200">
            Configure services from the GUI. Database settings override .env values.
          </p>
          <p className="text-teal-700 dark:text-teal-300 mt-0.5">
            Sensitive fields (passwords, keys) are encrypted at rest. When you see &quot;****&quot;, the existing
            value is preserved unless you replace it.
          </p>
        </div>
      </div>

      {/* ── Integration Cards Grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {INTEGRATION_META.map((meta) => {
          const configured = isConfigured(meta.type);
          const isSelected = selectedType === meta.type;
          const Icon = meta.icon;

          return (
            <Card
              key={meta.type}
              role="button"
              tabIndex={0}
              onClick={() => handleSelectType(meta.type)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleSelectType(meta.type);
              }}
              className={`
                cursor-pointer transition-all duration-200 py-4
                ${meta.hoverBorder}
                ${
                  isSelected
                    ? 'border-teal-500 ring-2 ring-teal-200 dark:ring-teal-800 shadow-md'
                    : 'hover:shadow-md'
                }
              `}
            >
              <CardContent className="px-4 space-y-3">
                {/* Icon + Status */}
                <div className="flex items-start justify-between">
                  <div className={`p-2.5 rounded-lg ${meta.bgColor}`}>
                    <Icon className={`h-5 w-5 ${meta.color}`} />
                  </div>
                  {configured ? (
                    <div className="flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                      <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-6 w-6 rounded-full bg-gray-100 dark:bg-gray-800">
                      <X className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                    </div>
                  )}
                </div>

                {/* Label */}
                <div>
                  <p className="font-semibold text-sm leading-tight">{meta.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{meta.sublabel}</p>
                </div>

                {/* Badges */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {configured ? (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-[10px] px-1.5">
                      Configured
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 text-[10px] px-1.5">
                      Not set
                    </Badge>
                  )}
                  {getSourceBadge(meta.type)}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Selected Integration Config Form ── */}
      {selectedType && selectedSchema && selectedMeta && (
        <Card className="border-t-4 border-t-teal-500">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${selectedMeta.bgColor}`}>
                  <selectedMeta.icon className={`h-5 w-5 ${selectedMeta.color}`} />
                </div>
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {selectedMeta.label}
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </CardTitle>
                  <CardDescription className="mt-1">{selectedSchema.description}</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedIntegration && (
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                    {selectedIntegration.source === 'database' ? 'Database' : '.env'}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>

          <Separator />

          <CardContent className="pt-6 space-y-6">
            {/* Form fields */}
            <div className="space-y-4">
              {selectedSchema.fields.map((field) => {
                const value = formData[field.key];
                const visible = visibleFields[field.key] ?? false;

                if (field.type === 'boolean') {
                  return (
                    <div
                      key={field.key}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="space-y-0.5">
                        <Label>{field.label}</Label>
                        {field.description && (
                          <p className="text-sm text-muted-foreground">{field.description}</p>
                        )}
                      </div>
                      <Switch
                        checked={!!value}
                        onCheckedChange={(checked) => handleFieldChange(field.key, checked)}
                      />
                    </div>
                  );
                }

                // Text / password / number / URL field
                return (
                  <div key={field.key} className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Label>
                        {field.label}
                        {field.required && <span className="text-destructive ml-0.5">*</span>}
                      </Label>
                      {field.description && (
                        <span className="text-xs text-muted-foreground">— {field.description}</span>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        type={
                          isSensitiveField(field) ? (visible ? 'text' : 'password') : field.type === 'number' ? 'number' : 'text'
                        }
                        placeholder={field.placeholder}
                        value={value as string}
                        onChange={(e) =>
                          handleFieldChange(
                            field.key,
                            field.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value,
                          )
                        }
                        className={isSensitiveField(field) ? 'pr-10' : ''}
                      />
                      {isSensitiveField(field) && (
                        <button
                          type="button"
                          onClick={() => toggleFieldVisibility(field.key)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          tabIndex={-1}
                        >
                          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <Separator />

            {/* Action Buttons */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Button onClick={handleSave} disabled={saving || testing}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {saving ? 'Saving...' : 'Save'}
                </Button>
                <Button variant="outline" onClick={handleTest} disabled={testing || saving}>
                  {testing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ExternalLink className="h-4 w-4" />
                  )}
                  {testing ? 'Testing...' : 'Test Connection'}
                </Button>
              </div>
              {selectedIntegration && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setResetDialogOpen(true)}
                  className="text-xs"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear / Reset
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Empty state: no selection ── */}
      {!selectedType && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Settings className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-muted-foreground">Select an Integration</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Click on one of the integration cards above to view and configure its settings. Configured
              integrations will show a green checkmark.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Reset Confirmation Dialog ── */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Clear Integration Settings
            </DialogTitle>
            <DialogDescription>
              This will delete the stored {selectedMeta?.label} settings from the database. The system will fall
              back to .env values if available.
              {selectedIntegration?.source === 'database' && (
                <span className="block mt-2 font-medium text-amber-600 dark:text-amber-400">
                  Warning: These settings were configured from the GUI and will be permanently removed.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReset}>
              <Trash2 className="h-4 w-4" />
              Clear Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </SectionGuard>
  );
}
