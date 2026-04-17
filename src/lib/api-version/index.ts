/**
 * API Versioning Module
 * Provides version management, middleware, and utilities for API versioning
 */

// Types
export type {
  ApiVersion,
  VersionStatus,
  VersionConfig,
  ApiVersionInfo,
  DeprecationNotice,
  VersionExtractionResult,
  DeprecationConfig,
  VersioningOptions,
  VersionedResponse,
} from './types';

export {
  VERSION_HEADERS,
} from './types';

// Middleware and utilities
export {
  API_VERSIONS,
  VERSION_CONFIGS,
  DEPRECATION_CONFIG,
  getApiVersionInfo,
  isDeprecated,
  getSunsetDate,
  getDeprecationDate,
  getMigrationGuide,
  getDeprecationNotice,
  extractVersion,
  isValidVersion,
  addVersionHeaders,
  withVersioning,
  createVersionErrorResponse,
  getVersionFromPath,
  stripVersionFromPath,
  addVersionToPath,
  createVersionRedirect,
} from './middleware';
