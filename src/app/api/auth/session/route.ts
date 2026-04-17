import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

// Default idle timeout: 30 minutes (configurable per tenant)
const DEFAULT_IDLE_TIMEOUT_MINUTES = 30;
// Default password expiry: 90 days
const DEFAULT_PASSWORD_EXPIRY_DAYS = 90;

// Helper: build user response object from session
function buildUserResponse(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
  phone: string | null;
  jobTitle: string | null;
  department: string | null;
  twoFactorEnabled: boolean;
  roleId: string | null;
  tenantId: string;
  isPlatformAdmin: boolean;
  role: { name: string; permissions: string } | null;
  tenant: { id: string; name: string; slug: string; plan: string; status: string };
}) {
  let permissions: string[] = [];
  if (user.role?.permissions) {
    try {
      permissions = JSON.parse(user.role.permissions);
    } catch {
      permissions = [];
    }
  }

  return {
    id: user.id,
    email: user.email,
    name: `${user.firstName} ${user.lastName}`,
    firstName: user.firstName,
    lastName: user.lastName,
    avatar: user.avatar,
    phone: user.phone,
    jobTitle: user.jobTitle,
    department: user.department,
    twoFactorEnabled: user.twoFactorEnabled,
    roleId: user.roleId,
    roleName: user.role?.name || 'staff',
    permissions,
    tenantId: user.tenantId,
    tenant: user.tenant,
    isPlatformAdmin: user.isPlatformAdmin || false,
  };
}

// Helper: get tenant settings (idle timeout, password expiry)
async function getTenantSecuritySettings(tenantId: string): Promise<{
  idleTimeoutMinutes: number;
  passwordExpiryDays: number;
}> {
  try {
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    if (tenant?.settings) {
      const parsed = JSON.parse(tenant.settings);
      return {
        idleTimeoutMinutes: parsed.sessionTimeout || DEFAULT_IDLE_TIMEOUT_MINUTES,
        passwordExpiryDays: parsed.passwordExpiryDays || DEFAULT_PASSWORD_EXPIRY_DAYS,
      };
    }
  } catch {
    // Fall through to defaults
  }
  return {
    idleTimeoutMinutes: DEFAULT_IDLE_TIMEOUT_MINUTES,
    passwordExpiryDays: DEFAULT_PASSWORD_EXPIRY_DAYS,
  };
}

// GET /api/auth/session - Get current session (with idle timeout + password expiry checks)
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('session_token')?.value;

    if (!token) {
      return NextResponse.json({ success: false, user: null });
    }

    // Find session
    const session = await db.session.findUnique({
      where: { token },
      include: {
        user: {
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
        },
      },
    });

    if (!session || session.expiresAt < new Date()) {
      // Session expired or not found
      if (session) {
        await db.session.delete({ where: { id: session.id } }).catch(() => {});
      }
      return NextResponse.json({ success: false, user: null });
    }

    const user = session.user;

    // Check if user is still active
    if (user.status !== 'active' || user.deletedAt) {
      await db.session.delete({ where: { id: session.id } }).catch(() => {});
      return NextResponse.json({ success: false, user: null });
    }

    // FIX 3: Idle session timeout check
    const securitySettings = await getTenantSecuritySettings(user.tenantId);
    const idleTimeoutMs = securitySettings.idleTimeoutMinutes * 60 * 1000;

    if (session.lastActive) {
      const idleDuration = Date.now() - session.lastActive.getTime();
      if (idleDuration > idleTimeoutMs) {
        // Session is idle too long — require refresh
        return NextResponse.json({
          success: true,
          requiresRefresh: true,
          message: `Session idle for too long (${securitySettings.idleTimeoutMinutes} minutes). Please refresh your session.`,
        });
      }
    }

    // Update lastActive timestamp (fire-and-forget)
    db.session.update({
      where: { id: session.id },
      data: { lastActive: new Date() },
    }).catch(() => {});

    // FIX 4: Password expiry enforcement
    if (user.passwordChangedAt) {
      const passwordAgeMs = Date.now() - user.passwordChangedAt.getTime();
      const passwordExpiryMs = securitySettings.passwordExpiryDays * 24 * 60 * 60 * 1000;
      if (passwordAgeMs > passwordExpiryMs) {
        return NextResponse.json({
          success: true,
          user: buildUserResponse(user),
          requiresPasswordChange: true,
          message: `Your password has expired (changed ${securitySettings.passwordExpiryDays}+ days ago). Please change your password.`,
        });
      }
    } else if (user.createdAt) {
      // If passwordChangedAt was never set, use account creation date
      const accountAgeMs = Date.now() - user.createdAt.getTime();
      const passwordExpiryMs = securitySettings.passwordExpiryDays * 24 * 60 * 60 * 1000;
      if (accountAgeMs > passwordExpiryMs) {
        return NextResponse.json({
          success: true,
          user: buildUserResponse(user),
          requiresPasswordChange: true,
          message: `Your password has expired. Please change your password.`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      user: buildUserResponse(user),
    });
  } catch (error) {
    console.error('Session error:', error);
    return NextResponse.json({ success: false, user: null });
  }
}

// POST /api/auth/session - Refresh session (token rotation)
export async function POST(request: NextRequest) {
  try {
    const currentToken = request.cookies.get('session_token')?.value;

    if (!currentToken) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'No session token found' } },
        { status: 401 }
      );
    }

    // Find and validate current session
    const session = await db.session.findUnique({
      where: { token: currentToken },
      include: {
        user: {
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
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_SESSION', message: 'Session not found' } },
        { status: 401 }
      );
    }

    if (session.expiresAt < new Date()) {
      await db.session.delete({ where: { id: session.id } }).catch(() => {});
      return NextResponse.json(
        { success: false, error: { code: 'SESSION_EXPIRED', message: 'Session has expired' } },
        { status: 401 }
      );
    }

    const user = session.user;

    // Check if user is still active
    if (user.status !== 'active' || user.deletedAt) {
      await db.session.delete({ where: { id: session.id } }).catch(() => {});
      return NextResponse.json(
        { success: false, error: { code: 'USER_INACTIVE', message: 'User account is not active' } },
        { status: 401 }
      );
    }

    // Generate new tokens
    const newToken = crypto.randomBytes(32).toString('hex');
    const newRefreshToken = crypto.randomBytes(32).toString('hex');

    // Calculate new expiry — extend from now
    const maxAge = 24 * 60 * 60; // 24 hours
    const newExpiresAt = new Date(Date.now() + maxAge * 1000);

    // Update session with new tokens and extend expiry
    await db.session.update({
      where: { id: session.id },
      data: {
        token: newToken,
        refreshToken: newRefreshToken,
        expiresAt: newExpiresAt,
        lastActive: new Date(),
      },
    });

    // Build response with new session data
    const response = NextResponse.json({
      success: true,
      user: buildUserResponse(user),
      refreshed: true,
    });

    // Set the new session cookie
    response.cookies.set('session_token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: newExpiresAt,
      maxAge,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Session refresh error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to refresh session' } },
      { status: 500 }
    );
  }
}
