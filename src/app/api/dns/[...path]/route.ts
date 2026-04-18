import { NextRequest, NextResponse } from 'next/server';

const DNS_SERVICE_PORT = 3012;

/**
 * Catch-all proxy route for DNS management service.
 * Forwards requests from /api/dns/* to the dns-service on port 3012.
 *
 * Examples:
 *   GET  /api/dns/status       → dnsmasq status
 *   GET  /api/dns/forwarders   → list upstream forwarders
 *   POST /api/dns/forwarders   → add a forwarder
 *   GET  /api/dns/zones        → list DNS zones
 *   POST /api/dns/zones        → create zone
 *   GET  /api/dns/records      → list DNS records
 *   POST /api/dns/records      → create record
 *   GET  /api/dns/redirects    → list captive portal redirects
 *   GET  /api/dns/cache        → cache stats
 *   POST /api/dns/cache/flush  → flush cache
 *   POST /api/dns/service/start|stop|restart|reload → control dnsmasq
 *   GET  /api/dns/dhcp-dns     → DHCP-DNS integration entries
 */
async function proxyRequest(request: NextRequest, method: string) {
  try {
    const pathSegments = request.nextUrl.pathname
      .replace('/api/dns/', '')
      .replace('/api/dns', '');
    const searchParams = request.nextUrl.searchParams.toString();
    const targetUrl = `/api/${pathSegments}?XTransformPort=${DNS_SERVICE_PORT}${searchParams ? '&' + searchParams : ''}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const fetchOptions: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(10000),
    };

    // Include body for POST, PUT, PATCH
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      try {
        const body = await request.json();
        fetchOptions.body = JSON.stringify(body);
      } catch {
        // No body or invalid JSON
      }
    }

    const response = await fetch(targetUrl, fetchOptions);

    // Guard against gateway returning HTML error pages
    const ct = response.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      const bodyText = await response.text().catch(() => '');
      console.error('[DNS Proxy] Non-JSON response:', response.status, ct, bodyText.substring(0, 200));
      return NextResponse.json(
        { success: false, error: `DNS service returned non-JSON response (HTTP ${response.status})` },
        { status: 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    const isConnectionError = error.code === 'ECONNREFUSED' || error.cause?.code === 'ECONNREFUSED' || error.message?.includes('fetch failed');
    const isTimeout = error.name === 'TimeoutError' || error.message?.includes('abort');

    if (isConnectionError || isTimeout) {
      return NextResponse.json(
        { success: false, error: 'DNS service is not running' },
        { status: 503 }
      );
    }

    console.error('[DNS Proxy] Error:', error.message);
    return NextResponse.json(
      { success: false, error: `Failed to reach DNS service: ${error.message}` },
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
