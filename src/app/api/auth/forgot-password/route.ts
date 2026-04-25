import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';
import { passwordResetTokenCache } from '@/lib/cache';
import { logAuth } from '@/lib/audit';
import { emailService } from '@/lib/services/email-service';

// In-memory rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(identifier: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxAttempts) return false;
  entry.count++;
  return true;
}

function getRateLimitReset(identifier: string): number | null {
  const entry = rateLimitMap.get(identifier);
  if (!entry) return null;
  return Math.ceil((entry.resetAt - Date.now()) / 1000);
}

/**
 * POST /api/auth/forgot-password
 * 
 * Request body: { email: string }
 * 
 * Generates a password reset token and stores it in the cache.
 * In production, this would send an email with the reset link.
 * For now, we return the token for testing purposes.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    // Rate limit check (5 attempts per 15 minutes per IP)
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(clientIp, 5, 15 * 60 * 1000)) {
      const retryAfter = getRateLimitReset(clientIp);
      return NextResponse.json(
        { success: false, error: { code: 'RATE_LIMITED', message: 'Too many password reset requests. Please try again later.', retryAfter } },
        { status: 429 }
      );
    }

    // Find user by email
    const user = await db.user.findFirst({
      where: { email: email.toLowerCase() },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Generate reset token scoped for dev return
    let resetToken: string | undefined;

    // Always return success to prevent email enumeration
    // But only process if user exists
    if (user && !user.deletedAt) {
      // Generate reset token (32 bytes = 64 hex characters)
      resetToken = crypto.randomBytes(32).toString('hex');

      // Store token in cache with 1-hour expiration
      passwordResetTokenCache.set(resetToken, {
        userId: user.id,
        email: user.email,
        createdAt: Date.now(),
      });

      // Log the password reset request
      await logAuth(request, 'password_reset', user.id, {
        email: user.email,
        action: 'requested',
      }, user.tenantId);
      
      // Send email with reset link
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
      const resetLink = `${appUrl}/reset-password?token=${resetToken}`;

      try {
        await emailService.send({
          to: user.email,
          subject: 'Password Reset Request - StaySuite',
          variables: {
            name: `${user.firstName} ${user.lastName}`,
            resetLink,
            expiresIn: '1 hour',
          },
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1a1a2e;">Password Reset Request</h2>
              <p>Hello {{name}},</p>
              <p>We received a request to reset your password. Click the link below to set a new password:</p>
              <p><a href="{{resetLink}}" style="display: inline-block; padding: 12px 24px; background-color: #1a1a2e; color: white; text-decoration: none; border-radius: 6px;">Reset Password</a></p>
              <p>Or copy and paste this link: <a href="{{resetLink}}">{{resetLink}}</a></p>
              <p><strong>This link expires in {{expiresIn}}.</strong></p>
              <p>If you did not request this, you can safely ignore this email. Your password will not be changed.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
              <p style="color: #888; font-size: 12px;">StaySuite Hotel Management System</p>
            </div>
          `,
          text: `Hello {{name}},\n\nWe received a request to reset your password. Please click the following link to set a new password:\n\n{{resetLink}}\n\nThis link expires in {{expiresIn}}.\n\nIf you did not request this, you can safely ignore this email.\n\nStaySuite Hotel Management System`,
          tags: { type: 'password_reset', userId: user.id },
        });
        console.log(`[PASSWORD RESET] Email sent to ${user.email}`);
      } catch (emailError) {
        console.error(`[PASSWORD RESET] Failed to send email to ${user.email}:`, emailError);
        // Don't fail the request — user still gets the token in dev mode via logs
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log('[PASSWORD RESET] Token generated for user:', user.email);
      }
    }

    // Always return the same response to prevent email enumeration
    return NextResponse.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
