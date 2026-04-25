import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';
import { verifyPassword } from '@/lib/auth';

// In-memory rate limiting for 2FA disable
const twoFADisableRateLimitMap = new Map<string, { count: number; resetTime: number }>();
function check2FADisableRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 5;
  const record = twoFADisableRateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    twoFADisableRateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return { allowed: true };
  }
  if (record.count >= maxRequests) {
    return { allowed: false, retryAfter: Math.ceil((record.resetTime - now) / 1000) };
  }
  record.count++;
  return { allowed: true };
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


// POST /api/auth/2fa/disable - Disable 2FA
export async function POST(request: NextRequest) {
  try {
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
    const rateLimit = check2FADisableRateLimit(clientIp);
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: 'Too many requests. Please try again later.' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } });
    }

    const { totpCode, password } = await request.json();

    // Get session token from cookie
    const sessionToken = request.cookies.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Find session
    const session = await db.session.findUnique({
      where: { token: sessionToken },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            passwordHash: true,
            twoFactorEnabled: true,
            twoFactorSecret: true,
            tenantId: true,
          },
        },
      },
    });

    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Session expired' },
        { status: 401 }
      );
    }

    const user = session.user;

    if (!user.twoFactorEnabled) {
      return NextResponse.json(
        { success: false, error: '2FA is not enabled' },
        { status: 400 }
      );
    }

    // Require both password and 2FA code for security
    if (!password || !totpCode) {
      return NextResponse.json(
        { success: false, error: 'Password and 2FA code are required' },
        { status: 400 }
      );
    }

    // Verify password
    if (!(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json(
        { success: false, error: 'Invalid password' },
        { status: 400 }
      );
    }

    // Verify TOTP code
    if (!user.twoFactorSecret) {
      return NextResponse.json(
        { success: false, error: '2FA secret not found' },
        { status: 400 }
      );
    }
    const isTotpValid = verifyTOTP(user.twoFactorSecret, totpCode);
    if (!isTotpValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid 2FA code' },
        { status: 400 }
      );
    }

    // Disable 2FA
    await db.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });

    // Create audit log
    try {
      await db.auditLog.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          module: 'auth',
          action: '2fa_disabled',
          entityType: 'user',
          entityId: user.id,
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
      message: '2FA has been disabled successfully',
    });
  } catch (error) {
    console.error('2FA disable error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to disable 2FA' },
      { status: 500 }
    );
  }
}
