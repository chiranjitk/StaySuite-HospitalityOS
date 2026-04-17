import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/sessions - Get all sessions for current user
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('session_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Find current session
    const currentSession = await db.session.findUnique({
      where: { token },
      select: { userId: true },
    });

    if (!currentSession) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

    // Verify the session's user exists
    const sessionUser = await db.user.findFirst({
      where: { id: currentSession.userId },
      select: { id: true },
    });
    if (!sessionUser) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

    // Get all sessions for this user
    const sessions = await db.session.findMany({
      where: { userId: currentSession.userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
        token: true,
      },
    });

    // Format sessions for display
    const formattedSessions = sessions.map((session) => {
      // Parse user agent for device info
      const userAgent = session.userAgent || '';
      let device = 'Unknown Device';
      let deviceType = 'desktop';

      if (userAgent.includes('iPhone')) {
        device = 'Safari on iPhone';
        deviceType = 'mobile';
      } else if (userAgent.includes('iPad')) {
        device = 'Safari on iPad';
        deviceType = 'tablet';
      } else if (userAgent.includes('Android')) {
        device = 'Chrome on Android';
        deviceType = 'mobile';
      } else if (userAgent.includes('Mac OS')) {
        if (userAgent.includes('Chrome')) {
          device = 'Chrome on MacOS';
        } else if (userAgent.includes('Safari')) {
          device = 'Safari on MacOS';
        } else if (userAgent.includes('Firefox')) {
          device = 'Firefox on MacOS';
        } else {
          device = 'Browser on MacOS';
        }
      } else if (userAgent.includes('Windows')) {
        if (userAgent.includes('Chrome')) {
          device = 'Chrome on Windows';
        } else if (userAgent.includes('Firefox')) {
          device = 'Firefox on Windows';
        } else if (userAgent.includes('Edge')) {
          device = 'Edge on Windows';
        } else {
          device = 'Browser on Windows';
        }
      } else if (userAgent.includes('Linux')) {
        device = 'Browser on Linux';
      }

      return {
        id: session.id,
        device,
        deviceType,
        ip: session.ipAddress || 'Unknown',
        location: 'Unknown Location', // Would need GeoIP service for real location
        lastActive: session.createdAt,
        expiresAt: session.expiresAt,
        current: session.token === token,
      };
    });

    return NextResponse.json({ sessions: formattedSessions });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}

// DELETE /api/sessions - Revoke a session
export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get('session_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    // Find current session
    const currentSession = await db.session.findUnique({
      where: { token },
      select: { userId: true, token: true },
    });

    if (!currentSession) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

    // Verify the session's user exists
    const sessionUser = await db.user.findFirst({
      where: { id: currentSession.userId },
      select: { id: true },
    });
    if (!sessionUser) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

    // Find the session to revoke
    const sessionToRevoke = await db.session.findUnique({
      where: { id: sessionId },
      select: { userId: true, token: true },
    });

    if (!sessionToRevoke) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Ensure the session belongs to the current user
    if (sessionToRevoke.userId !== currentSession.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Don't allow revoking current session this way
    if (sessionToRevoke.token === currentSession.token) {
      return NextResponse.json(
        { error: 'Cannot revoke current session. Use logout instead.' },
        { status: 400 }
      );
    }

    // Delete the session
    await db.session.delete({
      where: { id: sessionId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error revoking session:', error);
    return NextResponse.json({ error: 'Failed to revoke session' }, { status: 500 });
  }
}
