import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import OIDCService from '@/lib/auth/oidc-service';

// GET /api/auth/sso/oidc/[connectionId] - Initiate OIDC flow or test connection
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  try {
    const { connectionId } = await params;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Handle test connection
    if (action === 'test') {
      const session = await getServerSession(authOptions);
      if (!session?.user?.tenantId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const result = await OIDCService.testConnection(connectionId, session.user.tenantId);
      return NextResponse.json(result);
    }

    // Initiate OIDC flow
    const session = await getServerSession(authOptions);
    const tenantId = session?.user?.tenantId || searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }

    // Get callback URL
    const callbackUrl = OIDCService.getCallbackUrl(connectionId);

    // Build authorization URL
    const result = await OIDCService.buildAuthorizationUrl({
      connectionId,
      tenantId,
      redirectUri: callbackUrl,
      state: searchParams.get('state') || undefined,
      prompt: searchParams.get('prompt') as 'none' | 'login' | 'consent' | 'select_account' | undefined,
      loginHint: searchParams.get('login_hint') || undefined,
    });

    // Redirect to OIDC provider
    return NextResponse.redirect(result.url);
  } catch (error) {
    console.error('OIDC initiation error:', error);
    
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', error instanceof Error ? error.message : 'Authentication failed');
    return NextResponse.redirect(loginUrl);
  }
}

// POST /api/auth/sso/oidc/[connectionId] - Test connection
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  try {
    const { connectionId } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const action = body.action;

    if (action === 'test') {
      const result = await OIDCService.testConnection(connectionId, session.user.tenantId);
      return NextResponse.json(result);
    }

    if (action === 'logout') {
      const postLogoutUri = body.postLogoutRedirectUri;
      const idTokenHint = body.idTokenHint;

      const logoutUrl = await OIDCService.buildLogoutUrl(
        connectionId,
        postLogoutUri,
        idTokenHint
      );

      return NextResponse.json({
        success: true,
        logoutUrl,
      });
    }

    if (action === 'refresh') {
      const refreshToken = body.refreshToken;
      if (!refreshToken) {
        return NextResponse.json({ error: 'Refresh token required' }, { status: 400 });
      }

      const tokens = await OIDCService.refreshAccessToken(connectionId, refreshToken);
      return NextResponse.json({
        success: true,
        tokens,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('OIDC POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Operation failed' },
      { status: 500 }
    );
  }
}
