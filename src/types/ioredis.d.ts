declare module 'ioredis' {
  import { EventEmitter } from 'events';

  interface RedisOptions {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
    lazyConnect?: boolean;
    maxRetriesPerRequest?: number;
    enableReadyCheck?: boolean;
    [key: string]: unknown;
  }

  class Redis extends EventEmitter {
    constructor(options?: RedisOptions | string);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    quit(): Promise<string>;
    ping(): Promise<string>;
    get(key: string): Promise<string | null>;
    set(key: string, value: string | number, ...args: unknown[]): Promise<string | null>;
    del(...keys: string[]): Promise<number>;
    exists(...keys: string[]): Promise<number>;
    expire(key: string, seconds: number): Promise<number>;
    ttl(key: string): Promise<number>;
    keys(pattern: string): Promise<string[]>;
    incr(key: string): Promise<number>;
    decr(key: string): Promise<number>;
    hget(key: string, field: string): Promise<string | null>;
    hset(key: string, field: string, value: string): Promise<number>;
    hdel(key: string, ...fields: string[]): Promise<number>;
    hgetall(key: string): Promise<Record<string, string>>;
    hmset(key: string, data: Record<string, string | number>): Promise<string>;
    sadd(key: string, ...members: string[]): Promise<number>;
    srem(key: string, ...members: string[]): Promise<number>;
    smembers(key: string): Promise<string[]>;
    sismember(key: string, member: string): Promise<number>;
    lpush(key: string, ...values: string[]): Promise<number>;
    rpush(key: string, ...values: string[]): Promise<number>;
    lpop(key: string): Promise<string | null>;
    rpop(key: string): Promise<string | null>;
    lrange(key: string, start: number, stop: number): Promise<string[]>;
    llen(key: string): Promise<number>;
    zadd(key: string, score: number, member: string): Promise<number>;
    zrange(key: string, start: number, stop: number): Promise<string[]>;
    zrem(key: string, ...members: string[]): Promise<number>;
    zcard(key: string): Promise<number>;
    zscore(key: string, member: string): Promise<string | null>;
    mget(...keys: string[]): Promise<(string | null)[]>;
    mset(data: Record<string, string>): Promise<string>;
    pipeline(): Pipeline;
    scan(cursor: number, ...args: unknown[]): Promise<[number, string[]]>;
    info(section?: string): Promise<string>;
    flushdb(): Promise<string>;
    dbsize(): Promise<number>;
    on(event: string, callback: (...args: unknown[]) => void): this;
    status: string;
  }

  interface Pipeline {
    get(key: string): Pipeline;
    set(key: string, value: string | number): Pipeline;
    del(...keys: string[]): Pipeline;
    exec(): Promise<Array<[Error | null, unknown]>>;
  }

  export { Redis, RedisOptions, Pipeline };
  export default Redis;
}
