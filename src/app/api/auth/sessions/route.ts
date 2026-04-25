import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/auth/sessions - List active sessions for current user
export async function GET(request: NextRequest) {
  try {
    // Get session token from cookie
    const sessionToken = request.cookies.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Find current session
    const currentSession = await db.session.findUnique({
      where: { token: sessionToken },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!currentSession || currentSession.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Session expired' },
        { status: 401 }
      );
    }

    // Get all active sessions for the user
    const sessions = await db.session.findMany({
      where: {
        userId: currentSession.userId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Parse user agent for device info
    const parsedSessions = sessions.map((session) => {
      const ua = session.userAgent || '';
      const isCurrent = session.id === currentSession.id;

      // Parse user agent
      let deviceType = 'Unknown Device';
      let browser = 'Unknown Browser';
      let os = 'Unknown OS';

      // Detect device type
      if (/mobile/i.test(ua)) {
        deviceType = 'Mobile';
      } else if (/tablet/i.test(ua)) {
        deviceType = 'Tablet';
      } else if (/desktop/i.test(ua) || !/mobile|tablet/i.test(ua)) {
        deviceType = 'Desktop';
      }

      // Detect browser
      if (/firefox/i.test(ua)) {
        browser = 'Firefox';
      } else if (/edg/i.test(ua)) {
        browser = 'Microsoft Edge';
      } else if (/chrome/i.test(ua)) {
        browser = 'Chrome';
      } else if (/safari/i.test(ua)) {
        browser = 'Safari';
      } else if (/opera|opr/i.test(ua)) {
        browser = 'Opera';
      }

      // Detect OS
      if (/windows/i.test(ua)) {
        os = 'Windows';
      } else if (/mac os x/i.test(ua)) {
        os = 'macOS';
      } else if (/linux/i.test(ua)) {
        os = 'Linux';
      } else if (/android/i.test(ua)) {
        os = 'Android';
      } else if (/ios|iphone|ipad/i.test(ua)) {
        os = 'iOS';
      }

      return {
        id: session.id,
        isCurrent,
        deviceType,
        browser,
        os,
        userAgent: session.userAgent,
        ipAddress: session.ipAddress,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        lastActive: session.createdAt, // Using createdAt as last active since we don't track updates
      };
    });

    return NextResponse.json({
      success: true,
      sessions: parsedSessions,
      total: parsedSessions.length,
    });
  } catch (error) {
    console.error('Sessions fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

// DELETE /api/auth/sessions - Revoke all other sessions
export async function DELETE(request: NextRequest) {
  try {
    // Get session token from cookie
    const sessionToken = request.cookies.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Find current session
    const currentSession = await db.session.findUnique({
      where: { token: sessionToken },
    });

    if (!currentSession || currentSession.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Session expired' },
        { status: 401 }
      );
    }

    // Delete all other sessions
    const result = await db.session.deleteMany({
      where: {
        userId: currentSession.userId,
        NOT: { id: currentSession.id },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Revoked ${result.count} sessions`,
      revokedCount: result.count,
    });
  } catch (error) {
    console.error('Sessions revoke error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to revoke sessions' },
      { status: 500 }
    );
  }
}
