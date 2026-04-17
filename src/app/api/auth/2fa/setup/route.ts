import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import QRCode from 'qrcode';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// In-memory rate limiting for 2FA setup
const twoFASetupRateLimitMap = new Map<string, { count: number; resetTime: number }>();
function check2FASetupRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 5;
  const record = twoFASetupRateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    twoFASetupRateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return { allowed: true };
  }
  if (record.count >= maxRequests) {
    return { allowed: false, retryAfter: Math.ceil((record.resetTime - now) / 1000) };
  }
  record.count++;
  return { allowed: true };
}

// Generate a base32 secret for TOTP
function generateBase32Secret(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  const randomBytes = crypto.randomBytes(20);
  for (let i = 0; i < 16; i++) {
    secret += alphabet[randomBytes[i] % alphabet.length];
  }
  return secret;
}

// Generate otpauth URL
function generateOtpauthUrl(secret: string, email: string, issuer: string = 'StaySuite'): string {
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?${params.toString()}`;
}

// GET /api/auth/2fa/setup - Get 2FA status and setup info
export async function GET(request: NextRequest) {
  try {
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
    const rateLimit = check2FASetupRateLimit(clientIp);
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: 'Too many requests. Please try again later.' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } });
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
            email: true,
            firstName: true,
            lastName: true,
            twoFactorEnabled: true,
            twoFactorSecret: true,
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

    // If 2FA is already enabled, return status
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      return NextResponse.json({
        success: true,
        enabled: true,
        message: '2FA is already enabled',
      });
    }

    // Generate new secret
    const secret = generateBase32Secret();
    const serviceName = 'StaySuite';
    const accountName = user.email;

    // Generate otpauth URL
    const otpauthUrl = generateOtpauthUrl(secret, accountName, serviceName);

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
      width: 300,
      margin: 2,
    });

    // Generate backup codes
    const backupCodes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );

    // Hash and store backup codes
    const hashedBackupCodes = backupCodes.map(code => bcrypt.hashSync(code, 10));

    // Store temporary secret (not yet enabled) - we'll verify before enabling
    await db.user.update({
      where: { id: user.id },
      data: {
        twoFactorSecret: secret, // Store temporarily, will be verified
        backupCodes: hashedBackupCodes.join(','),
      },
    });

    return NextResponse.json({
      success: true,
      enabled: false,
      secret,
      qrCode: qrCodeDataUrl,
      otpauthUrl,
      backupCodes,
      manualEntryKey: secret,
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to setup 2FA' },
      { status: 500 }
    );
  }
}
