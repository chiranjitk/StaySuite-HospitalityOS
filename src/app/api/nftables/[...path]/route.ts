import { NextRequest, NextResponse } from 'next/server';

const NFTABLES_SERVICE_PORT = 3013;

/**
 * Catch-all proxy route for nftables firewall service.
 * Forwards requests from /api/nftables/* to http://localhost:3013/api/*
 *
 * Examples:
 *   GET  /api/nftables/status             → status check
 *   GET  /api/nftables/default-chains     → preview generated config
 *   POST /api/nftables/default-chains     → generate & apply gateway ruleset
 *   POST /api/nftables/default-chains/users       → add logged-in user IP
 *   DELETE /api/nftables/default-chains/users     → remove logged-in user IP
 *   GET  /api/nftables/default-chains/users       → list logged-in user IPs
 *   POST /api/nftables/default-chains/mac-blacklist → add MAC to blacklist
 *   DELETE /api/nftables/default-chains/mac-blacklist → remove MAC from blacklist
 *   POST /api/nftables/apply               → apply full firewall config
 *   POST /api/nftables/rules               → add a single rule
 *   DELETE /api/nftables/rules             → remove a rule by handle
 *   POST /api/nftables/zones               → create a zone
 *   DELETE /api/nftables/zones/:name       → delete a zone
 *   POST /api/nftables/mac-filter          → add MAC to set
 *   DELETE /api/nftables/mac-filter        → remove MAC from set
 *   POST /api/nftables/bandwidth           → apply bandwidth limit
 *   POST /api/nftables/content-filter      → add content filter
 *   POST /api/nftables/test                → validate config
 *   POST /api/nftables/flush               → flush all rules
 *   GET  /api/nftables/health              → health check
 */
async function proxyRequest(request: NextRequest, method: string) {
  try {
    const pathSegments = request.nextUrl.pathname
      .replace('/api/nftables/', '')
      .replace('/api/nftables', '');
    const searchParams = request.nextUrl.searchParams.toString();
    const targetUrl = `/?XTransformPort=${NFTABLES_SERVICE_PORT}/api/${pathSegments}${searchParams ? '?' + searchParams : ''}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const fetchOptions: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(15000), // 15s timeout (nftables apply can be slow)
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
      console.warn('[nftables Proxy] nftables service unavailable at port', NFTABLES_SERVICE_PORT);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'nftables firewall service is not running. Start it with: cd mini-services/nftables-service && bun run dev',
          },
        },
        { status: 503 }
      );
    }

    console.error('[nftables Proxy] Error:', error.message);
    return NextResponse.json(
      { success: false, error: { code: 'PROXY_ERROR', message: `Failed to reach nftables service: ${error.message}` } },
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
