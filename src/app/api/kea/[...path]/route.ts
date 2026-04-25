import { NextRequest, NextResponse } from 'next/server';

const KEA_SERVICE_URL = 'http://localhost:3011';

/**
 * Catch-all proxy route for Kea DHCP4 service.
 * Forwards requests from /api/kea/* to http://localhost:3011/api/*
 *
 * Examples:
 *   GET  /api/kea/status       → http://localhost:3011/api/status
 *   GET  /api/kea/subnets      → http://localhost:3011/api/subnets
 *   POST /api/kea/subnets      → http://localhost:3011/api/subnets
 *   GET  /api/kea/reservations → http://localhost:3011/api/reservations
 *   GET  /api/kea/leases       → http://localhost:3011/api/leases
 *   POST /api/kea/service/start → http://localhost:3011/api/service/start
 */
async function proxyRequest(request: NextRequest, method: string) {
  try {
    const pathSegments = request.nextUrl.pathname
      .replace('/api/kea/', '')
      .replace('/api/kea', '');
    const searchParams = request.nextUrl.searchParams.toString();
    const targetUrl = `${KEA_SERVICE_URL}/api/${pathSegments}${searchParams ? '?' + searchParams : ''}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const fetchOptions: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(8000), // 8s timeout
    };

    // Include body for POST, PUT, PATCH
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      try {
        const body = await request.json();
        fetchOptions.body = JSON.stringify(body);
      } catch {
        // No body or invalid JSON — that's okay for some endpoints
      }
    }

    const response = await fetch(targetUrl, fetchOptions);
    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    const isConnectionError = error.code === 'ECONNREFUSED' || error.cause?.code === 'ECONNREFUSED' || error.message?.includes('fetch failed');
    const isTimeout = error.name === 'TimeoutError' || error.message?.includes('abort');

    if (isConnectionError || isTimeout) {
      console.warn('[Kea Proxy] Kea DHCP service unavailable at', KEA_SERVICE_URL);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Kea DHCP service is not running. Start it with: cd mini-services/kea-service && bun run dev',
            hint: 'OS network data is available at /api/network/os without kea-service',
          },
        },
        { status: 503 }
      );
    }

    console.error('[Kea Proxy] Error:', error.message);
    return NextResponse.json(
      { success: false, error: { code: 'PROXY_ERROR', message: `Failed to reach Kea DHCP service: ${error.message}` } },
      { status: 502 }
    );
  }
}

export async function GET(request: NextRequest) {
  return proxyRequest(request, 'GET');
}

export async function POST(request: NextRequest) {
  return proxyRequest(request, 'POST');
}

export async function PUT(request: NextRequest) {
  return proxyRequest(request, 'PUT');
}

export async function DELETE(request: NextRequest) {
  return proxyRequest(request, 'DELETE');
}

export async function PATCH(request: NextRequest) {
  return proxyRequest(request, 'PATCH');
}
