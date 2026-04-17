/**
 * Service Config Helper
 *
 * Provides DB-first configuration for system integrations with env-var
 * fallback.  Adapters call these helpers instead of reading
 * `process.env.*` directly so that tenants can configure SMTP, S3, Twilio,
 * etc. from the GUI.
 *
 * Pattern:
 *   const cfg = await getSMTPConfig(tenantId);
 *   // cfg.host, cfg.port, … come from DB when set, otherwise from env
 *   // cfg.source is 'database' | 'env' for observability
 */

import { db } from '@/lib/db';
import { decrypt, isEncrypted } from '@/lib/encryption';

// ── Types ──────────────────────────────────────────────────────────────────

type IntegrationType =
  | 'smtp'
  | 'sms_twilio'
  | 's3_storage'
  | 'fcm'
  | 'google_oauth'
  | 'radius'
  | 'ai'
  | 'whatsapp';

// ── Core helper ────────────────────────────────────────────────────────────

/**
 * Read an integration record from the database, decrypt its config JSON,
 * and return the parsed plain-text values.
 *
 * Returns `null` when no record exists or decryption fails.
 */
export async function getServiceConfig<
  T extends Record<string, string | number | boolean>,
>(tenantId: string, type: IntegrationType): Promise<T | null> {
  try {
    const integration = await db.integration.findFirst({
      where: { tenantId, type, provider: type },
    });

    if (!integration) return null;

    const raw = JSON.parse(integration.config || '{}') as Record<
      string,
      string
    >;
    const decrypted: Record<string, string | number | boolean> = {};

    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === 'string' && isEncrypted(value)) {
        const dec = decrypt(value);
        decrypted[key] = dec !== null ? dec : value;
      } else if (typeof value === 'string') {
        // Try parsing JSON for booleans / numbers stored as strings
        try {
          const parsed = JSON.parse(value);
          if (typeof parsed === 'number' || typeof parsed === 'boolean') {
            decrypted[key] = parsed;
          } else {
            decrypted[key] = value;
          }
        } catch {
          decrypted[key] = value;
        }
      } else {
        decrypted[key] = value;
      }
    }

    return decrypted as T;
  } catch {
    return null;
  }
}

// ── SMTP ───────────────────────────────────────────────────────────────────

export async function getSMTPConfig(tenantId: string) {
  const dbConfig = await getServiceConfig<{
    host: string;
    port: number;
    user: string;
    password: string;
    from: string;
    secure: boolean;
  }>(tenantId, 'smtp');

  return {
    host: dbConfig?.host || process.env.SMTP_HOST || '',
    port: dbConfig?.port || parseInt(process.env.SMTP_PORT || '587', 10),
    user: dbConfig?.user || process.env.SMTP_USER || '',
    password:
      dbConfig?.password ||
      process.env.SMTP_PASS ||
      process.env.SMTP_PASSWORD ||
      '',
    from: dbConfig?.from || process.env.EMAIL_FROM || 'noreply@staysuite.local',
    secure:
      dbConfig?.secure !== undefined ? dbConfig.secure : process.env.SMTP_SECURE === 'true',
    source: (dbConfig ? 'database' : 'env') as 'database' | 'env',
  };
}

// ── S3 / File Storage ─────────────────────────────────────────────────────

export async function getS3Config(tenantId: string) {
  const dbConfig = await getServiceConfig<{
    endpoint: string;
    bucket: string;
    region: string;
    accessKey: string;
    secretKey: string;
  }>(tenantId, 's3_storage');

  return {
    endpoint: dbConfig?.endpoint || process.env.S3_ENDPOINT || '',
    bucket: dbConfig?.bucket || process.env.S3_BUCKET || '',
    region: dbConfig?.region || process.env.S3_REGION || '',
    accessKey: dbConfig?.accessKey || process.env.S3_ACCESS_KEY || '',
    secretKey: dbConfig?.secretKey || process.env.S3_SECRET_KEY || '',
    publicUrl: dbConfig?.endpoint || process.env.S3_PUBLIC_URL || process.env.S3_ENDPOINT || '',
    source: (dbConfig ? 'database' : 'env') as 'database' | 'env',
  };
}

// ── Twilio SMS ─────────────────────────────────────────────────────────────

export async function getTwilioConfig(tenantId: string) {
  const dbConfig = await getServiceConfig<{
    accountSid: string;
    authToken: string;
    phoneNumber: string;
  }>(tenantId, 'sms_twilio');

  return {
    accountSid:
      dbConfig?.accountSid || process.env.TWILIO_ACCOUNT_SID || '',
    authToken: dbConfig?.authToken || process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber:
      dbConfig?.phoneNumber || process.env.TWILIO_PHONE_NUMBER || '',
    source: (dbConfig ? 'database' : 'env') as 'database' | 'env',
  };
}

// ── FCM Push ───────────────────────────────────────────────────────────────

export async function getFCMConfig(tenantId: string) {
  const dbConfig = await getServiceConfig<{
    senderId: string;
    serverKey: string;
  }>(tenantId, 'fcm');

  return {
    senderId: dbConfig?.senderId || process.env.FCM_SENDER_ID || '',
    serverKey: dbConfig?.serverKey || process.env.FCM_SERVER_KEY || '',
    source: (dbConfig ? 'database' : 'env') as 'database' | 'env',
  };
}

// ── Google OAuth ───────────────────────────────────────────────────────────

export async function getGoogleOAuthConfig(tenantId: string) {
  const dbConfig = await getServiceConfig<{
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  }>(tenantId, 'google_oauth');

  return {
    clientId:
      dbConfig?.clientId || process.env.GOOGLE_CLIENT_ID || '',
    clientSecret:
      dbConfig?.clientSecret || process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri:
      dbConfig?.redirectUri || process.env.GOOGLE_REDIRECT_URI || '',
    source: (dbConfig ? 'database' : 'env') as 'database' | 'env',
  };
}

// ── RADIUS / WiFi ──────────────────────────────────────────────────────────

export async function getRadiusConfig(tenantId: string) {
  const dbConfig = await getServiceConfig<{
    host: string;
    authPort: number;
    acctPort: number;
    secret: string;
  }>(tenantId, 'radius');

  return {
    host: dbConfig?.host || process.env.RADIUS_HOST || '',
    authPort:
      dbConfig?.authPort ||
      parseInt(process.env.RADIUS_AUTH_PORT || '1812', 10),
    acctPort:
      dbConfig?.acctPort ||
      parseInt(process.env.RADIUS_ACCT_PORT || '1813', 10),
    secret: dbConfig?.secret || process.env.RADIUS_SECRET || '',
    source: (dbConfig ? 'database' : 'env') as 'database' | 'env',
  };
}

// ── AI Provider ────────────────────────────────────────────────────────────

export async function getAIConfig(tenantId: string) {
  const dbConfig = await getServiceConfig<{
    provider: string;
    apiKey: string;
    model: string;
  }>(tenantId, 'ai');

  return {
    provider: dbConfig?.provider || process.env.AI_PROVIDER || 'openai',
    apiKey: dbConfig?.apiKey || process.env.AI_API_KEY || '',
    model: dbConfig?.model || process.env.AI_MODEL || 'gpt-4o-mini',
    source: (dbConfig ? 'database' : 'env') as 'database' | 'env',
  };
}

// ── WhatsApp Business ─────────────────────────────────────────────────────

export async function getWhatsAppConfig(tenantId: string) {
  const dbConfig = await getServiceConfig<{
    businessAccountId: string;
    appSecret: string;
    phoneNumberId: string;
    accessToken: string;
    phoneNumber: string;
  }>(tenantId, 'whatsapp');

  return {
    businessAccountId:
      dbConfig?.businessAccountId ||
      process.env.WHATSAPP_BUSINESS_ACCOUNT_ID ||
      '',
    appSecret:
      dbConfig?.appSecret || process.env.WHATSAPP_APP_SECRET || '',
    phoneNumberId:
      dbConfig?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    accessToken:
      dbConfig?.accessToken || process.env.WHATSAPP_ACCESS_TOKEN || '',
    phoneNumber:
      dbConfig?.phoneNumber || process.env.WHATSAPP_PHONE_NUMBER || '',
    source: (dbConfig ? 'database' : 'env') as 'database' | 'env',
  };
}
