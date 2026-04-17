/**
 * In-Memory Cache with TTL Support
 * 
 * Used for storing temporary data like 2FA tokens, password reset tokens, etc.
 * Includes automatic cleanup of expired entries.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class InMemoryCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Run cleanup every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
  }

  /**
   * Set a value with TTL (time to live) in seconds
   */
  set<T>(key: string, value: T, ttlSeconds: number): void {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Get a value by key, returns null if expired or not found
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Delete a value by key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Remove all expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the number of entries (including expired ones not yet cleaned up)
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Stop the cleanup interval (for testing or shutdown)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}

// Singleton instance
const globalCache = new InMemoryCache();

// =====================================================
// 2FA Temp Token Cache
// =====================================================

interface TwoFactorTempTokenData {
  userId: string;
  email: string;
  rememberMe: boolean;
  createdAt: number;
}

const TWO_FACTOR_TOKEN_TTL = 5 * 60; // 5 minutes

export const twoFactorTempTokenCache = {
  set: (token: string, data: TwoFactorTempTokenData): void => {
    globalCache.set(`2fa:${token}`, data, TWO_FACTOR_TOKEN_TTL);
  },

  get: (token: string): TwoFactorTempTokenData | null => {
    return globalCache.get<TwoFactorTempTokenData>(`2fa:${token}`);
  },

  delete: (token: string): boolean => {
    return globalCache.delete(`2fa:${token}`);
  },

  has: (token: string): boolean => {
    return globalCache.has(`2fa:${token}`);
  },
};

// =====================================================
// Password Reset Token Cache
// =====================================================

interface PasswordResetTokenData {
  userId: string;
  email: string;
  createdAt: number;
}

const PASSWORD_RESET_TOKEN_TTL = 60 * 60; // 1 hour

export const passwordResetTokenCache = {
  set: (token: string, data: PasswordResetTokenData): void => {
    globalCache.set(`reset:${token}`, data, PASSWORD_RESET_TOKEN_TTL);
  },

  get: (token: string): PasswordResetTokenData | null => {
    return globalCache.get<PasswordResetTokenData>(`reset:${token}`);
  },

  delete: (token: string): boolean => {
    return globalCache.delete(`reset:${token}`);
  },

  has: (token: string): boolean => {
    return globalCache.has(`reset:${token}`);
  },
};

// Export the cache for other uses if needed
export default globalCache;

// =====================================================
// Email Verification Token Cache
// =====================================================

interface EmailVerificationTokenData {
  userId: string;
  email: string;
  tenantId: string;
  createdAt: number;
}

const EMAIL_VERIFICATION_TOKEN_TTL = 24 * 60 * 60; // 24 hours

export const emailVerificationTokenCache = {
  set: (token: string, data: EmailVerificationTokenData): void => {
    globalCache.set(`verify:${token}`, data, EMAIL_VERIFICATION_TOKEN_TTL);
  },

  get: (token: string): EmailVerificationTokenData | null => {
    return globalCache.get<EmailVerificationTokenData>(`verify:${token}`);
  },

  delete: (token: string): boolean => {
    return globalCache.delete(`verify:${token}`);
  },

  has: (token: string): boolean => {
    return globalCache.has(`verify:${token}`);
  },
};
