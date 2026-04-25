import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { emailVerificationTokenCache } from '@/lib/cache';

// In-memory rate limiting (10 verifications per IP per 15 minutes)
const verifyEmailRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkVerifyEmailRateLimit(identifier: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = verifyEmailRateLimitMap.get(identifier);
  if (!entry || now > entry.resetAt) {
    verifyEmailRateLimitMap.set(identifier, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxAttempts) {
    return false;
  }
  entry.count++;
  return true;
}

function getVerifyEmailRateLimitReset(identifier: string): number | null {
  const entry = verifyEmailRateLimitMap.get(identifier);
  if (!entry) return null;
  return Math.ceil((entry.resetAt - Date.now()) / 1000);
}

// POST /api/auth/verify-email - Verify email with token
export async function POST(request: NextRequest) {
  try {
    // Rate limit check (10 verifications per IP per 15 minutes)
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     request.headers.get('x-real-ip') || 'unknown';
    if (!checkVerifyEmailRateLimit(clientIp, 10, 15 * 60 * 1000)) {
      const retryAfter = getVerifyEmailRateLimitReset(clientIp) || 900;
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.', retryAfter },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Verification token is required' },
        { status: 400 }
      );
    }

    // Look up token in the shared cache
    const tokenData = emailVerificationTokenCache.get(token);

    if (!tokenData) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid or expired verification token' } },
        { status: 400 }
      );
    }

    // Token TTL is enforced by the cache itself (24 hours)
    // But double-check just in case
    const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
    if (Date.now() - tokenData.createdAt > TOKEN_TTL_MS) {
      emailVerificationTokenCache.delete(token);
      return NextResponse.json(
        { success: false, error: { code: 'TOKEN_EXPIRED', message: 'Verification token has expired' } },
        { status: 400 }
      );
    }

    // Find the user
    const user = await db.user.findUnique({
      where: { id: tokenData.userId },
    });

    if (!user) {
      emailVerificationTokenCache.delete(token);
      return NextResponse.json(
        { success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    if (user.isVerified) {
      // Already verified — clean up token
      emailVerificationTokenCache.delete(token);
      return NextResponse.json({
        success: true,
        message: 'Email is already verified',
        alreadyVerified: true,
      });
    }

    // Mark user as verified
    await db.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
      },
    });

    // Clean up the token
    emailVerificationTokenCache.delete(token);

    console.log(`[VERIFY EMAIL] User verified: ${user.email}`);

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully. You can now log in.',
      verified: true,
    });
  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred during email verification' },
      { status: 500 }
    );
  }
}
