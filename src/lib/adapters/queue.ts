/**
 * StaySuite Job Queue Adapter
 * 
 * Auto-switches between synchronous execution and BullMQ
 * Works seamlessly in both sandbox and production
 */

import { getConfig } from '../config/env';
import crypto from 'crypto';

// Job data interface
export interface JobData {
  id: string;
  name: string;
  data: Record<string, unknown>;
  priority?: number;
  delay?: number;
  attempts?: number;
  timeout?: number;
  timestamp: number;
}

// Job result interface
export interface JobResult<T = unknown> {
  success: boolean;
  result?: T;
  error?: string;
  duration: number;
}

// Job handler type
export type JobHandler<T = unknown> = (data: Record<string, unknown>) => Promise<T>;

// Memory queue (synchronous execution)
class MemoryQueueAdapter {
  private handlers: Map<string, JobHandler> = new Map();
  private jobs: Map<string, JobData> = new Map();
  private results: Map<string, JobResult> = new Map();
  private processing = false;

  async registerHandler(name: string, handler: JobHandler): Promise<void> {
    this.handlers.set(name, handler);
    console.log(`[Queue Memory] Registered handler: ${name}`);
  }

  async addJob<T>(
    name: string,
    data: Record<string, unknown>,
    options?: { priority?: number; delay?: number; attempts?: number }
  ): Promise<string> {
    const jobId = `job-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    const job: JobData = {
      id: jobId,
      name,
      data,
      priority: options?.priority || 0,
      delay: options?.delay || 0,
      attempts: options?.attempts || 1,
      timeout: 30000,
      timestamp: Date.now(),
    };
    
    this.jobs.set(jobId, job);
    
    // Execute immediately (or with delay)
    if (options?.delay) {
      setTimeout(() => this.processJob(jobId), options.delay);
    } else {
      // Process synchronously
      await this.processJob(jobId);
    }
    
    return jobId;
  }

  private async processJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    
    const handler = this.handlers.get(job.name);
    if (!handler) {
      this.results.set(jobId, {
        success: false,
        error: `No handler registered for job: ${job.name}`,
        duration: 0,
      });
      return;
    }
    
    const startTime = Date.now();
    
    try {
      const result = await handler(job.data);
      const duration = Date.now() - startTime;
      
      this.results.set(jobId, {
        success: true,
        result,
        duration,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.results.set(jobId, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });
    }
    
    this.jobs.delete(jobId);
  }

  async getJobResult<T>(jobId: string): Promise<JobResult<T> | null> {
    return (this.results.get(jobId) as JobResult<T>) || null;
  }

  async getJobStatus(jobId: string): Promise<'pending' | 'processing' | 'completed' | 'failed' | 'not_found'> {
    if (this.results.has(jobId)) {
      const result = this.results.get(jobId);
      return result?.success ? 'completed' : 'failed';
    }
    if (this.jobs.has(jobId)) {
      return 'pending';
    }
    return 'not_found';
  }

  async getStats(): Promise<{
    pending: number;
    completed: number;
    failed: number;
  }> {
    let completed = 0;
    let failed = 0;
    
    for (const result of this.results.values()) {
      if (result.success) completed++;
      else failed++;
    }
    
    return {
      pending: this.jobs.size,
      completed,
      failed,
    };
  }

  async pause(): Promise<void> {
    this.processing = false;
    console.log('[Queue Memory] Paused');
  }

  async resume(): Promise<void> {
    this.processing = true;
    console.log('[Queue Memory] Resumed');
  }

  async close(): Promise<void> {
    this.handlers.clear();
    this.jobs.clear();
    this.results.clear();
    console.log('[Queue Memory] Closed');
  }
}

// BullMQ queue adapter
class BullMQAdapter {
  private queues: Map<string, import('bullmq').Queue> = new Map();
  private workers: Map<string, import('bullmq').Worker> = new Map();
  private connection: import('ioredis').Redis | null = null;
  private redisUrl: string;

  constructor(redisUrl: string) {
    this.redisUrl = redisUrl;
  }

  private async getConnection(): Promise<import('ioredis').Redis> {
    if (!this.connection) {
      const Redis = (await import('ioredis')).default;
      this.connection = new Redis(this.redisUrl);
    }
    return this.connection;
  }

  private async getQueue(name: string): Promise<import('bullmq').Queue> {
    if (!this.queues.has(name)) {
      const { Queue } = await import('bullmq');
      const connection = await this.getConnection();
      this.queues.set(name, new Queue(name, { connection: connection as any }) as any);
    }
    return this.queues.get(name)!;
  }

  async registerHandler(name: string, handler: JobHandler): Promise<void> {
    if (this.workers.has(name)) {
      console.log(`[Queue BullMQ] Handler already registered: ${name}`);
      return;
    }

    const { Worker } = await import('bullmq');
    const connection = await this.getConnection();
    
    const worker = new Worker(
      name,
      async (job: import('bullmq').Job) => {
        return handler(job.data as Record<string, unknown>);
      },
      { connection: connection as any, concurrency: 5 } as any
    );

    worker.on('completed', (job: any) => {
      console.log(`[Queue BullMQ] Job ${job?.id} completed`);
    });

    worker.on('failed', (job: any, err: any) => {
      console.error(`[Queue BullMQ] Job ${job?.id} failed:`, err?.message || err);
    });

    this.workers.set(name, worker);
    console.log(`[Queue BullMQ] Registered handler: ${name}`);
  }

  async addJob<T>(
    name: string,
    data: Record<string, unknown>,
    options?: { priority?: number; delay?: number; attempts?: number }
  ): Promise<string> {
    const queue = await this.getQueue(name);
    
    const job = await queue.add(name, data, {
      priority: options?.priority,
      delay: options?.delay,
      attempts: options?.attempts || 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });

    return job.id || '';
  }

  async getJobResult<T>(_jobId: string): Promise<JobResult<T> | null> {
    // BullMQ doesn't store results directly, need to implement custom storage
    return null;
  }

  async getJobStatus(jobId: string): Promise<'pending' | 'processing' | 'completed' | 'failed' | 'not_found'> {
    // Would need to check job state in BullMQ
    return 'not_found';
  }

  async getStats(): Promise<{
    pending: number;
    completed: number;
    failed: number;
  }> {
    // Would need to aggregate from all queues
    return { pending: 0, completed: 0, failed: 0 };
  }

  async pause(): Promise<void> {
    for (const worker of this.workers.values()) {
      await (worker as any).pause();
    }
    console.log('[Queue BullMQ] All workers paused');
  }

  async resume(): Promise<void> {
    for (const worker of this.workers.values()) {
      await (worker as any).resume();
    }
    console.log('[Queue BullMQ] All workers resumed');
  }

  async close(): Promise<void> {
    for (const worker of this.workers.values()) {
      await (worker as any).close();
    }
    for (const queue of this.queues.values()) {
      await queue.close();
    }
    if (this.connection) {
      await this.connection.quit();
    }
    console.log('[Queue BullMQ] Closed');
  }
}

// Queue adapter interface
export interface QueueAdapter {
  registerHandler(name: string, handler: JobHandler): Promise<void>;
  addJob<T>(
    name: string,
    data: Record<string, unknown>,
    options?: { priority?: number; delay?: number; attempts?: number }
  ): Promise<string>;
  getJobResult<T>(jobId: string): Promise<JobResult<T> | null>;
  getJobStatus(jobId: string): Promise<'pending' | 'processing' | 'completed' | 'failed' | 'not_found'>;
  getStats(): Promise<{ pending: number; completed: number; failed: number }>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  close(): Promise<void>;
}

// Singleton instance
let queueInstance: QueueAdapter | null = null;

/**
 * Get queue adapter instance
 * Auto-detects Redis/BullMQ or falls back to memory
 */
export async function getQueue(): Promise<QueueAdapter> {
  if (queueInstance) return queueInstance;
  
  const config = getConfig();
  
  if (config.queue.enabled && config.queue.redisUrl) {
    try {
      const bullMQAdapter = new BullMQAdapter(config.queue.redisUrl);
      queueInstance = bullMQAdapter;
      console.log('[Queue] Using BullMQ');
      return queueInstance;
    } catch (error) {
      console.warn('[Queue] BullMQ initialization failed, falling back to memory:', error);
    }
  }
  
  // Fallback to memory queue
  queueInstance = new MemoryQueueAdapter();
  console.log('[Queue] Using memory queue (synchronous execution)');
  return queueInstance;
}

/**
 * Add a job to the queue
 */
export async function addJob<T>(
  name: string,
  data: Record<string, unknown>,
  options?: { priority?: number; delay?: number; attempts?: number }
): Promise<string> {
  const queue = await getQueue();
  return queue.addJob<T>(name, data, options);
}

/**
 * Register a job handler
 */
export async function registerJobHandler(name: string, handler: JobHandler): Promise<void> {
  const queue = await getQueue();
  return queue.registerHandler(name, handler);
}

/**
 * Reset queue adapter (for testing)
 */
export function resetQueue(): void {
  if (queueInstance) {
    queueInstance.close();
    queueInstance = null;
  }
}

// Export types and classes
export { MemoryQueueAdapter, BullMQAdapter };
