import { NextAuthOptions, getServerSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { db } from './db';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';
import { getTenantContext } from './auth/tenant-context';

// Secure password hashing using bcrypt
const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain an uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain a lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain a number');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain a special character');
  }

  return { valid: errors.length === 0, errors };
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // Check if it's a legacy SHA256 hash (64 hex characters)
  if (hash.length === 64 && /^[a-f0-9]{64}$/.test(hash)) {
    // Legacy verification for backward compatibility
    const crypto = await import('crypto');
    const legacyHash = crypto.createHash('sha256').update(password + 'staysuite_salt').digest('hex');
    if (legacyHash === hash) {
      return true;
    }
  }
  // Modern bcrypt verification
  return bcrypt.compare(password, hash);
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await db.user.findFirst({
          where: { email: credentials.email },
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
          return null;
        }

        // Check if user is locked
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          throw new Error('Account is temporarily locked. Please try again later.');
        }

        // Check if user is active
        if (user.status !== 'active') {
          throw new Error('Account is not active. Please contact administrator.');
        }

        // Verify password
        const isValid = await verifyPassword(credentials.password, user.passwordHash);
        if (!isValid) {
          // Increment failed attempts
          await db.user.update({
            where: { id: user.id },
            data: {
              failedAttempts: { increment: 1 },
              ...(user.failedAttempts >= 4
                ? { lockedUntil: new Date(Date.now() + 30 * 60 * 1000) } // Lock for 30 minutes
                : {}),
            },
          });
          return null;
        }

        // Reset failed attempts on successful login
        await db.user.update({
          where: { id: user.id },
          data: {
            failedAttempts: 0,
            lockedUntil: null,
            lastLoginAt: new Date(),
          },
        });

        // Parse permissions from role
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
          roleId: user.roleId,
          roleName: user.role?.name || 'staff',
          permissions,
          tenantId: user.tenantId,
          tenant: user.tenant,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
        token.avatar = user.avatar;
        token.roleId = user.roleId;
        token.roleName = user.roleName;
        token.permissions = user.permissions;
        token.tenantId = user.tenantId;
        token.tenant = user.tenant;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.firstName = token.firstName as string;
        session.user.lastName = token.lastName as string;
        session.user.avatar = token.avatar as string | null;
        session.user.roleId = token.roleId as string | null;
        session.user.roleName = token.roleName as string;
        session.user.permissions = token.permissions as string[];
        session.user.tenantId = token.tenantId as string;
        session.user.tenant = token.tenant as {
          id: string;
          name: string;
          slug: string;
          plan: string;
          status: string;
        };
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET || (() => {
    // During next build, NODE_ENV=production but secrets aren't available yet.
    // Only throw at runtime (not during static generation / build).
    if (process.env.NODE_ENV === 'production' && typeof window === 'undefined' && process.env.NEXT_PHASE !== 'phase-production-build') {
      console.error('CRITICAL: NEXTAUTH_SECRET must be set in production. Using insecure fallback.');
    }
    return 'dev-only-secret-' + (process.env.NODE_ENV || 'unknown');
  })(),
};

// Export auth function for API routes
export async function auth() {
  return getServerSession(authOptions);
}

// Export getAuthSession as alias for auth
export async function getAuthSession(request?: NextRequest) {
  // If request is provided, try to get context from session token
  if (request) {
    const context = await getTenantContext(request);
    if (context) {
      return {
        user: {
          id: context.userId,
          tenantId: context.tenantId,
          roleName: context.role,
          permissions: context.permissions,
          isPlatformAdmin: context.isPlatformAdmin,
        },
      };
    }
  }
  // Fall back to NextAuth session
  return getServerSession(authOptions);
}
