/**
 * StaySuite Cache Adapter
 * 
 * Auto-switches between in-memory cache and Redis
 * Works seamlessly in both sandbox and production
 */

import { getConfig } from '../config/env';

// Cache item interface
export interface CacheItem<T> {
  value: T;
  expiresAt: number | null;
}

// In-memory cache store
class MemoryCache {
  private store: Map<string, CacheItem<unknown>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup expired items every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.store.entries()) {
      if (item.expiresAt && item.expiresAt < now) {
        this.store.delete(key);
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const item = this.store.get(key);
    if (!item) return null;
    
    if (item.expiresAt && item.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    
    return item.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : null;
    this.store.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async has(key: string): Promise<boolean> {
    const item = this.store.get(key);
    if (!item) return false;
    
    if (item.expiresAt && item.expiresAt < Date.now()) {
      this.store.delete(key);
      return false;
    }
    
    return true;
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    
    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    return Promise.all(keys.map(key => this.get<T>(key)));
  }

  async mset<T>(items: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    for (const item of items) {
      await this.set(item.key, item.value, item.ttl);
    }
  }

  disconnect(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Redis cache wrapper (lazy loaded)
let RedisClient: typeof import('ioredis').default | null = null;
let redisInstance: InstanceType<typeof import('ioredis').default> | null = null;

class RedisCache {
  private client: InstanceType<typeof import('ioredis').default> | null = null;
  private connected = false;

  async connect(url: string): Promise<void> {
    if (this.connected && this.client) return;
    
    try {
      // Lazy load ioredis
      if (!RedisClient) {
        const redisModule = await import('ioredis');
        RedisClient = redisModule.default;
      }
      
      this.client = new RedisClient(url);
      
      await this.client.ping();
      this.connected = true;
      
      this.client.on('error', (err: unknown) => {
        console.error('[Redis] Connection error:', err instanceof Error ? err.message : String(err));
        this.connected = false;
      });
      
      this.client.on('close', () => {
        console.log('[Redis] Connection closed');
        this.connected = false;
      });
    } catch (error) {
      console.error('[Redis] Failed to connect:', error);
      throw error;
    }
  }

  private ensureClient(): InstanceType<typeof import('ioredis').default> {
    if (!this.client || !this.connected) {
      throw new Error('Redis client not connected');
    }
    return this.client;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const client = this.ensureClient();
      const data = await client.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const client = this.ensureClient();
    const data = JSON.stringify(value);
    if (ttlSeconds) {
      await client.set(key, data, 'EX', ttlSeconds);
    } else {
      await client.set(key, data);
    }
  }

  async delete(key: string): Promise<boolean> {
    const client = this.ensureClient();
    const result = await client.del(key);
    return result > 0;
  }

  async has(key: string): Promise<boolean> {
    const client = this.ensureClient();
    const result = await client.exists(key);
    return result === 1;
  }

  async clear(): Promise<void> {
    const client = this.ensureClient();
    await client.flushdb();
  }

  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    
    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    const client = this.ensureClient();
    const results = await client.mget(...keys);
    return results.map(data => {
      if (!data) return null;
      try {
        return JSON.parse(data) as T;
      } catch {
        return null;
      }
    });
  }

  async mset<T>(items: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    const client = this.ensureClient();
    const pipeline = client.pipeline();
    
    for (const item of items) {
      const data = JSON.stringify(item.value);
      if (item.ttl) {
        pipeline.set(item.key, data);
         
        (pipeline as any).expire(item.key, item.ttl);
      } else {
        pipeline.set(item.key, data);
      }
    }
    
    await pipeline.exec();
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.connected = false;
    }
  }
}

// Cache adapter interface
export interface CacheAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  has(key: string): Promise<boolean>;
  clear(): Promise<void>;
  getOrSet<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number): Promise<T>;
  mget<T>(keys: string[]): Promise<(T | null)[]>;
  mset<T>(items: Array<{ key: string; value: T; ttl?: number }>): Promise<void>;
  disconnect(): Promise<void> | void;
}

// Singleton instances
let cacheInstance: CacheAdapter | null = null;

/**
 * Get cache adapter instance
 * Auto-detects Redis or falls back to in-memory
 */
export async function getCache(): Promise<CacheAdapter> {
  if (cacheInstance) return cacheInstance;
  
  const config = getConfig();
  
  if (config.redis.enabled && config.redis.url) {
    try {
      const redisCache = new RedisCache();
      await redisCache.connect(config.redis.url);
      cacheInstance = redisCache;
      console.log('[Cache] Using Redis');
      return cacheInstance;
    } catch (error) {
      console.warn('[Cache] Redis connection failed, falling back to memory cache:', error);
    }
  }
  
  // Fallback to memory cache
  cacheInstance = new MemoryCache();
  console.log('[Cache] Using in-memory cache');
  return cacheInstance;
}

/**
 * Reset cache instance (for testing)
 */
export function resetCache(): void {
  if (cacheInstance) {
    cacheInstance.disconnect();
    cacheInstance = null;
  }
}

// Export types
export { MemoryCache, RedisCache };
