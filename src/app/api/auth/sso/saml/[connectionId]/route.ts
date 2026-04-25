import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import SAMLService from '@/lib/auth/saml-service';

// GET /api/auth/sso/saml/[connectionId] - Initiate SAML SSO or get metadata
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  try {
    const { connectionId } = await params;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Get metadata
    if (action === 'metadata') {
      const connection = await db.sSOConnection.findFirst({
        where: { id: connectionId, type: 'saml' },
      });

      if (!connection) {
        return NextResponse.json({ error: 'SAML connection not found' }, { status: 404 });
      }

      const metadata = SAMLService.generateMetadata(connection);

      return new NextResponse(metadata, {
        headers: {
          'Content-Type': 'application/xml',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // Initiate SSO
    const session = await getServerSession(authOptions);
    const tenantId = session?.user?.tenantId || searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }

    const relayState = searchParams.get('relayState') || undefined;
    const forceAuthn = searchParams.get('forceAuthn') === 'true';

    const result = await SAMLService.initiateSso(connectionId, tenantId, {
      relayState,
      forceAuthn,
    });

    // Redirect to IdP
    return NextResponse.redirect(result.redirectUrl);
  } catch (error) {
    console.error('SAML SSO initiation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to initiate SAML SSO' },
      { status: 500 }
    );
  }
}

// POST /api/auth/sso/saml/[connectionId] - Test SAML connection
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
      // Test connection by fetching metadata from IdP
      const connection = await db.sSOConnection.findFirst({
        where: { id: connectionId, tenantId: session.user.tenantId, type: 'saml' },
      });

      if (!connection) {
        return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
      }

      if (!connection.samlSsoUrl) {
        return NextResponse.json({
          success: false,
          message: 'SAML SSO URL not configured',
        });
      }

      // Try to reach the IdP
      try {
        const response = await fetch(connection.samlSsoUrl, {
          method: 'HEAD',
          signal: AbortSignal.timeout(10000),
        });

        const success = response.ok;

        await db.sSOConnection.update({
          where: { id: connectionId },
          data: {
            testConnectionAt: new Date(),
            testConnectionStatus: success ? 'success' : 'failed',
          },
        });

        return NextResponse.json({
          success,
          message: success ? 'SAML IdP is reachable' : 'SAML IdP returned an error',
        });
      } catch {
        await db.sSOConnection.update({
          where: { id: connectionId },
          data: {
            testConnectionAt: new Date(),
            testConnectionStatus: 'failed',
          },
        });

        return NextResponse.json({
          success: false,
          message: 'Could not connect to SAML IdP',
        });
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('SAML test error:', error);
    return NextResponse.json(
      { error: 'Failed to test SAML connection' },
      { status: 500 }
    );
  }
}
