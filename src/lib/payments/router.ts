/**
 * Payment Router Service
 * Routes payments through gateways with failover and retry logic
 */

import { db } from '@/lib/db';
import { gatewayRegistry, initializeGateways } from './gateway-registry';
import {
  PaymentRequest,
  PaymentResult,
  RefundRequest,
  RefundResult,
  RoutingContext,
  RoutingDecision,
  RetryAttempt,
  PaymentTransactionLog,
  FailoverConfig,
  GatewayType,
  TokenResult,
  CardData,
  TransactionStatusResult,
} from './types';

// ============================================
// Default Configuration
// ============================================

const DEFAULT_FAILOVER_CONFIG: FailoverConfig = {
  enabled: true,
  maxRetries: 3,
  retryDelayMs: 1000,
  exponentialBackoff: true,
  maxRetryDelayMs: 10000,
  failoverOnErrors: [
    'api_connection_error',
    'api_error',
    'rate_limit_error',
    'card_declined',
    'processing_error',
  ],
  healthCheckIntervalMs: 60000,
  consecutiveFailureThreshold: 5,
};

// ============================================
// Payment Router Class
// ============================================

/**
 * Payment Router
 * Handles payment routing, failover, and retry logic
 */
export class PaymentRouter {
  private static instance: PaymentRouter | null = null;
  private failoverConfig: FailoverConfig;
  private tenantId: string | null = null;
  
  private constructor() {
    this.failoverConfig = DEFAULT_FAILOVER_CONFIG;
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(): PaymentRouter {
    if (!PaymentRouter.instance) {
      PaymentRouter.instance = new PaymentRouter();
    }
    return PaymentRouter.instance;
  }
  
  /**
   * Initialize router for tenant
   */
  async initialize(tenantId: string): Promise<void> {
    this.tenantId = tenantId;
    await initializeGateways(tenantId);
  }
  
  /**
   * Process a payment with routing and failover
   */
  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    // Build routing context
    const context: RoutingContext = {
      amount: request.amount,
      currency: request.currency,
      cardType: undefined, // Would be extracted from card data if provided
      customerId: request.customerId,
      guestId: request.guestId,
      previousFailures: [],
    };
    
    // Determine routing
    const routing = gatewayRegistry.determineRouting(context);
    
    // Track attempts
    const attempts: RetryAttempt[] = [];
    let lastResult: PaymentResult | null = null;
    let currentGateway = routing.primaryGateway;
    const fallbackGateways = [...routing.fallbackGateways];
    
    // Process with retries and failover
    for (let attempt = 1; attempt <= this.failoverConfig.maxRetries; attempt++) {
      const gateway = gatewayRegistry.getGateway(currentGateway);
      
      if (!gateway) {
        // Try next fallback
        if (fallbackGateways.length > 0) {
          currentGateway = fallbackGateways.shift()!;
          continue;
        }
        break;
      }
      
      // Log attempt
      const attemptStart = Date.now();
      
      try {
        // Process payment
        lastResult = await gateway.processPayment(request);
        
        const processingTime = Date.now() - attemptStart;
        attempts.push({
          attempt,
          gateway: currentGateway,
          timestamp: new Date(),
          success: lastResult.success,
          processingTime,
          error: lastResult.errorMessage,
        });
        
        // Log transaction
        await this.logTransaction({
          tenantId: this.tenantId || 'unknown',
          gateway: currentGateway,
          operation: 'payment',
          amount: request.amount,
          currency: request.currency,
          status: lastResult.success ? 'success' : 'failed',
          errorCode: lastResult.errorCode,
          errorMessage: lastResult.errorMessage,
          requestTimestamp: new Date(attemptStart),
          responseTimestamp: new Date(),
          processingTimeMs: processingTime,
          retryCount: attempt - 1,
          failoverFrom: attempt > 1 ? routing.primaryGateway : undefined,
          gatewayRef: lastResult.gatewayRef,
          idempotencyKey: request.idempotencyKey,
        });
        
        // Success - return result
        if (lastResult.success) {
          return {
            ...lastResult,
            metadata: {
              ...lastResult.metadata,
              routingDecision: routing.reason,
              attemptCount: String(attempt),
              attempts: JSON.stringify(attempts),
            },
          };
        }
        
        // Check if error is retryable
        const isRetryable = this.isRetryableError(lastResult.errorCode || '');
        
        // Check if we should failover
        const shouldFailover = this.shouldFailover(
          lastResult.errorCode || '',
          attempt,
          context.previousFailures?.length || 0
        );
        
        if (shouldFailover && fallbackGateways.length > 0) {
          // Record failure and try next gateway
          context.previousFailures = context.previousFailures || [];
          context.previousFailures.push(currentGateway);
          currentGateway = fallbackGateways.shift()!;
          continue;
        }
        
        // Not retryable or no more fallbacks
        if (!isRetryable || attempt >= this.failoverConfig.maxRetries) {
          break;
        }
        
        // Wait before retry with exponential backoff
        const delay = this.calculateRetryDelay(attempt);
        await this.sleep(delay);
        
      } catch (error) {
        const processingTime = Date.now() - attemptStart;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        attempts.push({
          attempt,
          gateway: currentGateway,
          timestamp: new Date(),
          success: false,
          processingTime,
          error: errorMessage,
        });
        
        // Log failed attempt
        await this.logTransaction({
          tenantId: this.tenantId || 'unknown',
          gateway: currentGateway,
          operation: 'payment',
          amount: request.amount,
          currency: request.currency,
          status: 'failed',
          errorCode: 'INTERNAL_ERROR',
          errorMessage,
          requestTimestamp: new Date(attemptStart),
          responseTimestamp: new Date(),
          processingTimeMs: processingTime,
          retryCount: attempt - 1,
        });
        
        // Try next gateway
        if (fallbackGateways.length > 0) {
          context.previousFailures = context.previousFailures || [];
          context.previousFailures.push(currentGateway);
          currentGateway = fallbackGateways.shift()!;
        } else {
          break;
        }
      }
    }
    
    // All attempts failed
    return {
      success: false,
      status: 'failed',
      errorCode: lastResult?.errorCode || 'ALL_GATEWAYS_FAILED',
      errorMessage: lastResult?.errorMessage || 'All payment gateways failed',
      metadata: {
        attempts: JSON.stringify(attempts),
        routingDecision: routing.reason,
      },
    };
  }
  
  /**
   * Process a refund with routing
   */
  async processRefund(request: RefundRequest): Promise<RefundResult> {
    // For refunds, use the same gateway that processed the original payment
    // This is determined by the gatewayRef (transaction ID)
    
    // Try to determine gateway from transaction ID
    const gateway = this.determineGatewayFromRef(request.gatewayRef);
    
    if (!gateway) {
      return {
        success: false,
        errorCode: 'GATEWAY_NOT_FOUND',
        errorMessage: 'Could not determine gateway for refund',
      };
    }
    
    const attemptStart = Date.now();
    
    try {
      const result = await gateway.refundPayment(request);
      
      // Log transaction
      await this.logTransaction({
        tenantId: this.tenantId || 'unknown',
        gateway: gateway.type,
        operation: 'refund',
        amount: request.amount,
        status: result.success ? 'success' : 'failed',
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        requestTimestamp: new Date(attemptStart),
        responseTimestamp: new Date(),
        processingTimeMs: Date.now() - attemptStart,
        retryCount: 0,
        gatewayRef: request.gatewayRef,
      });
      
      return result;
    } catch (error) {
      return {
        success: false,
        errorCode: 'INTERNAL_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * Tokenize a card
   */
  async tokenizeCard(cardData: CardData): Promise<TokenResult> {
    // Use primary gateway for tokenization
    const gateway = gatewayRegistry.getPrimaryGateway();
    
    if (!gateway) {
      return {
        success: false,
        error: 'No primary gateway configured',
        errorCode: 'NO_GATEWAY',
      };
    }
    
    if (!gateway.getConfig().supportsTokenization) {
      return {
        success: false,
        error: 'Primary gateway does not support tokenization',
        errorCode: 'NOT_SUPPORTED',
      };
    }
    
    return gateway.tokenizeCard(cardData);
  }
  
  /**
   * Get transaction status
   */
  async getTransactionStatus(gatewayRef: string, gatewayType?: GatewayType): Promise<TransactionStatusResult> {
    const gateway = gatewayType 
      ? gatewayRegistry.getGateway(gatewayType)
      : this.determineGatewayFromRef(gatewayRef);
    
    if (!gateway) {
      return {
        success: false,
        transactionId: gatewayRef,
        gatewayRef,
        status: 'failed',
        amount: 0,
        currency: 'USD',
        createdAt: new Date(),
      };
    }
    
    return gateway.getTransactionStatus(gatewayRef);
  }
  
  /**
   * Get routing decision for preview
   */
  getRoutingDecision(context: RoutingContext): RoutingDecision {
    return gatewayRegistry.determineRouting(context);
  }
  
  /**
   * Get failover configuration
   */
  getFailoverConfig(): FailoverConfig {
    return { ...this.failoverConfig };
  }
  
  /**
   * Update failover configuration
   */
  updateFailoverConfig(config: Partial<FailoverConfig>): void {
    this.failoverConfig = { ...this.failoverConfig, ...config };
    gatewayRegistry.updateFailoverConfig(config);
  }
  
  // ============================================
  // Private Helper Methods
  // ============================================
  
  /**
   * Determine gateway from transaction reference
   */
  private determineGatewayFromRef(gatewayRef: string): import('./types').PaymentGateway | null {
    // Check prefix patterns
    if (gatewayRef.startsWith('pi_') || gatewayRef.startsWith('ch_')) {
      return gatewayRegistry.getGateway('stripe') ?? null;
    }
    
    if (gatewayRef.startsWith('PAYID') || gatewayRef.includes('paypal')) {
      return gatewayRegistry.getGateway('paypal') ?? null;
    }
    
    if (gatewayRef.startsWith('MANUAL')) {
      return gatewayRegistry.getGateway('manual') ?? null;
    }
    
    // Default to primary gateway
    return gatewayRegistry.getPrimaryGateway() ?? null;
  }
  
  /**
   * Check if error is retryable
   */
  private isRetryableError(errorCode: string): boolean {
    const retryableErrors = [
      'api_connection_error',
      'api_error',
      'rate_limit_error',
      'processing_error',
      'internal_error',
      'timeout',
      'service_unavailable',
    ];
    
    return retryableErrors.some(e => 
      errorCode.toLowerCase().includes(e.toLowerCase())
    );
  }
  
  /**
   * Check if should failover to next gateway
   */
  private shouldFailover(
    errorCode: string,
    attempt: number,
    previousFailures: number
  ): boolean {
    // Failover for specific errors
    const failoverErrors = this.failoverConfig.failoverOnErrors;
    const shouldFailover = failoverErrors.some(e => 
      errorCode.toLowerCase().includes(e.toLowerCase())
    );
    
    // Don't failover on first attempt if it's a card decline
    if (attempt === 1 && errorCode.toLowerCase().includes('card_declined')) {
      return false;
    }
    
    // Failover if we have more gateways to try
    return shouldFailover || previousFailures > 0;
  }
  
  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    if (!this.failoverConfig.exponentialBackoff) {
      return this.failoverConfig.retryDelayMs;
    }
    
    const delay = Math.min(
      this.failoverConfig.retryDelayMs * Math.pow(2, attempt - 1),
      this.failoverConfig.maxRetryDelayMs
    );
    
    // Add jitter (10% random)
    return delay + Math.random() * delay * 0.1;
  }
  
  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Log transaction to database
   */
  private async logTransaction(log: Omit<PaymentTransactionLog, 'id' | 'createdAt'>): Promise<void> {
    try {
      // Store in PaymentGatewayLog table or AuditLog
      await db.auditLog.create({
        data: {
          tenantId: log.tenantId,
          module: 'payments',
          action: log.operation,
          entityType: 'payment_transaction',
          entityId: log.gatewayRef,
          newValue: JSON.stringify({
            gateway: log.gateway,
            amount: log.amount,
            currency: log.currency,
            status: log.status,
            errorCode: log.errorCode,
            errorMessage: log.errorMessage,
            processingTimeMs: log.processingTimeMs,
            retryCount: log.retryCount,
            failoverFrom: log.failoverFrom,
          }),
        },
      });
    } catch (error) {
      console.error('Failed to log transaction:', error);
    }
  }
}

// ============================================
// Singleton Export
// ============================================

export const paymentRouter = PaymentRouter.getInstance();

/**
 * Initialize the payment router for a tenant
 */
export async function initializePaymentRouter(tenantId: string): Promise<void> {
  await paymentRouter.initialize(tenantId);
}

/**
 * Get the payment router instance
 */
export function getPaymentRouter(): PaymentRouter {
  return paymentRouter;
}
