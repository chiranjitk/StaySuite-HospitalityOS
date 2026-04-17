import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, validatePasswordStrength } from '@/lib/auth';
import { passwordResetTokenCache } from '@/lib/cache';
import { logAuth } from '@/lib/audit';

// In-memory rate limiting (5 resets per IP per 15 minutes)
const resetPasswordRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkResetPasswordRateLimit(identifier: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = resetPasswordRateLimitMap.get(identifier);
  if (!entry || now > entry.resetAt) {
    resetPasswordRateLimitMap.set(identifier, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxAttempts) {
    return false;
  }
  entry.count++;
  return true;
}

function getResetPasswordRateLimitReset(identifier: string): number | null {
  const entry = resetPasswordRateLimitMap.get(identifier);
  if (!entry) return null;
  return Math.ceil((entry.resetAt - Date.now()) / 1000);
}

/**
 * POST /api/auth/reset-password
 * 
 * Request body: { token: string, newPassword: string }
 * 
 * Validates the reset token, hashes the new password with bcrypt,
 * updates the user's password, and deletes the reset token.
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit check (5 resets per IP per 15 minutes)
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     request.headers.get('x-real-ip') || 'unknown';
    if (!checkResetPasswordRateLimit(clientIp, 5, 15 * 60 * 1000)) {
      const retryAfter = getResetPasswordRateLimitReset(clientIp) || 900;
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.', retryAfter },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    const body = await request.json();
    const { token, newPassword } = body;

    // Validate input
    if (!token || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'Token and new password are required' },
        { status: 400 }
      );
    }

    // Validate password strength
    const passwordCheck = validatePasswordStrength(newPassword);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PASSWORD', message: passwordCheck.errors.join('. ') } },
        { status: 400 }
      );
    }

    // Get token data from cache
    const tokenData = passwordResetTokenCache.get(token);

    if (!tokenData) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Find user
    const user = await db.user.findUnique({
      where: { 
        id: tokenData.userId,
        email: tokenData.email,
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user || user.deletedAt) {
      // Delete the token if user not found
      passwordResetTokenCache.delete(token);
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 400 }
      );
    }

    // Hash the new password with bcrypt
    const passwordHash = await hashPassword(newPassword);

    // Update user password in a transaction
    await db.$transaction(async (tx) => {
      // Update password
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          // Reset failed attempts and unlock account
          failedAttempts: 0,
          lockedUntil: null,
          updatedAt: new Date(),
        },
      });

      // Invalidate all existing sessions for security
      await tx.session.deleteMany({
        where: { userId: user.id },
      });
    });

    // Delete the reset token
    passwordResetTokenCache.delete(token);

    // Log the password reset
    await logAuth(request, 'password_reset', user.id, {
      email: user.email,
      action: 'completed',
    }, user.tenantId);

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully. Please log in with your new password.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
