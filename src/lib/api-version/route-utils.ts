/**
 * Versioned Route Utilities
 * Helper functions to create versioned re-export routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractVersion, addVersionHeaders, API_VERSIONS } from '@/lib/api-version';

/**
 * Creates a versioned route handler that wraps the original handler
 * and adds version headers to the response
 */
export function createVersionedRouteHandlers(
  originalHandlers: {
    GET?: (request: NextRequest, context: { params: Promise<Record<string, string | string[]>> }) => Promise<NextResponse>;
    POST?: (request: NextRequest, context: { params: Promise<Record<string, string | string[]>> }) => Promise<NextResponse>;
    PUT?: (request: NextRequest, context: { params: Promise<Record<string, string | string[]>> }) => Promise<NextResponse>;
    PATCH?: (request: NextRequest, context: { params: Promise<Record<string, string | string[]>> }) => Promise<NextResponse>;
    DELETE?: (request: NextRequest, context: { params: Promise<Record<string, string | string[]>> }) => Promise<NextResponse>;
    HEAD?: (request: NextRequest, context: { params: Promise<Record<string, string | string[]>> }) => Promise<NextResponse>;
    OPTIONS?: (request: NextRequest, context: { params: Promise<Record<string, string | string[]>> }) => Promise<NextResponse>;
  },
  version: string = API_VERSIONS.V1
) {
  const wrapHandler = (
    handler: (request: NextRequest, context: { params: Promise<Record<string, string | string[]>> }) => Promise<NextResponse>
  ) => {
    return async (request: NextRequest, context: { params: Promise<Record<string, string | string[]>> }) => {
      const response = await handler(request, context);
      addVersionHeaders(response, version as '1' | '2');
      return response;
    };
  };

  const wrappedHandlers: Record<string, unknown> = {};

  if (originalHandlers.GET) wrappedHandlers.GET = wrapHandler(originalHandlers.GET);
  if (originalHandlers.POST) wrappedHandlers.POST = wrapHandler(originalHandlers.POST);
  if (originalHandlers.PUT) wrappedHandlers.PUT = wrapHandler(originalHandlers.PUT);
  if (originalHandlers.PATCH) wrappedHandlers.PATCH = wrapHandler(originalHandlers.PATCH);
  if (originalHandlers.DELETE) wrappedHandlers.DELETE = wrapHandler(originalHandlers.DELETE);
  if (originalHandlers.HEAD) wrappedHandlers.HEAD = wrapHandler(originalHandlers.HEAD);
  if (originalHandlers.OPTIONS) wrappedHandlers.OPTIONS = wrapHandler(originalHandlers.OPTIONS);

  return wrappedHandlers;
}

/**
 * Re-export handlers from an existing route with version headers
 * This is a simple wrapper that adds version headers to all responses
 */
export async function reExportWithVersion(
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> },
  originalHandler: (request: NextRequest, context: { params: Promise<Record<string, string | string[]>> }) => Promise<NextResponse>,
  version: '1' | '2' = '1'
): Promise<NextResponse> {
  const response = await originalHandler(request, context);
  addVersionHeaders(response, version);
  return response;
}
