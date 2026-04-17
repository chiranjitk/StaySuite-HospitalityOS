/**
 * Manual Payment Gateway Implementation
 * For manual/cash payments and offline processing
 * 
 * Updated: Now uses database persistence instead of in-memory Map storage
 * to ensure transaction data survives server restarts
 */

import {
  PaymentGateway,
  GatewayConfig,
  PaymentRequest,
  PaymentResult,
  RefundRequest,
  RefundResult,
  CardData,
  TokenResult,
  TransactionStatusResult,
  GatewayType,
} from '../types';
import crypto from 'crypto';

/**
 * Manual Gateway - For cash, check, and manual payment processing
 * 
 * All transactions are now persisted to the ManualTransaction table in the database
 */
export class ManualGateway implements PaymentGateway {
  readonly name: string = 'Manual';
  readonly type: GatewayType = 'manual';
  
  private config: GatewayConfig;
  
  constructor(config: GatewayConfig) {
    this.config = config;
  }
  
  /**
   * Process a manual payment
   * Creates a persistent record in the database
   */
  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    const transactionId = `MANUAL-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    
    try {
      // Dynamic import to avoid issues with client-side bundling
      const { db } = await import('@/lib/db');
      
      // Create persistent transaction record
      const transaction = await db.manualTransaction.create({
        data: {
          tenantId: request.metadata?.tenantId || 'default',
          paymentId: request.folioId, // Use folioId as initial payment reference
          amount: request.amount,
          currency: request.currency,
          status: 'completed',
          metadata: JSON.stringify({
            folioId: request.folioId,
            bookingId: request.bookingId || '',
            guestId: request.guestId || '',
            manual: 'true',
            transactionId,
            processedAt: new Date().toISOString(),
            description: request.description || 'Manual payment',
          }),
        },
      });

      const result: PaymentResult = {
        success: true,
        transactionId,
        gatewayRef: transaction.id, // Use database record ID as gateway reference
        amount: request.amount,
        currency: request.currency,
        status: 'completed',
        processedAt: new Date(),
        metadata: {
          folioId: request.folioId,
          bookingId: request.bookingId || '',
          guestId: request.guestId || '',
          manual: 'true',
          dbTransactionId: transaction.id,
        },
      };
      
      // Update stats
      this.config.totalTransactions++;
      this.config.successfulTransactions++;
      this.config.totalVolume += request.amount;
      
      return result;
    } catch (error) {
      console.error('[ManualGateway] Error processing payment:', error);
      
      // Update stats for failure
      this.config.totalTransactions++;
      this.config.failedTransactions++;
      
      return {
        success: false,
        status: 'failed',
        errorCode: 'DATABASE_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Failed to save transaction',
      };
    }
  }
  
  /**
   * Process a manual refund
   * Updates the persistent record in the database
   */
  async refundPayment(request: RefundRequest): Promise<RefundResult> {
    const refundId = `REFUND-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    
    try {
      const { db } = await import('@/lib/db');
      
      // Find the original transaction by gateway reference or transaction ID
      let transaction: any = null;
      
      // Try to find by gatewayRef (which is the database record ID)
      if (request.gatewayRef) {
        transaction = await db.manualTransaction.findUnique({
          where: { id: request.gatewayRef },
        });
      }
      
      // If not found, try by paymentId
      if (!transaction && request.transactionId) {
        transaction = await db.manualTransaction.findFirst({
          where: { paymentId: request.transactionId },
        });
      }
      
      if (!transaction) {
        return {
          success: false,
          errorCode: 'NOT_FOUND',
          errorMessage: 'Original transaction not found',
        };
      }
      
      // Calculate refund amount (full or partial)
      const refundAmount = request.amount || transaction.amount;
      const totalRefunded = transaction.refundAmount + refundAmount;
      
      // Validate refund amount
      if (totalRefunded > transaction.amount) {
        return {
          success: false,
          errorCode: 'INVALID_AMOUNT',
          errorMessage: 'Refund amount exceeds original transaction amount',
        };
      }
      
      // Determine new status
      const newStatus = totalRefunded >= transaction.amount ? 'refunded' : 'partially_refunded';
      
      // Update transaction record
      const updatedTransaction = await db.manualTransaction.update({
        where: { id: transaction.id },
        data: {
          status: newStatus,
          refundAmount: totalRefunded,
          refundId: refundId,
          metadata: JSON.stringify({
            ...JSON.parse(transaction.metadata || '{}'),
            lastRefundAt: new Date().toISOString(),
            lastRefundReason: request.reason || 'No reason provided',
          }),
          updatedAt: new Date(),
        },
      });
      
      return {
        success: true,
        refundId,
        amount: refundAmount,
        status: newStatus,
      };
    } catch (error) {
      console.error('[ManualGateway] Error processing refund:', error);
      
      return {
        success: false,
        errorCode: 'DATABASE_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Failed to process refund',
      };
    }
  }
  
  /**
   * Manual gateway doesn't support card tokenization
   */
  async tokenizeCard(_cardData: CardData): Promise<TokenResult> {
    return {
      success: false,
      error: 'Manual gateway does not support card tokenization',
      errorCode: 'NOT_SUPPORTED',
    };
  }
  
  /**
   * Get transaction status from database
   */
  async getTransactionStatus(gatewayRef: string): Promise<TransactionStatusResult> {
    try {
      const { db } = await import('@/lib/db');
      
      const transaction = await db.manualTransaction.findUnique({
        where: { id: gatewayRef },
      });
      
      if (transaction) {
        // Map database status to TransactionStatusResult status
        const statusMap: Record<string, TransactionStatusResult['status']> = {
          'completed': 'settled',
          'refunded': 'refunded',
          'partially_refunded': 'partially_refunded',
          'failed': 'failed',
        };
        
        return {
          success: true,
          transactionId: gatewayRef,
          gatewayRef,
          status: statusMap[transaction.status] || 'pending',
          amount: transaction.amount,
          currency: transaction.currency,
          refundedAmount: transaction.refundAmount,
          createdAt: transaction.createdAt,
          updatedAt: transaction.updatedAt,
          metadata: JSON.parse(transaction.metadata || '{}'),
        };
      }
      
      return {
        success: false,
        transactionId: gatewayRef,
        gatewayRef,
        status: 'failed',
        amount: 0,
        currency: 'USD',
        createdAt: new Date(),
      };
    } catch (error) {
      console.error('[ManualGateway] Error getting transaction status:', error);
      
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
  }
  
  /**
   * Manual gateway is always healthy (no external dependencies)
   */
  async isHealthy(): Promise<boolean> {
    this.config.healthStatus = 'healthy';
    this.config.lastHealthCheck = new Date();
    return true;
  }
  
  /**
   * Get current configuration
   */
  getConfig(): GatewayConfig {
    return { ...this.config };
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<GatewayConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Validate configuration
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    // Manual gateway requires minimal configuration
    return { valid: true, errors: [] };
  }
  
  /**
   * Check if currency is supported (all currencies supported)
   */
  supportsCurrency(_currency: string): boolean {
    return true;
  }
  
  /**
   * Check if amount is within supported range
   */
  supportsAmount(amount: number, _currency: string): boolean {
    if (this.config.minAmount && amount < this.config.minAmount) {
      return false;
    }
    
    if (this.config.maxAmount && amount > this.config.maxAmount) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Get transaction history for a tenant
   */
  static async getTransactionHistory(
    tenantId: string,
    options?: {
      limit?: number;
      offset?: number;
      status?: string;
    }
  ): Promise<{ transactions: unknown[]; total: number }> {
    try {
      const { db } = await import('@/lib/db');
      
      const where = {
        tenantId,
        ...(options?.status && { status: options.status }),
      };
      
      const [transactions, total] = await Promise.all([
        db.manualTransaction.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: options?.limit || 50,
          skip: options?.offset || 0,
        }),
        db.manualTransaction.count({ where }),
      ]);
      
      return {
        transactions: transactions.map(t => ({
          ...t,
          metadata: JSON.parse(t.metadata || '{}'),
        })),
        total,
      };
    } catch (error) {
      console.error('[ManualGateway] Error getting transaction history:', error);
      return { transactions: [], total: 0 };
    }
  }
  
  /**
   * Get transaction by payment ID
   */
  static async getTransactionByPaymentId(paymentId: string): Promise<unknown | null> {
    try {
      const { db } = await import('@/lib/db');
      
      const transaction = await db.manualTransaction.findFirst({
        where: { paymentId },
        orderBy: { createdAt: 'desc' },
      });
      
      if (transaction) {
        return {
          ...transaction,
          metadata: JSON.parse(transaction.metadata || '{}'),
        };
      }
      
      return null;
    } catch (error) {
      console.error('[ManualGateway] Error getting transaction by payment ID:', error);
      return null;
    }
  }
}

/**
 * Create a configured Manual gateway instance
 */
export function createManualGateway(config?: Partial<GatewayConfig>): ManualGateway {
  const defaultConfig: GatewayConfig = {
    id: config?.id || 'manual-default',
    name: 'Manual',
    type: 'manual',
    priority: 99, // Lowest priority - used as fallback
    isActive: true,
    isPrimary: false,
    mode: 'live',
    apiKey: '',
    feePercentage: 0,
    feeFixed: 0,
    supportedCurrencies: ['*'], // All currencies
    supportedCardTypes: [],
    supportsRefunds: true,
    supportsPartialRefunds: true,
    supportsTokenization: false,
    supportsRecurring: false,
    healthStatus: 'healthy',
    consecutiveFailures: 0,
    totalTransactions: 0,
    successfulTransactions: 0,
    failedTransactions: 0,
    totalVolume: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  return new ManualGateway(defaultConfig);
}
