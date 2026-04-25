/**
 * Base OTA API Client
 * Abstract base class for all OTA integrations
 */

import crypto from 'crypto';

import {
  OTAAPIClient,
  OTAConfig,
  OTACredentials,
  OTAConnectionTestResult,
  OTAInventoryUpdate,
  OTAInventoryData,
  OTARateUpdate,
  OTARateData,
  OTARestrictionUpdate,
  OTARestrictionData,
  OTABookingData,
  OTASyncResponse,
  OTAWebhookResult,
  OTAHealthStatus,
  OTAError,
} from './types';

export abstract class BaseOTAClient implements OTAAPIClient {
  protected config: OTAConfig;
  protected credentials: OTACredentials | null = null;
  protected baseUrl: string;
  protected timeout: number;
  protected retryAttempts: number;

  constructor(config: OTAConfig) {
    this.config = config;
    this.baseUrl = config.apiConfig.sandboxUrl || config.apiConfig.baseUrl;
    this.timeout = config.apiConfig.timeout;
    this.retryAttempts = config.apiConfig.retryAttempts;
  }

  // ============================================
  // ABSTRACT METHODS - Must be implemented by subclasses
  // ============================================

  abstract connect(credentials: OTACredentials): Promise<OTAConnectionTestResult>;
  abstract disconnect(): Promise<void>;
  abstract testConnection(): Promise<OTAConnectionTestResult>;
  
  abstract getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<OTAInventoryData[]>;
  abstract updateInventory(updates: OTAInventoryUpdate[]): Promise<OTASyncResponse>;
  
  abstract getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<OTARateData[]>;
  abstract updateRates(updates: OTARateUpdate[]): Promise<OTASyncResponse>;
  
  abstract getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<OTARestrictionData[]>;
  abstract updateRestrictions(updates: OTARestrictionUpdate[]): Promise<OTASyncResponse>;
  
  abstract getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<OTABookingData[]>;
  abstract getBooking(externalId: string): Promise<OTABookingData>;
  abstract confirmBooking(externalId: string): Promise<boolean>;
  abstract cancelBooking(externalId: string, reason: string): Promise<boolean>;
  
  abstract processWebhook(payload: unknown, headers: Record<string, string>): Promise<OTAWebhookResult>;
  abstract getWebhookUrl(): string;
  
  abstract getHealthStatus(): Promise<OTAHealthStatus>;

  // ============================================
  // PROTECTED HELPER METHODS
  // ============================================

  protected setCredentials(credentials: OTACredentials): void {
    this.credentials = credentials;
  }

  protected clearCredentials(): void {
    this.credentials = null;
  }

  protected async fetchWithRetry<T>(
    url: string,
    options: RequestInit,
    retries: number = this.retryAttempts
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorBody}`);
        }

        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          return await response.json();
        } else if (contentType?.includes('application/xml') || contentType?.includes('text/xml')) {
          const text = await response.text();
          return text as T;
        }
        return await response.json();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry on client errors (4xx)
        if (lastError.message.includes('HTTP 4')) {
          throw lastError;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < retries) {
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected generateCorrelationId(): string {
    return `${this.config.id}-${Date.now()}-${crypto.randomUUID().replace(/-/g, '').substring(0, 15)}`;
  }

  protected formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  protected createSuccessResponse(
    connectionId: string,
    syncType: 'inventory' | 'rates' | 'restrictions' | 'bookings',
    direction: 'inbound' | 'outbound',
    count: number,
    correlationId: string
  ): OTASyncResponse {
    return {
      success: true,
      connectionId,
      syncType,
      direction,
      correlationId,
      timestamp: new Date(),
      results: [
        {
          type: syncType,
          success: true,
          count,
          failed: 0,
        },
      ],
    };
  }

  protected createErrorResponse(
    connectionId: string,
    syncType: 'inventory' | 'rates' | 'restrictions' | 'bookings',
    direction: 'inbound' | 'outbound',
    error: string,
    correlationId: string,
    count: number = 0
  ): OTASyncResponse {
    return {
      success: false,
      connectionId,
      syncType,
      direction,
      correlationId,
      timestamp: new Date(),
      results: [
        {
          type: syncType,
          success: false,
          count,
          failed: count,
        },
      ],
      errors: [
        {
          code: 'SYNC_ERROR',
          message: error,
          severity: 'error',
          retryable: true,
        },
      ],
    };
  }

  protected createOTAError(code: string, message: string, retryable: boolean = false): OTAError {
    return {
      code,
      message,
      severity: 'error',
      retryable,
    };
  }

  // ============================================
  // AUTHENTICATION HELPERS
  // ============================================

  protected getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    
    if (!this.credentials) {
      return headers;
    }

    switch (this.config.apiConfig.authType) {
      case 'api_key':
        if (this.credentials.apiKey) {
          headers['X-API-Key'] = this.credentials.apiKey;
        }
        break;
      
      case 'bearer':
        if (this.credentials.accessToken) {
          headers['Authorization'] = `Bearer ${this.credentials.accessToken}`;
        }
        break;
      
      case 'basic':
        if (this.credentials.username && this.credentials.password) {
          const encoded = Buffer.from(
            `${this.credentials.username}:${this.credentials.password}`
          ).toString('base64');
          headers['Authorization'] = `Basic ${encoded}`;
        }
        break;
      
      case 'oauth2':
        if (this.credentials.accessToken) {
          headers['Authorization'] = `Bearer ${this.credentials.accessToken}`;
        }
        break;
    }

    return headers;
  }

  protected getCommonHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': `StaySuite-ChannelManager/1.0`,
      'X-Request-ID': this.generateCorrelationId(),
      ...this.getAuthHeaders(),
    };
  }

  // ============================================
  // RATE LIMITING
  // ============================================

  private requestTimestamps: number[] = [];
  private rateLimitWindow: number = 60000;

  constructor_rateLimit() {
    const period = this.config.apiConfig.rateLimit.period;
    this.rateLimitWindow = period === 'second' ? 1000 : period === 'minute' ? 60000 : 3600000;
  }

  protected async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const windowStart = now - this.rateLimitWindow;
    
    // Remove old timestamps
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > windowStart);
    
    // Check if we're at the limit
    if (this.requestTimestamps.length >= this.config.apiConfig.rateLimit.requests) {
      const oldestRequest = Math.min(...this.requestTimestamps);
      const waitTime = oldestRequest + this.rateLimitWindow - now;
      
      if (waitTime > 0) {
        await this.delay(waitTime);
      }
    }
    
    // Record this request
    this.requestTimestamps.push(now);
  }

  // ============================================
  // WEBHOOK VALIDATION
  // ============================================

  protected validateWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    // Default HMAC-SHA256 validation
    // Override in subclasses for channel-specific validation
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return signature === expectedSignature;
  }
}
