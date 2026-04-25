/**
 * OTA Integration Module
 * Export all OTA-related functionality
 */

// Types
export * from './types';

// Configuration
export { 
  ALL_OTAS, 
  GLOBAL_OTAS, 
  INDIAN_OTAS, 
  ASIA_PACIFIC_OTAS, 
  EUROPEAN_OTAS, 
  VACATION_RENTAL_OTAS, 
  MIDDLE_EAST_AFRICA_OTAS, 
  METASEARCH_OTAS,
  getOTAById,
  getOTAsByRegion,
  getOTAsByType,
  getOTAsByPriority,
  getOTAsWithFeature,
  getOTACount,
} from './config';

// Client
export { 
  OTAClientFactory, 
  getAllOTAs, 
  getOTAConfig,
} from './client-factory';

export { BaseOTAClient } from './base-client';

// Sync Service
export { OTASyncService, OTASyncScheduler } from './sync-service';
