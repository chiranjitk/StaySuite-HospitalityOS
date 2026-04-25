import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import SAMLService from '@/lib/auth/saml-service';
import SSOProvisioningService from '@/lib/auth/sso-provisioning';
import { hashPassword } from '@/lib/auth';
import crypto from 'crypto';

// POST /api/auth/sso/saml/[connectionId]/acs - SAML Assertion Consumer Service
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  try {
    const { connectionId } = await params;
    const formData = await request.formData();
    
    const samlResponse = formData.get('SAMLResponse') as string;
    const relayState = formData.get('RelayState') as string | null;

    if (!samlResponse) {
      return NextResponse.json({ error: 'SAMLResponse is required' }, { status: 400 });
    }

    // Process SAML response
    const { assertion, connection } = await SAMLService.processResponse(
      connectionId,
      samlResponse
    );

    // Extract attributes
    const attributes: Record<string, string | string[]> = {
      ...assertion.attributes,
      nameId: assertion.subject.nameId,
    };

    // Provision or find user
    const provisionResult = await SSOProvisioningService.provisionUser({
      connectionId: connection.id,
      tenantId: connection.tenantId,
      ssoProviderId: assertion.subject.nameId,
      attributes,
    });

    if (!provisionResult.success || !provisionResult.user) {
      // Redirect to login with error
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('error', provisionResult.error || 'Authentication failed');
      return NextResponse.redirect(loginUrl);
    }

    // Create session for the user
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Get client IP and user agent
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || undefined;

    // Create SSO session
    const ssoSessionId = await SSOProvisioningService.createSsoSession({
      connectionId: connection.id,
      userId: provisionResult.user.id,
      ssoProviderId: assertion.subject.nameId,
      attributes,
      ipAddress,
      userAgent,
    });

    // Create app session
    await db.session.create({
      data: {
        userId: provisionResult.user.id,
        token: sessionToken,
        refreshToken,
        userAgent,
        ipAddress,
        expiresAt,
      },
    });

    // Update SSO session with app session reference
    await db.sSOSession.update({
      where: { id: ssoSessionId },
      data: { sessionId: sessionToken },
    });

    // Determine redirect URL
    let redirectUrl = '/';
    if (relayState) {
      try {
        // Validate relayState is a relative URL or safe redirect
        const decoded = Buffer.from(relayState, 'base64').toString();
        if (decoded.startsWith('/')) {
          redirectUrl = decoded;
        }
      } catch {
        // Invalid relay state, use default
      }
    }

    // Create response with session cookie
    const response = NextResponse.redirect(new URL(redirectUrl, request.url));
    
    // Set session cookie
    response.cookies.set('session-token', sessionToken, {
      httpOnly: true,
      secure: request.headers.get('x-forwarded-proto') === 'https' || request.url.startsWith('https://'),
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/',
    });

    response.cookies.set('refresh-token', refreshToken, {
      httpOnly: true,
      secure: request.headers.get('x-forwarded-proto') === 'https' || request.url.startsWith('https://'),
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('SAML ACS error:', error);
    
    // Redirect to login with error
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', error instanceof Error ? error.message : 'Authentication failed');
    return NextResponse.redirect(loginUrl);
  }
}

// GET /api/auth/sso/saml/[connectionId]/acs - Handle GET requests (some IdPs use GET)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  const { connectionId } = await params;
  const { searchParams } = new URL(request.url);
  
  const samlResponse = searchParams.get('SAMLResponse');
  const relayState = searchParams.get('RelayState');

  if (!samlResponse) {
    return NextResponse.json({ error: 'SAMLResponse is required' }, { status: 400 });
  }

  // Convert to form data and process as POST
  const formData = new FormData();
  formData.set('SAMLResponse', samlResponse);
  if (relayState) {
    formData.set('RelayState', relayState);
  }

  // Create a new request with the form data
  const postRequest = new Request(request.url, {
    method: 'POST',
    body: formData,
    headers: request.headers,
  });

  return POST(postRequest as NextRequest, { params: Promise.resolve({ connectionId }) });
}
