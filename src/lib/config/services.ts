/**
 * StaySuite Service Availability Detection
 * 
 * Provides runtime service status and graceful degradation
 */

import { getConfig, getServiceStatus, type EnvironmentConfig } from './env';

// Service status interface
export interface ServiceStatus {
  name: string;
  enabled: boolean;
  type: 'real' | 'mock' | 'unavailable';
  message: string;
  lastChecked: Date;
}

// All available services
export type ServiceName = 
  | 'database'
  | 'redis'
  | 'queue'
  | 'realtime'
  | 'email'
  | 'sms'
  | 'whatsapp'
  | 'stripe'
  | 'paypal'
  | 'radius'
  | 'ai';

// Service registry
const serviceRegistry: Record<ServiceName, {
  check: (config: EnvironmentConfig) => ServiceStatus;
}> = {
  database: {
    check: (config) => ({
      name: 'Database',
      enabled: true,
      type: config.database.isPostgreSQL ? 'real' : 'mock',
      message: config.database.isPostgreSQL 
        ? 'PostgreSQL connected' 
        : 'SQLite (development mode)',
      lastChecked: new Date(),
    }),
  },
  
  redis: {
    check: (config) => ({
      name: 'Redis Cache',
      enabled: config.redis.enabled,
      type: config.redis.enabled ? 'real' : 'mock',
      message: config.redis.enabled 
        ? 'Redis connected' 
        : 'In-memory cache (development mode)',
      lastChecked: new Date(),
    }),
  },
  
  queue: {
    check: (config) => ({
      name: 'Job Queue',
      enabled: config.queue.enabled,
      type: config.queue.enabled ? 'real' : 'mock',
      message: config.queue.enabled 
        ? 'BullMQ active' 
        : 'Synchronous execution (development mode)',
      lastChecked: new Date(),
    }),
  },
  
  realtime: {
    check: (config) => ({
      name: 'Real-time Updates',
      enabled: config.realtime.enabled,
      type: config.realtime.enabled ? 'real' : 'mock',
      message: config.realtime.enabled 
        ? 'WebSocket active' 
        : 'HTTP polling fallback',
      lastChecked: new Date(),
    }),
  },
  
  email: {
    check: (config) => ({
      name: 'Email Service',
      enabled: config.email.enabled,
      type: config.email.enabled ? 'real' : 'mock',
      message: config.email.enabled 
        ? `SMTP: ${config.email.host}` 
        : 'Email logging only (development mode)',
      lastChecked: new Date(),
    }),
  },
  
  sms: {
    check: (config) => ({
      name: 'SMS Service',
      enabled: config.sms.enabled,
      type: config.sms.enabled ? 'real' : 'mock',
      message: config.sms.enabled 
        ? 'Twilio connected' 
        : 'SMS logging only (development mode)',
      lastChecked: new Date(),
    }),
  },
  
  whatsapp: {
    check: (config) => ({
      name: 'WhatsApp Business',
      enabled: config.whatsapp.enabled,
      type: config.whatsapp.enabled ? 'real' : 'mock',
      message: config.whatsapp.enabled 
        ? 'WhatsApp Business API active' 
        : 'WhatsApp logging only (development mode)',
      lastChecked: new Date(),
    }),
  },
  
  stripe: {
    check: (config) => ({
      name: 'Stripe Payments',
      enabled: config.payments.stripe.enabled,
      type: config.payments.stripe.enabled 
        ? (config.payments.stripe.testMode ? 'mock' : 'real') 
        : 'unavailable',
      message: config.payments.stripe.enabled 
        ? (config.payments.stripe.testMode ? 'Stripe test mode' : 'Stripe live mode')
        : 'Stripe not configured',
      lastChecked: new Date(),
    }),
  },
  
  paypal: {
    check: (config) => ({
      name: 'PayPal Payments',
      enabled: config.payments.paypal.enabled,
      type: config.payments.paypal.enabled 
        ? (config.payments.paypal.testMode ? 'mock' : 'real') 
        : 'unavailable',
      message: config.payments.paypal.enabled 
        ? (config.payments.paypal.testMode ? 'PayPal sandbox mode' : 'PayPal live mode')
        : 'PayPal not configured',
      lastChecked: new Date(),
    }),
  },
  
  radius: {
    check: (config) => ({
      name: 'WiFi RADIUS',
      enabled: config.radius.enabled,
      type: config.radius.enabled ? 'real' : 'mock',
      message: config.radius.enabled 
        ? `FreeRADIUS: ${config.radius.host}` 
        : 'WiFi mock mode (development mode)',
      lastChecked: new Date(),
    }),
  },
  
  ai: {
    check: (config) => ({
      name: 'AI Services',
      enabled: config.ai.enabled,
      type: config.ai.enabled ? 'real' : 'mock',
      message: config.ai.enabled 
        ? `AI Provider: ${config.ai.provider}` 
        : 'AI not configured',
      lastChecked: new Date(),
    }),
  },
};

/**
 * Get status of a specific service
 */
export function getServiceHealth(service: ServiceName): ServiceStatus {
  const config = getConfig();
  return serviceRegistry[service].check(config);
}

/**
 * Get status of all services
 */
export function getAllServicesHealth(): ServiceStatus[] {
  const config = getConfig();
  return Object.entries(serviceRegistry).map(([name, { check }]) => 
    check(config)
  );
}

/**
 * Check if critical services are available
 */
export function areCriticalServicesAvailable(): { 
  available: boolean; 
  missing: string[] 
} {
  const config = getConfig();
  const missing: string[] = [];
  
  // Database is always required
  if (!config.database.url) {
    missing.push('Database');
  }
  
  // In production, we need more services
  if (config.isProduction) {
    if (!config.redis.enabled) missing.push('Redis');
    if (!config.email.enabled) missing.push('Email');
  }
  
  return {
    available: missing.length === 0,
    missing,
  };
}

/**
 * Get services summary for API response
 */
export function getServicesSummary() {
  const config = getConfig();
  const services = getServiceStatus();
  const health = getAllServicesHealth();
  
  return {
    environment: config.env,
    isProduction: config.isProduction,
    isSandbox: config.isSandbox,
    services: health,
    features: {
      realTimeUpdates: config.realtime.enabled,
      jobQueue: config.queue.enabled,
      wifiIntegration: config.radius.enabled,
      emailNotifications: config.email.enabled,
      smsNotifications: config.sms.enabled,
      payments: config.payments.stripe.enabled || config.payments.paypal.enabled,
    },
    limitations: config.isSandbox ? getSandboxLimitations() : [],
  };
}

/**
 * Get sandbox limitations message
 */
export function getSandboxLimitations(): string[] {
  const config = getConfig();
  const limitations: string[] = [];
  
  if (config.database.isSQLite) {
    limitations.push('Using SQLite - No Row-Level Security');
    limitations.push('Limited concurrent connections');
  }
  
  if (!config.redis.enabled) {
    limitations.push('In-memory cache - Data lost on restart');
    limitations.push('No background job processing');
  }
  
  if (!config.realtime.enabled) {
    limitations.push('Real-time updates using HTTP polling');
  }
  
  if (!config.email.enabled) {
    limitations.push('Email notifications logged to console only');
  }
  
  if (!config.sms.enabled) {
    limitations.push('SMS notifications logged to console only');
  }
  
  if (!config.radius.enabled) {
    limitations.push('WiFi integration in mock mode');
  }
  
  if (config.payments.stripe.testMode || !config.payments.stripe.enabled) {
    limitations.push('Payments in test/mock mode');
  }
  
  return limitations;
}

/**
 * Feature availability check for UI
 */
export function isFeatureAvailable(feature: keyof EnvironmentConfig['features']): boolean {
  const config = getConfig();
  return config.features[feature] ?? false;
}

/**
 * Get service unavailable message
 */
export function getServiceUnavailableMessage(service: ServiceName): string {
  const messages: Record<ServiceName, string> = {
    database: 'Database connection is not available. Please check your DATABASE_URL.',
    redis: 'Redis cache is not available. Using in-memory fallback.',
    queue: 'Job queue is not available. Operations will run synchronously.',
    realtime: 'Real-time updates are not available. Using HTTP polling.',
    email: 'Email service is not configured. Emails will be logged only.',
    sms: 'SMS service is not configured. Messages will be logged only.',
    whatsapp: 'WhatsApp is not configured. Messages will be logged only.',
    stripe: 'Stripe is not configured. Payments will be simulated.',
    paypal: 'PayPal is not configured. Payments will be simulated.',
    radius: 'RADIUS server is not configured. WiFi integration is simulated.',
    ai: 'AI service is not configured. AI features will be limited.',
  };
  
  return messages[service];
}

const servicesExport = {
  getServiceHealth,
  getAllServicesHealth,
  areCriticalServicesAvailable,
  getServicesSummary,
  getSandboxLimitations,
  isFeatureAvailable,
  getServiceUnavailableMessage,
};

export default servicesExport;
