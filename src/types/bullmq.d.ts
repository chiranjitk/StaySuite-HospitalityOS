declare module 'bullmq' {
  import { EventEmitter } from 'events';

  interface QueueOptions {
    connection?: Record<string, unknown>;
    defaultJobOptions?: JobOptions;
  }

  interface JobOptions {
    attempts?: number;
    backoff?: number | { type: string; delay?: number };
    delay?: number;
    removeOnComplete?: boolean | number;
    removeOnFail?: boolean | number;
    priority?: number;
    jobId?: string;
  }

  interface Processor {
    (job: Job): Promise<unknown>;
  }

  class Job {
    id: string;
    name: string;
    data: unknown;
    progress: number;
    attemptsMade: number;
    finishedOn: number | null;
    processedOn: number | null;
    failedReason: string | null;
    stacktrace: string[];
    updateProgress(progress: number): Promise<void>;
    remove(): Promise<void>;
    retry(): Promise<void>;
    fail(err: Error): Promise<void>;
  }

  class Queue {
    constructor(name: string, options?: QueueOptions);
    name: string;
    add(name: string, data?: unknown, opts?: JobOptions): Promise<Job>;
    getJob(jobId: string): Promise<Job | undefined>;
    getJobs(types: string[], start?: number, end?: number, asc?: boolean): Promise<Job[]>;
    getJobCounts(...types: string[]): Promise<Record<string, number>>;
    remove(jobId: string): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    empty(): Promise<void>;
    close(): Promise<void>;
    isRunning(): boolean;
    on(event: string, callback: (...args: unknown[]) => void): this;
  }

  class Worker extends EventEmitter {
    constructor(name: string, processor: string | Processor, options?: QueueOptions);
    isRunning(): boolean;
    start(): Promise<void>;
    stop(): Promise<void>;
    on(event: string, callback: (...args: unknown[]) => void): this;
  }

  class FlowProducer {
    constructor(options?: QueueOptions);
    add(flow: { name: string; queueName: string; data?: unknown; children?: unknown[]; opts?: JobOptions }): Promise<unknown>;
    on(event: string, callback: (...args: unknown[]) => void): this;
  }

  export { Queue, Worker, Job, FlowProducer, QueueOptions, JobOptions, Processor };
}
