/**
 * System Integrations Hub API
 *
 * GET  — List all system integrations for the current tenant (with masked secrets)
 * POST — Create or update a system integration config
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { encrypt, decrypt, isEncrypted } from '@/lib/encryption';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// ── Integration type definitions with their config schema ─────────────────

const INTEGRATION_TYPES = {
  smtp: {
    label: 'Email / SMTP',
    icon: 'mail',
    fields: [
      { key: 'host', label: 'SMTP Host', type: 'text', sensitive: false, placeholder: 'smtp.gmail.com' },
      { key: 'port', label: 'SMTP Port', type: 'number', sensitive: false, placeholder: '587' },
      { key: 'user', label: 'SMTP Username', type: 'text', sensitive: false, placeholder: 'user@gmail.com' },
      { key: 'password', label: 'SMTP Password', type: 'password', sensitive: true },
      { key: 'from', label: 'From Email', type: 'text', sensitive: false, placeholder: 'noreply@hotel.com' },
      { key: 'secure', label: 'Use TLS', type: 'boolean', sensitive: false },
    ],
  },
  sms_twilio: {
    label: 'SMS (Twilio)',
    icon: 'message-square',
    fields: [
      { key: 'accountSid', label: 'Account SID', type: 'text', sensitive: false },
      { key: 'authToken', label: 'Auth Token', type: 'password', sensitive: true },
      { key: 'phoneNumber', label: 'From Phone Number', type: 'text', sensitive: false },
    ],
  },
  s3_storage: {
    label: 'File Storage (S3)',
    icon: 'hard-drive',
    fields: [
      { key: 'endpoint', label: 'S3 Endpoint', type: 'text', sensitive: false, placeholder: 'https://s3.amazonaws.com' },
      { key: 'bucket', label: 'Bucket Name', type: 'text', sensitive: false },
      { key: 'region', label: 'Region', type: 'text', sensitive: false, placeholder: 'us-east-1' },
      { key: 'accessKey', label: 'Access Key', type: 'password', sensitive: true },
      { key: 'secretKey', label: 'Secret Key', type: 'password', sensitive: true },
    ],
  },
  fcm: {
    label: 'Push Notifications (FCM)',
    icon: 'bell',
    fields: [
      { key: 'senderId', label: 'FCM Sender ID', type: 'text', sensitive: false },
      { key: 'serverKey', label: 'FCM Server Key', type: 'password', sensitive: true },
    ],
  },
  google_oauth: {
    label: 'Google OAuth',
    icon: 'chrome',
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', sensitive: false },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', sensitive: true },
      { key: 'redirectUri', label: 'Redirect URI', type: 'text', sensitive: false },
    ],
  },
  radius: {
    label: 'WiFi / RADIUS',
    icon: 'wifi',
    fields: [
      { key: 'host', label: 'RADIUS Host', type: 'text', sensitive: false },
      { key: 'authPort', label: 'Auth Port', type: 'number', sensitive: false, placeholder: '1812' },
      { key: 'acctPort', label: 'Acct Port', type: 'number', sensitive: false, placeholder: '1813' },
      { key: 'secret', label: 'RADIUS Secret', type: 'password', sensitive: true },
    ],
  },
  ai: {
    label: 'AI Provider',
    icon: 'sparkles',
    fields: [
      { key: 'provider', label: 'AI Provider', type: 'text', sensitive: false, placeholder: 'openai' },
      { key: 'apiKey', label: 'API Key', type: 'password', sensitive: true },
      { key: 'model', label: 'Model', type: 'text', sensitive: false, placeholder: 'gpt-4o-mini' },
    ],
  },
  whatsapp: {
    label: 'WhatsApp Business',
    icon: 'message-circle',
    fields: [
      { key: 'businessAccountId', label: 'Business Account ID', type: 'text', sensitive: false },
      { key: 'appSecret', label: 'App Secret', type: 'password', sensitive: true },
      { key: 'phoneNumberId', label: 'Phone Number ID', type: 'text', sensitive: false },
      { key: 'accessToken', label: 'Access Token', type: 'password', sensitive: true },
      { key: 'phoneNumber', label: 'From Phone Number', type: 'text', sensitive: false },
    ],
  },
} as const;

type IntegrationType = keyof typeof INTEGRATION_TYPES;

// ── Helpers ────────────────────────────────────────────────────────────────

/** Decrypt a value only if it looks encrypted */
function safeDecrypt(value: string): string {
  if (!value) return '';
  if (isEncrypted(value)) {
    const dec = decrypt(value);
    return dec !== null ? dec : value;
  }
  return value;
}

/** Determine if an integration has all required (non-optional) fields filled */
function isActive(
  type: IntegrationType,
  config: Record<string, unknown>,
): boolean {
  const fields = INTEGRATION_TYPES[type].fields;
  // An integration is "active" when at least one sensitive field is populated
  const sensitiveFields = fields.filter((f) => f.sensitive);
  return sensitiveFields.some((f) => {
    const v = config[f.key];
    return v !== undefined && v !== null && v !== '';
  });
}

// ── GET ────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }

    if (!hasPermission(user, 'settings.view')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 },
      );
    }

    const tenantId = user.tenantId;
    const typeKeys = Object.keys(INTEGRATION_TYPES) as IntegrationType[];

    const integrations = await db.integration.findMany({
      where: {
        tenantId,
        type: { in: typeKeys },
      },
    });

    const results = integrations.map((row) => {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(row.config || '{}');
      } catch {
        parsed = {};
      }

      const typeDef = INTEGRATION_TYPES[row.type as IntegrationType];
      const masked: Record<string, unknown> = {};

      for (const field of typeDef?.fields ?? []) {
        const raw = String(parsed[field.key] ?? '');
        if (field.sensitive && raw) {
          // Show '****' for sensitive fields that have a value
          masked[field.key] = '****';
        } else if (field.type === 'boolean') {
          masked[field.key] = raw === 'true';
        } else if (field.type === 'number') {
          const n = Number(raw);
          masked[field.key] = isNaN(n) ? raw : n;
        } else {
          masked[field.key] = raw;
        }
      }

      return {
        id: row.id,
        type: row.type,
        provider: row.provider,
        name: row.name,
        status: row.status,
        config: masked,
        active: isActive(row.type as IntegrationType, parsed),
        lastSyncAt: row.lastSyncAt,
        lastError: row.lastError,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        integrations: results,
        types: INTEGRATION_TYPES,
      },
    });
  } catch (error) {
    console.error('[Integrations] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch integrations' },
      { status: 500 },
    );
  }
}

// ── POST ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }

    if (!hasPermission(user, 'settings.manage')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 },
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const { type, config: rawConfig, name } = body as {
      type: string;
      config: Record<string, string | number | boolean>;
      name?: string;
    };

    if (!type || !(type in INTEGRATION_TYPES)) {
      return NextResponse.json(
        { success: false, error: `Invalid integration type. Must be one of: ${Object.keys(INTEGRATION_TYPES).join(', ')}` },
        { status: 400 },
      );
    }

    const typeDef = INTEGRATION_TYPES[type as IntegrationType];
    const encryptedConfig: Record<string, string> = {};

    for (const field of typeDef.fields) {
      const value = rawConfig[field.key];
      if (value === undefined || value === null) continue;

      const strValue = String(value);

      if (field.sensitive) {
        // Skip re-encrypting masked values sent back from the UI
        if (strValue === '****') continue;

        // Decrypt first if already encrypted to avoid double-encrypting
        let plaintext = strValue;
        if (isEncrypted(strValue)) {
          const dec = decrypt(strValue);
          if (dec !== null) plaintext = dec;
        }
        encryptedConfig[field.key] = encrypt(plaintext);
      } else {
        encryptedConfig[field.key] = strValue;
      }
    }

    const integration = await db.integration.upsert({
      where: {
        tenantId_type_provider: {
          tenantId,
          type,
          provider: type, // system integrations use the type as provider
        },
      },
      create: {
        tenantId,
        type,
        provider: type,
        name: name || typeDef.label,
        config: JSON.stringify(encryptedConfig),
        status: 'active',
      },
      update: {
        config: JSON.stringify(encryptedConfig),
        name: name || typeDef.label,
        status: 'active',
        updatedAt: new Date(),
      },
    });

    // Build masked response
    const masked: Record<string, unknown> = {};
    for (const field of typeDef.fields) {
      const raw = encryptedConfig[field.key] ?? '';
      if (field.sensitive && raw) {
        masked[field.key] = '****';
      } else if (field.type === 'boolean') {
        masked[field.key] = raw === 'true';
      } else if (field.type === 'number') {
        const n = Number(raw);
        masked[field.key] = isNaN(n) ? raw : n;
      } else {
        masked[field.key] = raw;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: integration.id,
        type: integration.type,
        provider: integration.provider,
        name: integration.name,
        status: integration.status,
        config: masked,
        active: isActive(type as IntegrationType, encryptedConfig),
        updatedAt: integration.updatedAt,
      },
    });
  } catch (error) {
    console.error('[Integrations] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save integration' },
      { status: 500 },
    );
  }
}
