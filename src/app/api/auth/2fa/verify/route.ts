import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// In-memory rate limiting for 2FA verify
const twoFAVerifyRateLimitMap = new Map<string, { count: number; resetTime: number }>();
function check2FAVerifyRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 10;
  const record = twoFAVerifyRateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    twoFAVerifyRateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
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

// POST /api/auth/2fa/verify - Verify 2FA code and enable 2FA
export async function POST(request: NextRequest) {
  try {
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
    const rateLimit = check2FAVerifyRateLimit(clientIp);
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: 'Too many requests. Please try again later.' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } });
    }

    const { code, enableSetup = false } = await request.json();

    if (!code) {
      return NextResponse.json(
        { success: false, error: 'Verification code is required' },
        { status: 400 }
      );
    }

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
            tenantId: true,
            email: true,
            twoFactorEnabled: true,
            twoFactorSecret: true,
            backupCodes: true,
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

    if (!user.twoFactorSecret) {
      return NextResponse.json(
        { success: false, error: '2FA not set up. Please setup 2FA first.' },
        { status: 400 }
      );
    }

    // Verify the code using native crypto
    const isValid = verifyTOTP(user.twoFactorSecret, code);

    // Check if the code matches a backup code (if TOTP didn't match)
    let usedBackupCode = false;
    if (!isValid && user.backupCodes) {
      const hashedCodes = user.backupCodes.split(',');
      for (let i = 0; i < hashedCodes.length; i++) {
        if (await bcrypt.compare(code.toUpperCase(), hashedCodes[i])) {
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
      return NextResponse.json(
        { success: false, error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    // If this is part of setup flow, enable 2FA
    if (enableSetup && !user.twoFactorEnabled) {
      await db.user.update({
        where: { id: user.id },
        data: { twoFactorEnabled: true },
      });

      // Create audit log
      try {
        await db.auditLog.create({
          data: {
            tenantId: user.tenantId,
            userId: user.id,
            module: 'auth',
            action: '2fa_enabled',
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
    }

    return NextResponse.json({
      success: true,
      verified: true,
      enabled: enableSetup ? true : user.twoFactorEnabled,
      message: enableSetup ? '2FA has been enabled successfully' : 'Code verified successfully',
    });
  } catch (error) {
    console.error('2FA verify error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to verify 2FA code' },
      { status: 500 }
    );
  }
}
