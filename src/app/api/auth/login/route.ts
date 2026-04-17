import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';
import { logAuth } from '@/lib/audit';
import { verifyPassword } from '@/lib/auth';
import { twoFactorTempTokenCache } from '@/lib/cache';
import bcrypt from 'bcryptjs';

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

// Simple TOTP verification using native crypto
function verifyTOTP(secret: string, token: string): boolean {
  try {
    // Remove spaces and convert to uppercase
    const cleanToken = token.replace(/\s/g, '').toUpperCase();
    
    // Get current time step (30 second window)
    const timeStep = Math.floor(Date.now() / 1000 / 30);
    
    // Decode base32 secret
    const decodedSecret = base32Decode(secret);
    
    // Check current and adjacent time steps (allow 1 step before/after for clock drift)
    for (let i = -1; i <= 1; i++) {
      const counter = timeStep + i;
      const counterBuffer = Buffer.alloc(8);
      counterBuffer.writeBigUInt64BE(BigInt(counter), 0);
      
      const hmac = crypto.createHmac('sha1', decodedSecret);
      hmac.update(counterBuffer);
      const hmacResult = hmac.digest();
      
      const offset = hmacResult[hmacResult.length - 1] & 0x0f;
      const code = ((hmacResult[offset] & 0x7f) << 24 |
                    (hmacResult[offset + 1] & 0xff) << 16 |
                    (hmacResult[offset + 2] & 0xff) << 8 |
                    (hmacResult[offset + 3] & 0xff)) % 1000000;
      
      const expectedToken = code.toString().padStart(6, '0');
      if (expectedToken === cleanToken) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

// Base32 decode function
function base32Decode(str: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleanStr = str.toUpperCase().replace(/[^A-Z2-7]/g, '');
  
  let bits = '';
  for (const char of cleanStr) {
    const val = alphabet.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  
  return Buffer.from(bytes);
}

// POST /api/auth/login
export async function POST(request: NextRequest) {
  try {
    const { email, password, twoFactorCode, tempToken, rememberMe } = await request.json();

    // If this is a 2FA verification request
    if (twoFactorCode && tempToken) {
      return await verifyTwoFactor(tempToken, twoFactorCode, request, !!rememberMe);
    }

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Rate limit check (10 attempts per 15 minutes per email)
    if (!checkRateLimit(email.toLowerCase(), 10, 15 * 60 * 1000)) {
      const retryAfter = getRateLimitReset(email.toLowerCase());
      return NextResponse.json(
        { success: false, error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Please try again later.', retryAfter } },
        { status: 429 }
      );
    }

    const user = await db.user.findFirst({
      where: { email: email.toLowerCase() },
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
    });

    if (!user || user.deletedAt) {
      // Log failed login attempt - user not found
      // Note: Don't log to audit if user doesn't exist (no tenant context)
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if user is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await logAuth(request, 'login_failed', user.id, { 
        email: user.email,
        reason: 'account_locked',
        lockedUntil: user.lockedUntil
      }, user.tenantId);
      return NextResponse.json(
        { success: false, error: 'Account is temporarily locked. Please try again later.' },
        { status: 403 }
      );
    }

    // Check if user is active
    if (user.status !== 'active') {
      await logAuth(request, 'login_failed', user.id, { 
        email: user.email,
        reason: 'account_inactive',
        status: user.status
      }, user.tenantId);
      return NextResponse.json(
        { success: false, error: 'Account is not active. Please contact administrator.' },
        { status: 403 }
      );
    }

    // Check if user has verified their email
    if (!user.isVerified) {
      return NextResponse.json(
        { success: false, error: { code: 'EMAIL_NOT_VERIFIED', message: 'Please verify your email address before logging in' } },
        { status: 403 }
      );
    }

    // Verify password using bcrypt (with SHA256 backward compatibility)
    const isValidPassword = await verifyPassword(password, user.passwordHash);
    
    if (!isValidPassword) {
      // Increment failed attempts (non-blocking — don't let DB write failure block login error response)
      let updatedFailedAttempts = (user.failedAttempts || 0) + 1;
      let isLocked = false;
      try {
        const updatedUser = await db.user.update({
          where: { id: user.id },
          data: {
            failedAttempts: { increment: 1 },
            ...(user.failedAttempts >= 4
              ? { lockedUntil: new Date(Date.now() + 30 * 60 * 1000) } // Lock for 30 minutes
              : {}),
          },
        });
        updatedFailedAttempts = updatedUser.failedAttempts;
        if (updatedUser.lockedUntil) {
          isLocked = true;
        }
      } catch (dbError) {
        console.error('Failed to update failed attempts (non-blocking):', dbError);
        // Fall back to in-memory check
        isLocked = user.failedAttempts >= 4;
      }

      if (isLocked) {
        try {
          await logAuth(request, 'login_failed', user.id, { 
            email: user.email,
            reason: 'account_locked_after_failed_attempts',
            failedAttempts: updatedFailedAttempts,
          }, user.tenantId);
        } catch {}
        return NextResponse.json(
          { success: false, error: 'Account has been locked due to too many failed attempts.' },
          { status: 403 }
        );
      }

      try {
        await logAuth(request, 'login_failed', user.id, { 
          email: user.email,
          reason: 'invalid_password',
          failedAttempts: updatedFailedAttempts
        }, user.tenantId);
      } catch {}
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if 2FA is enabled for this user
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      // Generate a temporary token for 2FA verification
      const tempToken = crypto.randomBytes(32).toString('hex');

      // Store temp token in cache with 5-minute expiration
      twoFactorTempTokenCache.set(tempToken, {
        userId: user.id,
        email: user.email,
        rememberMe: !!rememberMe,
        createdAt: Date.now(),
      });

      // Log 2FA required
      await logAuth(request, 'login', user.id, { 
        email: user.email,
        twoFactorRequired: true
      }, user.tenantId);

      // Return token for 2FA verification
      return NextResponse.json({
        success: true,
        requireTwoFactor: true,
        tempToken,
        message: 'Two-factor authentication required',
      });
    }

    // Reset failed attempts on successful login (non-blocking)
    try {
      await db.user.update({
        where: { id: user.id },
        data: {
          failedAttempts: 0,
          lockedUntil: null,
          lastLoginAt: new Date(),
        },
      });
    } catch (dbError) {
      console.error('Failed to update login metadata (non-blocking):', dbError);
    }

    // Create session and return user data
    return await createSessionAndRespond(user, request, !!rememberMe);
  } catch (error) {
    console.error('Login error:', error);
    const message = error instanceof Error ? error.message : 'An error occurred during login';
    const stack = error instanceof Error ? error.stack : undefined;
    
    // In development, return detailed error info for debugging
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json(
        { success: false, error: 'An error occurred during login', debug: { message, stack } },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'An error occurred during login' },
      { status: 500 }
    );
  }
}

// Verify 2FA code and complete login
async function verifyTwoFactor(tempToken: string, code: string, request: NextRequest, rememberMe: boolean = false) {
  // Validate temp token from cache
  const tokenData = twoFactorTempTokenCache.get(tempToken);
  
  if (!tokenData) {
    return NextResponse.json(
      { success: false, error: 'Invalid or expired session' },
      { status: 400 }
    );
  }

  const user = await db.user.findUnique({
    where: { id: tokenData.userId },
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
  });

  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    // Delete the token if user not found or 2FA not enabled
    twoFactorTempTokenCache.delete(tempToken);
    return NextResponse.json(
      { success: false, error: 'Invalid session' },
      { status: 400 }
    );
  }

  // Verify the 2FA code using native crypto
  const isValid = verifyTOTP(user.twoFactorSecret, code);

  // Check if the code matches a backup code (if TOTP didn't match)
  let usedBackupCode = false;
  if (!isValid && user.backupCodes) {
    const hashedCodes = user.backupCodes.split(',');
    for (let i = 0; i < hashedCodes.length; i++) {
      if (await bcrypt.compare(code.toUpperCase().replace(/\s/g, ''), hashedCodes[i])) {
        usedBackupCode = true;
        // Remove the used backup code
        hashedCodes.splice(i, 1);
        await db.user.update({
          where: { id: user.id },
          data: {
            backupCodes: hashedCodes.length > 0 ? hashedCodes.join(',') : null,
          },
        });
        break;
      }
    }
  }

  if (!isValid && !usedBackupCode) {
    await logAuth(request, 'login_failed', user.id, { 
      email: user.email,
      reason: 'invalid_2fa_code'
    }, user.tenantId);
    return NextResponse.json(
      { success: false, error: 'Invalid verification code' },
      { status: 400 }
    );
  }

  // Delete the temp token after successful verification
  twoFactorTempTokenCache.delete(tempToken);

  // Log successful 2FA verification
  await logAuth(request, '2fa_verified', user.id, { 
    email: user.email
  }, user.tenantId);

  // Reset failed attempts on successful login
  await db.user.update({
    where: { id: user.id },
    data: {
      failedAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });

  // Create session and return user data
  const storedRememberMe = tokenData.rememberMe ?? rememberMe;
  return await createSessionAndRespond(user, request, storedRememberMe);
}

// Create session and return response
async function createSessionAndRespond(
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatar: string | null;
    roleId: string | null;
    tenantId: string;
    isPlatformAdmin: boolean;
    role: { name: string; permissions: string } | null;
    tenant: { id: string; name: string; slug: string; plan: string; status: string };
  },
  request: NextRequest,
  rememberMe: boolean = false
) {
  // Create session token
  const token = crypto.randomBytes(32).toString('hex');
  const maxAge = rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60; // 30 days or 24 hours
  const expiresAt = new Date(Date.now() + maxAge * 1000);

  // Store session in database
  await db.session.create({
    data: {
      userId: user.id,
      token,
      refreshToken: crypto.randomBytes(32).toString('hex'),
      expiresAt,
      userAgent: request.headers.get('user-agent') || null,
      ipAddress: request.headers.get('x-forwarded-for') ||
                 request.headers.get('x-real-ip') ||
                 'unknown',
    },
  });

  // Enforce concurrent session limit
  try {
    const securitySettings = await db.securitySettings.findFirst({
      where: { tenantId: user.tenantId }
    });
    const maxSessions = securitySettings?.maxConcurrentSessions || 3;
    
    const activeSessions = await db.session.findMany({
      where: { 
        userId: user.id, 
        expiresAt: { gt: new Date() } 
      },
      orderBy: { createdAt: 'asc' }
    });
    
    if (activeSessions.length > maxSessions) {
      const sessionsToRemove = activeSessions.slice(0, activeSessions.length - maxSessions);
      await db.session.deleteMany({
        where: { id: { in: sessionsToRemove.map(s => s.id) } }
      });
    }
  } catch (e) {
    // Non-blocking: session limit enforcement should not fail login
    console.error('Failed to enforce session limit:', e);
  }

  // Parse permissions from role
  let permissions: string[] = [];
  if (user.role?.permissions) {
    try {
      permissions = JSON.parse(user.role.permissions);
    } catch {
      permissions = [];
    }
  }

  // Create audit log for successful login
  await logAuth(request, 'login', user.id, { 
    email: user.email,
    roleName: user.role?.name,
    tenantName: user.tenant.name
  }, user.tenantId);

  // Return user data with token
  const response = NextResponse.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      roleId: user.roleId,
      roleName: user.role?.name || 'staff',
      permissions,
      tenantId: user.tenantId,
      tenant: user.tenant,
      isPlatformAdmin: user.isPlatformAdmin,
    },
  });

  // Set session cookie
  response.cookies.set('session_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    maxAge,
    path: '/',
  });

  // Store tenant IP whitelist in a non-HTTP-only cookie for middleware access
  try {
    const tenant = await db.tenant.findUnique({
      where: { id: user.tenantId },
      select: { settings: true },
    });
    if (tenant?.settings) {
      const parsed = JSON.parse(tenant.settings);
      const ipWhitelist: string[] = parsed.ipWhitelist || parsed.accessControl?.ipWhitelist || [];
      if (ipWhitelist.length > 0) {
        response.cookies.set('tenant_ip_whitelist', ipWhitelist.join(','), {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          expires: expiresAt,
          maxAge,
          path: '/',
        });
      }
    }
  } catch {
    // Non-blocking: don't fail login if tenant settings can't be read
  }

  return response;
}
