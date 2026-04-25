import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';
import { hashPassword, validatePasswordStrength } from '@/lib/auth';
import { emailService } from '@/lib/services/email-service';
import { emailVerificationTokenCache } from '@/lib/cache';

// In-memory rate limiting (3 signups per IP per 15 minutes)
const signupRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkSignupRateLimit(identifier: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = signupRateLimitMap.get(identifier);
  if (!entry || now > entry.resetAt) {
    signupRateLimitMap.set(identifier, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxAttempts) {
    return false;
  }
  entry.count++;
  return true;
}

function getSignupRateLimitReset(identifier: string): number | null {
  const entry = signupRateLimitMap.get(identifier);
  if (!entry) return null;
  return Math.ceil((entry.resetAt - Date.now()) / 1000);
}

// POST /api/auth/signup - Create a new user account
export async function POST(request: NextRequest) {
  try {
    // Rate limit check (3 signups per IP per 15 minutes)
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     request.headers.get('x-real-ip') || 'unknown';
    if (!checkSignupRateLimit(clientIp, 3, 15 * 60 * 1000)) {
      const retryAfter = getSignupRateLimitReset(clientIp) || 900;
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.', retryAfter },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    const { email, password, firstName, lastName, tenantId } = await request.json();

    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { success: false, error: 'Email, password, first name, and last name are required' },
        { status: 400 }
      );
    }

    // Validate password strength
    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { success: false, error: 'Password does not meet requirements', details: passwordCheck.errors },
        { status: 400 }
      );
    }

    // Check if tenant exists
    let targetTenantId = tenantId;
    if (!targetTenantId) {
      // Default: use the first tenant (single-tenant mode)
      const firstTenant = await db.tenant.findFirst({ where: { deletedAt: null } });
      if (!firstTenant) {
        return NextResponse.json(
          { success: false, error: 'No tenant configured. Please contact administrator.' },
          { status: 500 }
        );
      }
      targetTenantId = firstTenant.id;
    }

    // Check if user already exists
    const existingUser = await db.user.findFirst({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      // Check if already verified
      if (existingUser.isVerified) {
        return NextResponse.json(
          { success: false, error: 'An account with this email already exists and is verified' },
          { status: 409 }
        );
      }

      // Resend verification email for unverified users
      const verificationToken = crypto.randomBytes(32).toString('hex');
      emailVerificationTokenCache.set(verificationToken, {
        userId: existingUser.id,
        email: existingUser.email,
        tenantId: existingUser.tenantId,
        createdAt: Date.now(),
      });

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
      const verifyLink = `${appUrl}/verify-email?token=${verificationToken}`;

      try {
        await emailService.send({
          to: existingUser.email,
          subject: 'Verify Your Email - StaySuite',
          variables: {
            name: `${existingUser.firstName} ${existingUser.lastName}`,
            verifyLink,
            expiresIn: '24 hours',
          },
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1a1a2e;">Verify Your Email Address</h2>
              <p>Hello {{name}},</p>
              <p>Please verify your email address by clicking the link below:</p>
              <p><a href="{{verifyLink}}" style="display: inline-block; padding: 12px 24px; background-color: #1a1a2e; color: white; text-decoration: none; border-radius: 6px;">Verify Email</a></p>
              <p>Or copy and paste this link: <a href="{{verifyLink}}">{{verifyLink}}</a></p>
              <p><strong>This link expires in {{expiresIn}}.</strong></p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
              <p style="color: #888; font-size: 12px;">StaySuite Hotel Management System</p>
            </div>
          `,
          text: `Hello {{name}},\n\nPlease verify your email address by clicking the following link:\n\n{{verifyLink}}\n\nThis link expires in {{expiresIn}}.\n\nStaySuite Hotel Management System`,
          tags: { type: 'email_verification', userId: existingUser.id },
        });
      } catch {
        // Don't fail if email sending fails
      }

      return NextResponse.json({
        success: true,
        message: 'Verification email resent. Please check your inbox.',
        requiresVerification: true,
      });
    }

    // Get or create default role
    let roleId: string | undefined;
    const staffRole = await db.role.findFirst({
      where: { tenantId: targetTenantId, name: 'staff' },
    });
    if (staffRole) {
      roleId = staffRole.id;
    }

    // Create user with isVerified: false
    const hashedPassword = await hashPassword(password);
    const user = await db.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash: hashedPassword,
        firstName,
        lastName,
        tenantId: targetTenantId,
        isVerified: false,
        passwordChangedAt: new Date(),
        ...(roleId && { roleId }),
      },
    });

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    emailVerificationTokenCache.set(verificationToken, {
      userId: user.id,
      email: user.email,
      tenantId: user.tenantId,
      createdAt: Date.now(),
    });

    // Send verification email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
    const verifyLink = `${appUrl}/verify-email?token=${verificationToken}`;

    try {
      await emailService.send({
        to: user.email,
        subject: 'Welcome to StaySuite - Verify Your Email',
        variables: {
          name: `${user.firstName} ${user.lastName}`,
          verifyLink,
          expiresIn: '24 hours',
        },
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a1a2e;">Welcome to StaySuite!</h2>
            <p>Hello {{name}},</p>
            <p>Thank you for creating an account. Please verify your email address by clicking the link below:</p>
            <p><a href="{{verifyLink}}" style="display: inline-block; padding: 12px 24px; background-color: #1a1a2e; color: white; text-decoration: none; border-radius: 6px;">Verify Email</a></p>
            <p>Or copy and paste this link: <a href="{{verifyLink}}">{{verifyLink}}</a></p>
            <p><strong>This link expires in {{expiresIn}}.</strong></p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="color: #888; font-size: 12px;">StaySuite Hotel Management System</p>
          </div>
        `,
        text: `Hello {{name}},\n\nWelcome to StaySuite! Please verify your email address by clicking the following link:\n\n{{verifyLink}}\n\nThis link expires in {{expiresIn}}.\n\nStaySuite Hotel Management System`,
        tags: { type: 'email_verification', userId: user.id },
      });
    } catch {
      // Don't fail if email sending fails — token is still cached
    }

    console.log(`[SIGNUP] User created: ${user.email} (requires verification)`);

    return NextResponse.json({
      success: true,
      message: 'Account created. Please check your email to verify your address.',
      requiresVerification: true,
      user: {
        id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        isVerified: false,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred during signup' },
      { status: 500 }
    );
  }
}
