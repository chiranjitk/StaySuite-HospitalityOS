/**
 * API Version Information Endpoint
 * GET /api/version - Returns comprehensive API version information
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getApiVersionInfo,
  API_VERSIONS,
  VERSION_CONFIGS,
  DEPRECATION_CONFIG,
  extractVersion,
  addVersionHeaders,
} from '@/lib/api-version';

/**
 * GET /api/version
 * Returns comprehensive API version information
 */
export async function GET(request: NextRequest) {
  // Extract requested version for header consistency
  const { version } = extractVersion(request);
  
  const versionInfo = getApiVersionInfo();
  
  // Build response with additional metadata
  const response = {
    success: true,
    data: {
      ...versionInfo,
      // Add deprecation status for all versions
      deprecationStatus: Object.fromEntries(
        VERSION_CONFIGS.map((v) => [
          v.version,
          {
            isDeprecated: DEPRECATION_CONFIG.deprecated.includes(v.version as '1' | '2'),
            deprecationDate: DEPRECATION_CONFIG.deprecationDates[v.version as '1' | '2'],
            sunsetDate: DEPRECATION_CONFIG.sunsetDates[v.version as '1' | '2'],
          },
        ])
      ),
      // Current version details
      currentVersionDetails: VERSION_CONFIGS.find((v) => v.version === API_VERSIONS.CURRENT),
      // Server time for synchronization
      serverTime: new Date().toISOString(),
      // Supported API styles
      versioningStyles: {
        urlBased: {
          description: 'Version in URL path',
          example: '/api/v1/bookings',
          supported: true,
        },
        headerBased: {
          description: 'Version via Accept-Version header',
          example: 'Accept-Version: 1',
          supported: true,
        },
      },
      // Links
      links: {
        self: '/api/version',
        docs: '/api/docs',
        openapi: '/api/docs/openapi.json',
        health: '/api/health',
      },
    },
  };
  
  const nextResponse = NextResponse.json(response);
  addVersionHeaders(nextResponse, version);
  
  return nextResponse;
}

/**
 * OPTIONS /api/version
 * Returns CORS and allowed methods
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Allow': 'GET, OPTIONS',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept-Version',
    },
  });
}
