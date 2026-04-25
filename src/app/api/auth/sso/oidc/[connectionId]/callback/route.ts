import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import OIDCService from '@/lib/auth/oidc-service';
import SSOProvisioningService from '@/lib/auth/sso-provisioning';
import crypto from 'crypto';

// GET /api/auth/sso/oidc/[connectionId]/callback - OIDC callback
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  try {
    const { connectionId } = await params;
    const { searchParams } = new URL(request.url);

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OIDC provider errors
    if (error) {
      console.error('OIDC provider error:', error, errorDescription);
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('error', errorDescription || error);
      return NextResponse.redirect(loginUrl);
    }

    if (!code || !state) {
      return NextResponse.json(
        { error: 'Authorization code and state are required' },
        { status: 400 }
      );
    }

    // Get callback URL
    const callbackUrl = OIDCService.getCallbackUrl(connectionId);

    // Exchange code for tokens
    const { tokens, userInfo, connectionId: connId } = await OIDCService.exchangeCode(
      code,
      state,
      callbackUrl
    );

    // Get connection for attribute mapping
    const connection = await db.sSOConnection.findUnique({
      where: { id: connId },
    });

    if (!connection) {
      throw new Error('Connection not found');
    }

    // Map OIDC user info to application attributes
    const mappedUser = OIDCService.mapUserInfo(userInfo, {
      emailAttribute: connection.emailAttribute,
      firstNameAttribute: connection.firstNameAttribute,
      lastNameAttribute: connection.lastNameAttribute,
      nameAttribute: connection.nameAttribute,
      roleAttribute: connection.roleAttribute,
      departmentAttribute: connection.departmentAttribute,
      phoneAttribute: connection.phoneAttribute,
    });

    // Build attributes for provisioning
    const attributes: Record<string, string | string[]> = {
      sub: userInfo.sub,
      email: mappedUser.email,
      firstName: mappedUser.firstName,
      lastName: mappedUser.lastName,
      name: mappedUser.name,
      phone: mappedUser.phone || '',
      avatar: mappedUser.avatar || '',
    };

    // Add any additional claims
    for (const [key, value] of Object.entries(userInfo)) {
      if (!['sub', 'email', 'given_name', 'family_name', 'name'].includes(key)) {
        if (typeof value === 'string') {
          attributes[key] = value;
        } else if (Array.isArray(value) && value.every(v => typeof v === 'string')) {
          attributes[key] = value as string[];
        }
      }
    }

    // Provision or update user
    const provisionResult = await SSOProvisioningService.provisionUser({
      connectionId: connection.id,
      tenantId: connection.tenantId,
      ssoProviderId: userInfo.sub,
      attributes,
    });

    if (!provisionResult.success || !provisionResult.user) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('error', provisionResult.error || 'User provisioning failed');
      return NextResponse.redirect(loginUrl);
    }

    // Create session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || undefined;

    // Create SSO session
    const ssoSessionId = await SSOProvisioningService.createSsoSession({
      connectionId: connection.id,
      userId: provisionResult.user.id,
      ssoProviderId: userInfo.sub,
      attributes: {
        ...attributes,
        access_token: tokens.access_token ?? '',
        id_token: tokens.id_token ?? '',
      },
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

    // Determine redirect URL from state or default
    let redirectUrl = '/';
    // State could contain a redirect URL encoded
    // For simplicity, we just redirect to home

    // Create response with session cookies
    const response = NextResponse.redirect(new URL(redirectUrl, request.url));

    response.cookies.set('session-token', sessionToken, {
      httpOnly: true,
      secure: request.headers.get('x-forwarded-proto') === 'https' || request.url.startsWith('https://'),
      sameSite: 'lax',
      maxAge: 24 * 60 * 60,
      path: '/',
    });

    response.cookies.set('refresh-token', refreshToken, {
      httpOnly: true,
      secure: request.headers.get('x-forwarded-proto') === 'https' || request.url.startsWith('https://'),
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    // Store OIDC tokens for later use (optional)
    if (tokens.refresh_token) {
      response.cookies.set('oidc-refresh', tokens.refresh_token, {
        httpOnly: true,
        secure: request.headers.get('x-forwarded-proto') === 'https' || request.url.startsWith('https://'),
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: '/',
      });
    }

    return response;
  } catch (error) {
    console.error('OIDC callback error:', error);
    
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', error instanceof Error ? error.message : 'Authentication failed');
    return NextResponse.redirect(loginUrl);
  }
}

// POST /api/auth/sso/oidc/[connectionId]/callback - Handle POST callbacks (some providers)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  const { connectionId } = await params;
  const formData = await request.formData();
  
  const code = formData.get('code') as string;
  const state = formData.get('state') as string;

  // Convert to query params and process as GET
  const url = new URL(request.url);
  if (code) url.searchParams.set('code', code);
  if (state) url.searchParams.set('state', state);

  const getRequest = new Request(url, {
    method: 'GET',
    headers: request.headers,
  });

  return GET(getRequest as NextRequest, { params: Promise.resolve({ connectionId }) });
}
