/**
 * PayPal Payment Gateway Implementation
 * Basic PayPal integration placeholder
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

/**
 * PayPal Gateway Implementation
 */
export class PayPalGateway implements PaymentGateway {
  readonly name: string = 'PayPal';
  readonly type: GatewayType = 'paypal';
  
  private config: GatewayConfig;
  private baseUrl: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;
  
  constructor(config: GatewayConfig) {
    this.config = config;
    this.baseUrl = config.mode === 'live' 
      ? 'https://api-m.paypal.com' 
      : 'https://api-m.sandbox.paypal.com';
  }
  
  /**
   * Get or refresh OAuth access token
   */
  private async getAccessToken(): Promise<string | null> {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiresAt && this.tokenExpiresAt > new Date()) {
      return this.accessToken;
    }
    
    try {
      const credentials = Buffer.from(
        `${this.config.apiKey}:${this.config.secretKey}`
      ).toString('base64');
      
      const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });
      
      const data = await response.json();
      
      if (response.ok && data.access_token) {
        this.accessToken = data.access_token;
        // Set expiry with 5 minute buffer
        const expiresIn = data.expires_in - 300;
        this.tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
        return this.accessToken;
      }
      
      return null;
    } catch {
      return null;
    }
  }
  
  /**
   * Process a payment using PayPal Orders API
   */
  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    const startTime = Date.now();
    
    try {
      const accessToken = await this.getAccessToken();
      
      if (!accessToken) {
        return {
          success: false,
          status: 'failed',
          errorCode: 'AUTH_FAILED',
          errorMessage: 'Failed to authenticate with PayPal',
        };
      }
      
      // Create order
      const orderData = {
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: request.currency,
            value: request.amount.toFixed(2),
          },
          description: request.description || 'Hotel Payment',
          custom_id: request.folioId,
        }],
        application_context: {
          brand_name: 'StaySuite HospitalityOS',
          user_action: 'PAY_NOW',
        },
      };
      
      const response = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': request.idempotencyKey || `order-${Date.now()}`,
        },
        body: JSON.stringify(orderData),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        const processingTime = Date.now() - startTime;
        this.updateStats(false, request.amount, processingTime);
        
        return {
          success: false,
          status: 'failed',
          errorCode: data.name || 'PAYPAL_ERROR',
          errorMessage: data.message || 'Payment processing failed',
        };
      }
      
      // For tokenized payments, we'd capture the order here
      // For PayPal checkout flow, we'd return the approval URL
      const processingTime = Date.now() - startTime;
      this.updateStats(true, request.amount, processingTime);
      
      return {
        success: true,
        transactionId: data.id,
        gatewayRef: data.id,
        amount: request.amount,
        currency: request.currency,
        status: 'processing', // PayPal needs buyer approval
        gatewayFee: this.calculateGatewayFee(request.amount),
        processedAt: new Date(),
        metadata: {
          paypalStatus: data.status,
          processingTimeMs: processingTime.toString(),
        },
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateStats(false, request.amount, processingTime);
      
      return {
        success: false,
        status: 'failed',
        errorCode: 'INTERNAL_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
  
  /**
   * Refund a payment
   */
  async refundPayment(request: RefundRequest): Promise<RefundResult> {
    try {
      const accessToken = await this.getAccessToken();
      
      if (!accessToken) {
        return {
          success: false,
          errorCode: 'AUTH_FAILED',
          errorMessage: 'Failed to authenticate with PayPal',
        };
      }
      
      const refundData: Record<string, unknown> = {};
      
      if (request.amount) {
        refundData.amount = {
          value: request.amount.toFixed(2),
          currency_code: 'USD', // Would get from original transaction
        };
      }
      
      const response = await fetch(
        `${this.baseUrl}/v2/payments/captures/${request.gatewayRef}/refund`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(refundData),
        }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          errorCode: data.name || 'REFUND_FAILED',
          errorMessage: data.message || 'Refund processing failed',
        };
      }
      
      return {
        success: true,
        refundId: data.id,
        amount: parseFloat(data.amount?.value || '0'),
        status: data.status,
      };
    } catch (error) {
      return {
        success: false,
        errorCode: 'INTERNAL_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
  
  /**
   * PayPal doesn't support direct card tokenization in the same way
   * Uses PayPal vault or payment tokens instead
   */
  async tokenizeCard(_cardData: CardData): Promise<TokenResult> {
    return {
      success: false,
      error: 'PayPal does not support direct card tokenization',
      errorCode: 'NOT_SUPPORTED',
    };
  }
  
  /**
   * Get transaction status
   */
  async getTransactionStatus(gatewayRef: string): Promise<TransactionStatusResult> {
    try {
      const accessToken = await this.getAccessToken();
      
      if (!accessToken) {
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
      
      const response = await fetch(
        `${this.baseUrl}/v2/checkout/orders/${gatewayRef}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
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
      
      const statusMap: Record<string, TransactionStatusResult['status']> = {
        'COMPLETED': 'settled',
        'SAVED': 'pending',
        'APPROVED': 'authorized',
        'VOIDED': 'cancelled',
        'CREATED': 'pending',
      };
      
      const purchaseUnit = data.purchase_units?.[0];
      
      return {
        success: true,
        transactionId: data.id,
        gatewayRef: data.id,
        status: statusMap[data.status] || 'pending',
        amount: parseFloat(purchaseUnit?.amount?.value || '0'),
        currency: purchaseUnit?.amount?.currency_code || 'USD',
        createdAt: new Date(data.create_time),
      };
    } catch {
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
   * Check gateway health
   */
  async isHealthy(): Promise<boolean> {
    try {
      const token = await this.getAccessToken();
      this.config.healthStatus = token ? 'healthy' : 'unhealthy';
      this.config.lastHealthCheck = new Date();
      return !!token;
    } catch {
      this.config.healthStatus = 'unhealthy';
      this.config.lastHealthCheck = new Date();
      return false;
    }
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
    
    if (config.mode) {
      this.baseUrl = config.mode === 'live' 
        ? 'https://api-m.paypal.com' 
        : 'https://api-m.sandbox.paypal.com';
    }
  }
  
  /**
   * Validate configuration
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!this.config.apiKey) {
      errors.push('Client ID is required');
    }
    
    if (!this.config.secretKey) {
      errors.push('Client Secret is required');
    }
    
    if (this.config.supportedCurrencies.length === 0) {
      errors.push('At least one supported currency is required');
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  /**
   * Check if currency is supported
   */
  supportsCurrency(currency: string): boolean {
    return this.config.supportedCurrencies.includes(currency.toUpperCase());
  }
  
  /**
   * Check if amount is within supported range
   */
  supportsAmount(amount: number, currency: string): boolean {
    if (!this.supportsCurrency(currency)) {
      return false;
    }
    
    if (this.config.minAmount && amount < this.config.minAmount) {
      return false;
    }
    
    if (this.config.maxAmount && amount > this.config.maxAmount) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Calculate gateway fee
   */
  private calculateGatewayFee(amount: number): number {
    const percentageFee = (amount * this.config.feePercentage) / 100;
    return percentageFee + this.config.feeFixed;
  }
  
  /**
   * Update gateway statistics
   */
  private updateStats(success: boolean, amount: number, processingTime: number): void {
    this.config.totalTransactions++;
    
    if (success) {
      this.config.successfulTransactions++;
      this.config.totalVolume += amount;
    } else {
      this.config.failedTransactions++;
      this.config.consecutiveFailures++;
    }
    
    if (this.config.avgProcessingTime) {
      this.config.avgProcessingTime = (this.config.avgProcessingTime + processingTime) / 2;
    } else {
      this.config.avgProcessingTime = processingTime;
    }
    
    if (this.config.consecutiveFailures >= 5) {
      this.config.healthStatus = 'unhealthy';
    } else if (this.config.consecutiveFailures >= 3) {
      this.config.healthStatus = 'degraded';
    }
  }
}

/**
 * Create a configured PayPal gateway instance
 */
export function createPayPalGateway(config: Partial<GatewayConfig>): PayPalGateway {
  const defaultConfig: GatewayConfig = {
    id: config.id || 'paypal-default',
    name: 'PayPal',
    type: 'paypal',
    priority: 2,
    isActive: true,
    isPrimary: false,
    mode: 'test',
    apiKey: config.apiKey || '',
    secretKey: config.secretKey || '',
    feePercentage: config.feePercentage ?? 2.9,
    feeFixed: config.feeFixed ?? 0.30,
    supportedCurrencies: config.supportedCurrencies || ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
    supportedCardTypes: [],
    supportsRefunds: true,
    supportsPartialRefunds: true,
    supportsTokenization: false,
    supportsRecurring: true,
    healthStatus: 'unknown',
    consecutiveFailures: 0,
    totalTransactions: 0,
    successfulTransactions: 0,
    failedTransactions: 0,
    totalVolume: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  return new PayPalGateway(defaultConfig);
}
