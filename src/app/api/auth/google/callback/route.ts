import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI ||
  (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000') + '/api/auth/google/callback';

// GET /api/auth/google/callback - Handle Google OAuth callback
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth error
    if (error) {
      console.error('Google OAuth error:', error);
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error)}`, request.url)
      );
    }

    // Verify state
    const stateCookie = request.cookies.get('oauth_state')?.value;
    const [stateValue, action] = (state || '').split(':');

    if (!stateCookie || stateCookie !== stateValue) {
      return NextResponse.redirect(
        new URL('/login?error=invalid_state', request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/login?error=no_code', request.url)
      );
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);
      return NextResponse.redirect(
        new URL('/login?error=token_exchange_failed', request.url)
      );
    }

    const tokenData = await tokenResponse.json();
    const { access_token, id_token } = tokenData;

    // Get user info from Google
    const userInfoResponse = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    if (!userInfoResponse.ok) {
      return NextResponse.redirect(
        new URL('/login?error=user_info_failed', request.url)
      );
    }

    const userInfo = await userInfoResponse.json();
    const { email, given_name, family_name, picture } = userInfo;

    // Check if user exists
    let user = await db.user.findFirst({
      where: { email: email.toLowerCase() },
      include: {
        role: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
            status: true,
          },
        },
      },
    });

    // If action is 'connect', link Google account to existing user
    if (action === 'connect') {
      const sessionToken = request.cookies.get('session_token')?.value;
      if (sessionToken) {
        const session = await db.session.findUnique({
          where: { token: sessionToken },
        });

        if (session) {
          // Link Google account - store in user metadata
          await db.user.update({
            where: { id: session.userId },
            data: {
              avatar: picture || undefined,
            },
          });

          return NextResponse.redirect(
            new URL('/?section=settings-security&message=google_linked', request.url)
          );
        }
      }
    }

    // If user doesn't exist, check if auto-registration is allowed
    if (!user) {
      // For demo purposes, we'll return an error
      // In production, you might want to auto-create users
      return NextResponse.redirect(
        new URL(`/login?error=user_not_found&email=${encodeURIComponent(email)}`, request.url)
      );
    }

    // Check if user is active
    if (user.status !== 'active') {
      return NextResponse.redirect(
        new URL('/login?error=account_inactive', request.url)
      );
    }

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      // Create temporary session for 2FA verification
      const tempToken = crypto.randomBytes(32).toString('hex');

      // Store temp session info
      const response = NextResponse.redirect(
        new URL(`/login?require_2fa=true&temp_token=${tempToken}&email=${encodeURIComponent(email)}`, request.url)
      );

      // Store temp token in cookie
      response.cookies.set('temp_oauth_token', tempToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 300, // 5 minutes
        path: '/',
      });

      return response;
    }

    // Update user
    await db.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        failedAttempts: 0,
        lockedUntil: null,
        avatar: picture || user.avatar,
      },
    });

    // Create session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.session.create({
      data: {
        userId: user.id,
        token: sessionToken,
        refreshToken: crypto.randomBytes(32).toString('hex'),
        expiresAt,
        userAgent: request.headers.get('user-agent') || null,
        ipAddress: request.headers.get('x-forwarded-for') ||
                   request.headers.get('x-real-ip') ||
                   'unknown',
      },
    });

    // Parse permissions
    let permissions: string[] = [];
    if (user.role?.permissions) {
      try {
        permissions = JSON.parse(user.role.permissions);
      } catch {
        permissions = [];
      }
    }

    // Create audit log
    try {
      await db.auditLog.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          module: 'auth',
          action: 'google_login',
          entityType: 'user',
          entityId: user.id,
          ipAddress: request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown',
          userAgent: request.headers.get('user-agent'),
        },
      });
    } catch {
      // Ignore audit log errors
    }

    // Create response with session cookie
    const response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.set('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/login?error=oauth_failed', request.url)
    );
  }
}
