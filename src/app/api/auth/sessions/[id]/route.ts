import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// DELETE /api/auth/sessions/[id] - Revoke a specific session
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;

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
            tenantId: true,
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

    // Find the session to revoke
    const sessionToRevoke = await db.session.findUnique({
      where: { id: sessionId },
    });

    if (!sessionToRevoke) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    // Check if the session belongs to the current user
    if (sessionToRevoke.userId !== currentSession.userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Don't allow revoking current session
    if (sessionToRevoke.id === currentSession.id) {
      return NextResponse.json(
        { success: false, error: 'Cannot revoke current session. Use logout instead.' },
        { status: 400 }
      );
    }

    // Delete the session
    await db.session.delete({
      where: { id: sessionId },
    });

    // Create audit log
    try {
      await db.auditLog.create({
        data: {
          tenantId: currentSession.user.tenantId,
          userId: currentSession.userId,
          module: 'auth',
          action: 'session_revoked',
          entityType: 'session',
          entityId: sessionId,
          ipAddress: request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown',
          userAgent: request.headers.get('user-agent'),
        },
      });
    } catch {
      // Ignore audit log errors
    }

    return NextResponse.json({
      success: true,
      message: 'Session revoked successfully',
    });
  } catch (error) {
    console.error('Session revoke error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to revoke session' },
      { status: 500 }
    );
  }
}
