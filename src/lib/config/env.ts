/**
 * StaySuite Environment Configuration
 * 
 * Auto-detects environment and provides unified configuration
 * Supports seamless movement between sandbox and production
 */

// Environment types
export type Environment = 'development' | 'sandbox' | 'production';

// Database types
export type DatabaseType = 'sqlite' | 'postgresql';

// Service configuration interface
export interface ServiceConfig {
  enabled: boolean;
  type: 'mock' | 'real';
  config: Record<string, unknown>;
}

// Main environment configuration interface
export interface EnvironmentConfig {
  // Core
  env: Environment;
  isProduction: boolean;
  isDevelopment: boolean;
  isSandbox: boolean;
  
  // Database
  database: {
    type: DatabaseType;
    url: string;
    isPostgreSQL: boolean;
    isSQLite: boolean;
  };
  
  // Redis/Cache
  redis: {
    enabled: boolean;
    url: string | null;
  };
  
  // Queue (BullMQ)
  queue: {
    enabled: boolean;
    redisUrl: string | null;
  };
  
  // Real-time (Socket.io)
  realtime: {
    enabled: boolean;
    wsPort: number;
  };
  
  // Email (SMTP)
  email: {
    enabled: boolean;
    host: string | null;
    port: number;
    user: string | null;
    from: string;
  };
  
  // SMS (Twilio)
  sms: {
    enabled: boolean;
    accountSid: string | null;
    phoneNumber: string | null;
  };
  
  // WhatsApp
  whatsapp: {
    enabled: boolean;
    phoneNumber: string | null;
  };
  
  // Payment Gateways
  payments: {
    stripe: {
      enabled: boolean;
      testMode: boolean;
      publicKey: string | null;
    };
    paypal: {
      enabled: boolean;
      testMode: boolean;
      clientId: string | null;
    };
  };
  
  // WiFi/RADIUS
  radius: {
    enabled: boolean;
    host: string | null;
    authPort: number;
    acctPort: number;
    secret: string | null;
  };
  
  // OTA Channels
  channels: {
    enabled: boolean;
    testMode: boolean;
  };
  
  // AI
  ai: {
    enabled: boolean;
    provider: string | null;
  };
  
  // Feature flags from environment
  features: {
    enableRealTime: boolean;
    enableJobQueue: boolean;
    enableWiFiIntegration: boolean;
    enableSMS: boolean;
    enableEmail: boolean;
  };
}

/**
 * Detect current environment
 */
function detectEnvironment(): Environment {
  const nodeEnv = process.env.NODE_ENV;
  
  // Check if we're in a sandbox environment
  const isSandboxEnv = 
    process.env.SANDBOX_MODE === 'true' ||
    (!process.env.REDIS_URL && !process.env.SMTP_HOST) ||
    (process.env.DATABASE_URL?.startsWith('file:') ?? false);
  
  if (nodeEnv === 'production' && !isSandboxEnv) {
    return 'production';
  }
  
  if (isSandboxEnv || nodeEnv === 'development') {
    return 'sandbox';
  }
  
  return 'development';
}

/**
 * Detect database type from connection string
 */
function detectDatabaseType(): DatabaseType {
  const dbUrl = process.env.DATABASE_URL || '';
  
  if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
    return 'postgresql';
  }
  
  return 'sqlite';
}

/**
 * Get feature flag with fallback
 */
function getFeatureFlag(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value === 'true' || value === '1';
}

/**
 * Build complete environment configuration
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  const env = detectEnvironment();
  const dbType = detectDatabaseType();
  
  const isProduction = env === 'production';
  const isDevelopment = env === 'development';
  const isSandbox = env === 'sandbox';
  
  // Redis URL
  const redisUrl = process.env.REDIS_URL || null;
  const hasRedis = redisUrl !== null;
  
  // SMTP configuration
  const smtpHost = process.env.SMTP_HOST || null;
  const hasEmail = smtpHost !== null;
  
  // Twilio configuration
  const twilioSid = process.env.TWILIO_ACCOUNT_SID || null;
  const hasSMS = twilioSid !== null;
  
  // Stripe configuration
  const stripeKey = process.env.STRIPE_SECRET_KEY || null;
  const hasStripe = stripeKey !== null;
  const stripeTestMode = stripeKey?.startsWith('sk_test_') ?? true;
  
  // PayPal configuration
  const paypalClientId = process.env.PAYPAL_CLIENT_ID || null;
  const hasPayPal = paypalClientId !== null;
  const paypalTestMode = process.env.PAYPAL_MODE !== 'live';
  
  // RADIUS configuration
  const radiusHost = process.env.RADIUS_HOST || null;
  const hasRadius = radiusHost !== null;
  
  // WhatsApp
  const whatsappPhone = process.env.WHATSAPP_PHONE_NUMBER || null;
  const hasWhatsApp = whatsappPhone !== null;
  
  // AI Provider
  const aiApiKey = process.env.AI_API_KEY || null;
  const hasAI = aiApiKey !== null;
  
  return {
    // Core
    env,
    isProduction,
    isDevelopment,
    isSandbox,
    
    // Database
    database: {
      type: dbType,
      url: process.env.DATABASE_URL || 'file:./dev.db',
      isPostgreSQL: dbType === 'postgresql',
      isSQLite: dbType === 'sqlite',
    },
    
    // Redis/Cache
    redis: {
      enabled: hasRedis,
      url: redisUrl,
    },
    
    // Queue
    queue: {
      enabled: hasRedis && getFeatureFlag('ENABLE_JOB_QUEUE', false),
      redisUrl: redisUrl,
    },
    
    // Real-time
    realtime: {
      enabled: getFeatureFlag('ENABLE_REAL_TIME', true) && hasRedis,
      wsPort: parseInt(process.env.WS_PORT || '3001', 10),
    },
    
    // Email
    email: {
      enabled: hasEmail && (getFeatureFlag('ENABLE_EMAIL', isProduction) || isSandbox),
      host: smtpHost,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      user: process.env.SMTP_USER || null,
      from: process.env.EMAIL_FROM || 'noreply@staysuite.local',
    },
    
    // SMS
    sms: {
      enabled: hasSMS && getFeatureFlag('ENABLE_SMS', false),
      accountSid: twilioSid,
      phoneNumber: process.env.TWILIO_PHONE_NUMBER || null,
    },
    
    // WhatsApp
    whatsapp: {
      enabled: hasWhatsApp,
      phoneNumber: whatsappPhone,
    },
    
    // Payments
    payments: {
      stripe: {
        enabled: hasStripe,
        testMode: stripeTestMode,
        publicKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
      },
      paypal: {
        enabled: hasPayPal,
        testMode: paypalTestMode,
        clientId: paypalClientId,
      },
    },
    
    // RADIUS
    radius: {
      enabled: hasRadius && getFeatureFlag('ENABLE_WIFI_INTEGRATION', false),
      host: radiusHost,
      authPort: parseInt(process.env.RADIUS_AUTH_PORT || '1812', 10),
      acctPort: parseInt(process.env.RADIUS_ACCT_PORT || '1813', 10),
      secret: process.env.RADIUS_SECRET || null,
    },
    
    // Channels
    channels: {
      enabled: true,
      testMode: !isProduction,
    },
    
    // AI
    ai: {
      enabled: hasAI,
      provider: process.env.AI_PROVIDER || null,
    },
    
    // Feature flags
    features: {
      enableRealTime: getFeatureFlag('ENABLE_REAL_TIME', !isProduction),
      enableJobQueue: getFeatureFlag('ENABLE_JOB_QUEUE', false),
      enableWiFiIntegration: getFeatureFlag('ENABLE_WIFI_INTEGRATION', false),
      enableSMS: getFeatureFlag('ENABLE_SMS', false),
      enableEmail: getFeatureFlag('ENABLE_EMAIL', false),
    },
  };
}

// Singleton instance
let configInstance: EnvironmentConfig | null = null;

/**
 * Get environment configuration (cached)
 */
export function getConfig(): EnvironmentConfig {
  if (!configInstance) {
    configInstance = getEnvironmentConfig();
  }
  return configInstance;
}

/**
 * Reset configuration (for testing)
 */
export function resetConfig(): void {
  configInstance = null;
}

/**
 * Check if a service is available
 */
export function isServiceAvailable(service: keyof Pick<EnvironmentConfig, 'redis' | 'email' | 'sms' | 'radius' | 'realtime' | 'queue'>): boolean {
  const config = getConfig();
  return config[service]?.enabled ?? false;
}

/**
 * Get service status summary
 */
export function getServiceStatus(): Record<string, { enabled: boolean; type: string }> {
  const config = getConfig();
  
  return {
    database: {
      enabled: true,
      type: config.database.type,
    },
    redis: {
      enabled: config.redis.enabled,
      type: config.redis.enabled ? 'redis' : 'memory',
    },
    queue: {
      enabled: config.queue.enabled,
      type: config.queue.enabled ? 'bullmq' : 'memory',
    },
    realtime: {
      enabled: config.realtime.enabled,
      type: config.realtime.enabled ? 'websocket' : 'polling',
    },
    email: {
      enabled: config.email.enabled,
      type: config.email.enabled ? 'smtp' : 'mock',
    },
    sms: {
      enabled: config.sms.enabled,
      type: config.sms.enabled ? 'twilio' : 'mock',
    },
    whatsapp: {
      enabled: config.whatsapp.enabled,
      type: config.whatsapp.enabled ? 'business-api' : 'mock',
    },
    stripe: {
      enabled: config.payments.stripe.enabled,
      type: config.payments.stripe.testMode ? 'test' : 'live',
    },
    paypal: {
      enabled: config.payments.paypal.enabled,
      type: config.payments.paypal.testMode ? 'test' : 'live',
    },
    radius: {
      enabled: config.radius.enabled,
      type: config.radius.enabled ? 'freeradius' : 'mock',
    },
    ai: {
      enabled: config.ai.enabled,
      type: config.ai.provider || 'none',
    },
  };
}

// Export default
export default getConfig;
