/**
 * API Versioning Middleware
 * Provides version extraction, deprecation handling, and version headers for API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  ApiVersion,
  ApiVersionInfo,
  ApiVersionInfo as ApiVersionInfoType,
  DeprecationConfig,
  DeprecationNotice,
  VersionConfig,
  VersionExtractionResult,
  VersioningOptions,
  VERSION_HEADERS,
} from './types';

/**
 * API Version Configuration
 */
export const API_VERSIONS = {
  V1: '1' as ApiVersion,
  V2: '2' as ApiVersion,
  CURRENT: '1' as ApiVersion,
  DEFAULT: '1' as ApiVersion,
} as const;

/**
 * Complete version configurations
 */
export const VERSION_CONFIGS: VersionConfig[] = [
  {
    version: '1',
    name: 'v1',
    releasedAt: '2024-01-01T00:00:00.000Z',
    status: 'current',
    releaseNotes: 'Initial API version with core hospitality management features',
  },
  {
    version: '2',
    name: 'v2',
    releasedAt: '2025-01-01T00:00:00.000Z',
    status: 'supported',
    releaseNotes: 'Enhanced API with improved pagination, filtering, and batch operations',
    breakingChanges: [
      'Pagination response format changed from { offset, limit } to { page, pageSize, totalPages }',
      'Date format changed from ISO string to ISO 8601 with timezone',
    ],
  },
];

/**
 * Deprecation configuration
 */
export const DEPRECATION_CONFIG: DeprecationConfig = {
  deprecated: [], // Currently no deprecated versions
  sunsetDates: {
    '1': undefined,
    '2': undefined,
  },
  deprecationDates: {
    '1': undefined,
    '2': undefined,
  },
  migrationGuides: {
    '1': undefined,
    '2': '/docs/api/migration/v1-to-v2',
  },
};

/**
 * Get complete API version information
 */
export function getApiVersionInfo(): ApiVersionInfoType {
  return {
    currentVersion: API_VERSIONS.CURRENT,
    versions: VERSION_CONFIGS,
    defaultVersion: API_VERSIONS.DEFAULT,
    baseUrl: '/api',
    docsUrl: '/api/docs',
  };
}

/**
 * Check if a version is deprecated
 */
export function isDeprecated(version: ApiVersion): boolean {
  return DEPRECATION_CONFIG.deprecated.includes(version);
}

/**
 * Get sunset date for a version
 */
export function getSunsetDate(version: ApiVersion): string | undefined {
  return DEPRECATION_CONFIG.sunsetDates[version];
}

/**
 * Get deprecation date for a version
 */
export function getDeprecationDate(version: ApiVersion): string | undefined {
  return DEPRECATION_CONFIG.deprecationDates[version];
}

/**
 * Get migration guide URL for a version
 */
export function getMigrationGuide(version: ApiVersion): string | undefined {
  return DEPRECATION_CONFIG.migrationGuides[version];
}

/**
 * Get deprecation notice for a version
 */
export function getDeprecationNotice(version: ApiVersion): DeprecationNotice | undefined {
  if (!isDeprecated(version)) {
    return undefined;
  }

  return {
    deprecated: true,
    sunset: getSunsetDate(version),
    migrationGuide: getMigrationGuide(version),
    message: `API version ${version} is deprecated and will be sunset on ${getSunsetDate(version)}. Please migrate to a newer version.`,
  };
}

/**
 * Extract version from request
 * Priority: URL path > Accept-Version header > Default
 */
export function extractVersion(request: NextRequest): VersionExtractionResult {
  const url = request.nextUrl.pathname;
  
  // Check URL path for version prefix (/api/v1/..., /api/v2/...)
  const urlVersionMatch = url.match(/^\/api\/v(\d+)\//);
  if (urlVersionMatch) {
    const version = urlVersionMatch[1] as ApiVersion;
    return {
      version,
      source: 'url',
      isDeprecated: isDeprecated(version),
      deprecationNotice: getDeprecationNotice(version),
    };
  }
  
  // Check Accept-Version header
  const headerVersion = request.headers.get(VERSION_HEADERS.ACCEPT_VERSION);
  if (headerVersion) {
    const version = headerVersion as ApiVersion;
    if (isValidVersion(version)) {
      return {
        version,
        source: 'header',
        isDeprecated: isDeprecated(version),
        deprecationNotice: getDeprecationNotice(version),
      };
    }
  }
  
  // Return default version
  return {
    version: API_VERSIONS.DEFAULT,
    source: 'default',
    isDeprecated: isDeprecated(API_VERSIONS.DEFAULT),
    deprecationNotice: getDeprecationNotice(API_VERSIONS.DEFAULT),
  };
}

/**
 * Check if a version string is valid
 */
export function isValidVersion(version: string): version is ApiVersion {
  return ['1', '2'].includes(version);
}

/**
 * Add version headers to response
 */
export function addVersionHeaders(
  response: NextResponse,
  version: ApiVersion,
  options: VersioningOptions = {}
): NextResponse {
  const { includeDeprecationHeaders = true, addWarningHeader = true } = options;
  
  // Add version header
  response.headers.set(VERSION_HEADERS.API_VERSION, version);
  
  // Add deprecation headers if version is deprecated
  if (includeDeprecationHeaders && isDeprecated(version)) {
    response.headers.set(VERSION_HEADERS.API_DEPRECATED, 'true');
    
    const sunsetDate = getSunsetDate(version);
    if (sunsetDate) {
      response.headers.set(VERSION_HEADERS.API_SUNSET, 'true');
      response.headers.set(VERSION_HEADERS.API_SUNSET_DATE, sunsetDate);
    }
    
    const migrationGuide = getMigrationGuide(version);
    if (migrationGuide) {
      response.headers.set(VERSION_HEADERS.API_MIGRATION_GUIDE, migrationGuide);
    }
    
    // Add Warning header (RFC 8594)
    if (addWarningHeader) {
      const warningMessage = `299 - "API version ${version} is deprecated" "${new Date().toISOString()}"`;
      response.headers.set(VERSION_HEADERS.WARNING, warningMessage);
    }
  }
  
  return response;
}

/**
 * Create a versioned response wrapper
 * Wraps API handler with version detection and header management
 */
export function withVersioning<T = unknown>(
  handler: (
    request: NextRequest,
    context: { params: Promise<Record<string, string | string[]>> }
  ) => Promise<NextResponse<T>>,
  options: VersioningOptions = {}
) {
  return async (
    request: NextRequest,
    context: { params: Promise<Record<string, string | string[]>> }
  ): Promise<NextResponse> => {
    // Extract version from request
    const { version, isDeprecated: deprecated, deprecationNotice } = extractVersion(request);
    
    // Execute handler
    const response = await handler(request, context);
    
    // Add version headers
    addVersionHeaders(response, version, options);
    
    // Add deprecation warning to response body if deprecated
    if (deprecated && deprecationNotice) {
      try {
        const body = await response.clone().json();
        const modifiedBody = {
          ...body,
          _meta: {
            ...((body as Record<string, unknown>)._meta as Record<string, unknown> || {}),
            deprecation: deprecationNotice,
          },
        };
        
        // Create new response with modified body
        return new NextResponse(JSON.stringify(modifiedBody), {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      } catch {
        // If response is not JSON, just return with headers
        return response;
      }
    }
    
    return response;
  };
}

/**
 * Create a version-aware error response
 */
export function createVersionErrorResponse(
  error: { code: string; message: string },
  status: number,
  version?: ApiVersion
): NextResponse {
  const response = NextResponse.json(
    {
      success: false,
      error,
      _meta: version ? { version } : undefined,
    },
    { status }
  );
  
  if (version) {
    response.headers.set(VERSION_HEADERS.API_VERSION, version);
  }
  
  return response;
}

/**
 * Get API version from path
 */
export function getVersionFromPath(path: string): ApiVersion | null {
  const match = path.match(/^\/api\/v(\d+)\//);
  if (match && isValidVersion(match[1])) {
    return match[1];
  }
  return null;
}

/**
 * Strip version prefix from path
 */
export function stripVersionFromPath(path: string): string {
  return path.replace(/^\/api\/v\d+\//, '/api/');
}

/**
 * Add version prefix to path
 */
export function addVersionToPath(path: string, version: ApiVersion): string {
  // Strip any existing version prefix
  const strippedPath = stripVersionFromPath(path);
  // Add new version prefix
  return strippedPath.replace(/^\/api\//, `/api/v${version}/`);
}

/**
 * Create version redirect response
 */
export function createVersionRedirect(
  request: NextRequest,
  targetVersion: ApiVersion
): NextResponse {
  const newUrl = addVersionToPath(request.nextUrl.pathname, targetVersion);
  const url = new URL(newUrl, request.url);
  url.search = request.nextUrl.search;
  
  return NextResponse.redirect(url, {
    status: 307, // Temporary redirect
    headers: {
      [VERSION_HEADERS.API_VERSION]: targetVersion,
      'X-API-Redirect': 'true',
      'X-API-Redirect-Reason': 'Version normalization',
    },
  });
}
