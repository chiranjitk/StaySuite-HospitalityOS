import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logAuth } from '@/lib/audit';

// POST /api/auth/logout
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('session_token')?.value;

    if (token) {
      // Get session info before deleting
      const session = await db.session.findFirst({
        where: { token },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              tenantId: true,
            },
          },
        },
      });

      // Delete session from database
      await db.session.deleteMany({
        where: { token },
      });

      // Log logout event (non-blocking: audit failures should not break logout)
      if (session?.user) {
        try {
          await logAuth(request, 'logout', session.user.id, {
            email: session.user.email,
          });
        } catch (auditError) {
          console.error('Failed to log logout audit event:', auditError);
        }
      }
    }

    const response = NextResponse.json({ success: true });
    
    // Clear session cookie
    response.cookies.set('session_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: new Date(0),
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred during logout' },
      { status: 500 }
    );
  }
}
