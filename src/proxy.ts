import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale, isValidLocale } from './i18n/config';

// =====================================================
// PUBLIC PATHS - Routes that don't require authentication
// =====================================================
const PUBLIC_PATHS = [
  // Auth routes
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-email',
  '/api/auth/google',
  '/api/auth/google/callback',
  '/api/auth/[...nextauth]',
  '/api/auth/sso/connections',
  '/api/auth/sso/',        // SSO OIDC callbacks (use connection-specific auth)
  '/api/auth/2fa/',        // 2FA setup/verify/disable endpoints
  // Booking engine (public-facing)
  '/api/booking-engine/',
  '/api/book',              // Public booking endpoint
  // Public API
  '/api/public',
  // Webhooks (receive from external services)
  '/api/webhooks/',
  '/api/ota/webhooks',
  // Health/version/docs (no auth needed)
  '/api/health',
  '/api/version',
  '/api/docs',
  // Public v1 API routes
  '/api/v1/auth/',          // v1 auth endpoints
  '/api/v1/properties',     // property listing
  '/api/v1/rooms/available', // room availability
  '/api/v1/wifi/',          // FreeRADIUS proxy (uses RADIUS auth)
  // Tenant listing (for signup flow)
  '/api/tenants',
  // NOTE: /api/cron/ is handled separately with CRON_SECRET validation (step 3)
  // Guest app (uses portal tokens in query)
  '/api/guest-app/',
  '/api/guest/',
  // Portal token exchange and in-room portal
  '/api/portal/token',
  '/api/portal/in-room',
  '/api/portal/e-sign',
  '/api/portal/kyc',
  // Public search
  '/api/search',
  // Vendor portal (self-service)
  '/api/vendors/portal',
  // Tutorial progress (self-service)
  '/api/tutorials/progress',
  // Network service proxies (dhcp-service, dns-service, nftables-service, freeradius-service)
  '/api/kea/',             // DHCP service proxy (dnsmasq backend)
  '/api/dns/',             // DNS service proxy
  '/api/nftables/',        // nftables service proxy
  '/api/network/os',       // Network interface data (used by DHCP/VLAN pages)
  // Page routes
  '/login',
  '/signup',
  '/reset-password',
  '/verify-email',
  '/book',
  '/portal',
  '/guest',
];

/**
 * Extract client IP from request headers
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}

/**
 * Check if an IP matches a whitelist entry (supports CIDR and wildcards)
 */
function isIpAllowed(ip: string, whitelist: string[]): boolean {
  if (whitelist.length === 0) return true;

  for (const entry of whitelist) {
    if (entry === '*') return true;
    if (entry === ip) return true;

    if (entry.endsWith('.*')) {
      const prefix = entry.slice(0, -1);
      if (ip.startsWith(prefix)) return true;
    }

    if (entry.includes('/')) {
      const [network, bitsStr] = entry.split('/');
      const bits = parseInt(bitsStr, 10);
      if (network && !isNaN(bits)) {
        const ipParts = ip.split('.').map(Number);
        const netParts = network.split('.').map(Number);

        if (ipParts.length === 4 && netParts.length === 4) {
          const ipNum = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
          const netNum = (netParts[0] << 24) | (netParts[1] << 16) | (netParts[2] << 8) | netParts[3];
          const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;

          if ((ipNum & mask) === (netNum & mask)) return true;
        }
      }
    }
  }

  return false;
}

// =====================================================
// MAIN PROXY HANDLER
// Combines: locale detection + JWT auth + IP whitelist
// =====================================================
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- 1. Skip API routes, static files, and special paths for locale ---
  const isApi = pathname.startsWith('/api/');
  const isStatic = pathname.startsWith('/_next/') || pathname.startsWith('/_vercel/') || pathname.includes('.');
  const isSpecial = pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/signup') ||
    pathname.startsWith('/book') || pathname.startsWith('/portal') || pathname.startsWith('/guest') ||
    pathname.startsWith('/public') || pathname.startsWith('/help') || pathname.startsWith('/settings-security');

  // --- 2. Determine locale ---
  let locale = defaultLocale;
  const cookieLocale = request.cookies.get('locale')?.value;

  if (cookieLocale && isValidLocale(cookieLocale)) {
    locale = cookieLocale;
  } else {
    const acceptLanguage = request.headers.get('accept-language');
    if (acceptLanguage) {
      const languages = acceptLanguage
        .split(',')
        .map(lang => lang.split(';')[0].trim().substring(0, 2))
        .filter(Boolean);

      for (const lang of languages) {
        if (isValidLocale(lang)) {
          locale = lang;
          break;
        }
      }
    }
  }

  // Build the response with locale cookie
  const response = NextResponse.next();

  // Security headers
  response.headers.set('X-Frame-Options', 'ALLOWALL');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' ws: wss:; frame-ancestors '*';");
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  if (!cookieLocale || cookieLocale !== locale) {
    response.cookies.set('locale', locale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
  }

  // --- 3. Cron route protection (CRON_SECRET header) ---
  if (pathname.startsWith('/api/cron/')) {
    const cronSecret = request.headers.get('x-cron-secret');
    if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or missing cron secret' } },
        { status: 401 }
      );
    }
    // Valid cron request, proceed without session check
    return response;
  }

  // --- 4. Authentication check ---
  const isPublicApi = isApi && PUBLIC_PATHS.some(p => pathname.startsWith(p));
  if (!isStatic && !isSpecial && !isPublicApi) {
    const sessionToken = request.cookies.get('session_token')?.value;

    if (!sessionToken) {
      if (isApi) {
        return NextResponse.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
          { status: 401 }
        );
      }
      // Page routes redirect to login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // --- 5. IP whitelist enforcement ---
  const globalIpWhitelist = process.env.IP_WHITELIST
    ? process.env.IP_WHITELIST.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const tenantIpWhitelistCookie = request.cookies.get('tenant_ip_whitelist')?.value;
  const tenantIpWhitelist = tenantIpWhitelistCookie
    ? tenantIpWhitelistCookie.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const effectiveWhitelist = [...globalIpWhitelist, ...tenantIpWhitelist];

  if (effectiveWhitelist.length > 0) {
    const clientIp = getClientIp(request);
    if (!isIpAllowed(clientIp, effectiveWhitelist)) {
      if (isApi) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'IP_BLOCKED',
              message: `Access denied: your IP address (${clientIp}) is not in the allowed whitelist`,
            },
          },
          { status: 403 }
        );
      }
      return new NextResponse('Access Denied: IP not allowed', { status: 403 });
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|_next/webpack|_vercel|favicon.ico|.*\\..*).*)'],
};

