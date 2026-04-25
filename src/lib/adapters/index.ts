/**
 * StaySuite Adapters Index
 * 
 * Unified exports for all service adapters
 * Each adapter auto-detects environment and provides seamless switching
 */

// Environment configuration
export {
  getConfig,
  getEnvironmentConfig,
  isServiceAvailable,
  getServiceStatus,
  type EnvironmentConfig,
  type ServiceConfig,
} from '../config/env';

// Service availability
export {
  getServiceHealth,
  getAllServicesHealth,
  areCriticalServicesAvailable,
  getServicesSummary,
  getSandboxLimitations,
  isFeatureAvailable,
  getServiceUnavailableMessage,
  type ServiceStatus,
  type ServiceName,
} from '../config/services';

// Cache adapter
export {
  getCache,
  resetCache,
  type CacheAdapter,
} from './cache';


// Email adapter
export {
  getEmail,
  sendEmail,
  sendEmailBatch,
  resetEmail,
  type EmailAdapter,
  type EmailOptions,
  type EmailResult,
} from './email';

// SMS adapter
export {
  getSMS,
  sendSMS,
  sendSMSBatch,
  resetSMS,
  type SMSAdapter,
  type SMSOptions,
  type SMSResult,
} from './sms';

// Queue adapter
export {
  getQueue,
  addJob,
  registerJobHandler,
  resetQueue,
  type QueueAdapter,
  type JobData,
  type JobResult,
  type JobHandler,
} from './queue';
