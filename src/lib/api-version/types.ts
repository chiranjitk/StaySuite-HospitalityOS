/**
 * API Versioning Types
 * Defines types for API version management, deprecation notices, and version negotiation
 */

/**
 * Supported API versions
 */
export type ApiVersion = '1' | '2';

/**
 * Version status
 */
export type VersionStatus = 'current' | 'supported' | 'deprecated' | 'sunset';

/**
 * Version configuration
 */
export interface VersionConfig {
  /** Version identifier */
  version: ApiVersion;
  /** Human-readable version name */
  name: string;
  /** Release date */
  releasedAt: string;
  /** Current status of this version */
  status: VersionStatus;
  /** Deprecation date (if deprecated) */
  deprecatedAt?: string;
  /** Sunset date (when the version will be removed) */
  sunsetAt?: string;
  /** Migration guide URL */
  migrationGuide?: string;
  /** Release notes */
  releaseNotes?: string;
  /** Breaking changes from previous version */
  breakingChanges?: string[];
}

/**
 * API version information response
 */
export interface ApiVersionInfo {
  /** Current API version */
  currentVersion: ApiVersion;
  /** All supported versions */
  versions: VersionConfig[];
  /** Default version for unversioned requests */
  defaultVersion: ApiVersion;
  /** API base URL */
  baseUrl: string;
  /** Documentation URL */
  docsUrl: string;
}

/**
 * Deprecation notice
 */
export interface DeprecationNotice {
  /** Is this version deprecated */
  deprecated: boolean;
  /** Sunset date if deprecated */
  sunset?: string;
  /** Migration guide URL */
  migrationGuide?: string;
  /** Warning message */
  message?: string;
}

/**
 * Version extraction result
 */
export interface VersionExtractionResult {
  /** Extracted version */
  version: ApiVersion;
  /** Source of version detection */
  source: 'url' | 'header' | 'default';
  /** Whether this version is deprecated */
  isDeprecated: boolean;
  /** Deprecation notice if applicable */
  deprecationNotice?: DeprecationNotice;
}

/**
 * Version header names
 */
export const VERSION_HEADERS = {
  /** Accept-Version header for version negotiation */
  ACCEPT_VERSION: 'Accept-Version',
  /** X-API-Version response header */
  API_VERSION: 'X-API-Version',
  /** X-API-Deprecated header */
  API_DEPRECATED: 'X-API-Deprecated',
  /** X-API-Sunset header */
  API_SUNSET: 'X-API-Sunset',
  /** X-API-Sunset-Date header */
  API_SUNSET_DATE: 'X-API-Sunset-Date',
  /** X-API-Migration-Guide header */
  API_MIGRATION_GUIDE: 'X-API-Migration-Guide',
  /** Warning header (RFC 8594) */
  WARNING: 'Warning',
} as const;

/**
 * Version deprecation configuration
 */
export interface DeprecationConfig {
  /** Versions that are deprecated */
  deprecated: ApiVersion[];
  /** Map of version to sunset date */
  sunsetDates: Record<ApiVersion, string | undefined>;
  /** Map of version to deprecation date */
  deprecationDates: Record<ApiVersion, string | undefined>;
  /** Map of version to migration guide URL */
  migrationGuides: Record<ApiVersion, string | undefined>;
}

/**
 * Versioning middleware options
 */
export interface VersioningOptions {
  /** Default version if no version specified */
  defaultVersion?: ApiVersion;
  /** Whether to include deprecation headers */
  includeDeprecationHeaders?: boolean;
  /** Whether to add warning header for deprecated versions */
  addWarningHeader?: boolean;
  /** Custom deprecation message */
  deprecationMessage?: string;
}

/**
 * API route handler type
 */
export type ApiRouteHandler<T = unknown> = (
  request: Request,
  context: { params: Promise<Record<string, string | string[]>> }
) => Promise<Response>;

/**
 * Response with version headers
 */
export interface VersionedResponse<T = unknown> extends Response {
  headers: Headers & {
    get(name: typeof VERSION_HEADERS[keyof typeof VERSION_HEADERS]): string | null;
  };
}
