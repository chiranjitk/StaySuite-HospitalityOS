import { NextResponse } from 'next/server';
import { openApiSpec } from '@/lib/api-docs/openapi-spec';

/**
 * OpenAPI Specification JSON Endpoint
 * Serves the complete OpenAPI 3.0 specification for StaySuite API
 */

export async function GET() {
  return NextResponse.json(openApiSpec, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
