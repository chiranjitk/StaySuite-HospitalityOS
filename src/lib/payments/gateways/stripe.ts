/**
 * Stripe Payment Gateway Implementation
 * Full Stripe integration with card tokenization, payment intents, refunds, and webhook handling
 */

import crypto from 'crypto';
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

// Stripe API Types (simplified for our implementation)
interface StripePaymentIntent {
  id: string;
  status: string;
  amount: number;
  currency: string;
  metadata: Record<string, string>;
  charges: {
    data: Array<{
      id: string;
      status: string;
      outcome?: {
        network_status: string;
        reason?: string;
      };
      payment_method_details?: {
        card?: {
          brand: string;
          last4: string;
          exp_month: number;
          exp_year: number;
        };
      };
    }>;
  };
  created: number;
}

interface StripeRefund {
  id: string;
  status: string;
  amount: number;
  payment_intent: string;
}

interface StripePaymentMethod {
  id: string;
  type: string;
  card?: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
}

interface StripeError {
  type: string;
  code?: string;
  message: string;
  decline_code?: string;
}

interface StripeResponse<T> {
  success: boolean;
  data?: T;
  error?: StripeError;
  headers?: Record<string, string>;
}

/**
 * Stripe Gateway Implementation
 */
export class StripeGateway implements PaymentGateway {
  readonly name: string = 'Stripe';
  readonly type: GatewayType = 'stripe';
  
  private config: GatewayConfig;
  private baseUrl: string;
  
  constructor(config: GatewayConfig) {
    this.config = config;
    this.baseUrl = config.mode === 'live' 
      ? 'https://api.stripe.com/v1' 
      : 'https://api.stripe.com/v1';
  }
  
  /**
   * Process a payment using Stripe Payment Intents API
   */
  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    const startTime = Date.now();
    
    try {
      // Create payment intent
      const intentData: Record<string, string> = {
        amount: Math.round(request.amount * 100).toString(), // Stripe uses cents
        currency: request.currency.toLowerCase(),
        'metadata[ffolio_id]': request.folioId,
        'metadata[booking_id]': request.bookingId || '',
        'metadata[guest_id]': request.guestId || '',
      };
      
      if (request.description) {
        intentData.description = request.description;
      }
      
      if (request.statementDescriptor) {
        intentData.statement_descriptor = request.statementDescriptor.substring(0, 22);
      }
      
      if (request.captureMethod) {
        intentData.capture_method = request.captureMethod;
      }
      
      if (request.idempotencyKey) {
        intentData.idempotency_key = request.idempotencyKey;
      }
      
      // Add payment method if token provided
      if (request.token) {
        intentData.payment_method = request.token;
        intentData.confirm = 'true';
        intentData.off_session = 'true';
      }
      
      // Create and confirm payment intent
      const response = await this.makeRequest<StripePaymentIntent>(
        'POST',
        '/payment_intents',
        intentData
      );
      
      if (!response.success || !response.data) {
        return {
          success: false,
          status: 'failed',
          errorCode: response.error?.code || 'STRIPE_ERROR',
          errorMessage: response.error?.message || 'Payment processing failed',
        };
      }
      
      const intent = response.data;
      const charge = intent.charges.data[0];
      
      // Determine payment status
      const statusMap: Record<string, PaymentResult['status']> = {
        'succeeded': 'completed',
        'processing': 'processing',
        'requires_payment_method': 'failed',
        'requires_confirmation': 'processing',
        'requires_action': 'processing',
        'canceled': 'cancelled',
      };
      
      const status = statusMap[intent.status] || 'failed';
      
      // Calculate processing time
      const processingTime = Date.now() - startTime;
      
      // Update gateway stats
      this.updateStats(status === 'completed', request.amount, processingTime);
      
      return {
        success: status === 'completed',
        transactionId: intent.id,
        gatewayRef: intent.id,
        amount: intent.amount / 100,
        currency: intent.currency.toUpperCase(),
        status,
        cardType: charge?.payment_method_details?.card?.brand,
        last4: charge?.payment_method_details?.card?.last4,
        gatewayFee: this.calculateGatewayFee(request.amount),
        processedAt: new Date(),
        metadata: {
          stripeChargeId: charge?.id || '',
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
   * Refund a payment (full or partial)
   */
  async refundPayment(request: RefundRequest): Promise<RefundResult> {
    try {
      const refundData: Record<string, string> = {
        payment_intent: request.gatewayRef,
      };
      
      if (request.amount) {
        refundData.amount = Math.round(request.amount * 100).toString();
      }
      
      if (request.reason) {
        refundData.reason = request.reason;
      }
      
      if (request.idempotencyKey) {
        refundData.idempotency_key = request.idempotencyKey;
      }
      
      const response = await this.makeRequest<StripeRefund>(
        'POST',
        '/refunds',
        refundData
      );
      
      if (!response.success || !response.data) {
        return {
          success: false,
          errorCode: response.error?.code || 'REFUND_FAILED',
          errorMessage: response.error?.message || 'Refund processing failed',
        };
      }
      
      const refund = response.data;
      
      return {
        success: refund.status === 'succeeded' || refund.status === 'pending',
        refundId: refund.id,
        amount: refund.amount / 100,
        status: refund.status,
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
   * Tokenize a card using Stripe Payment Methods API
   */
  async tokenizeCard(cardData: CardData): Promise<TokenResult> {
    try {
      // Create payment method from card details
      const pmData: Record<string, string> = {
        type: 'card',
        'card[number]': cardData.number,
        'card[exp_month]': cardData.expMonth.toString(),
        'card[exp_year]': cardData.expYear.toString(),
        'card[cvc]': cardData.cvc,
      };
      
      if (cardData.cardholderName) {
        pmData['billing_details[name]'] = cardData.cardholderName;
      }
      
      if (cardData.addressLine1) {
        pmData['billing_details[address][line1]'] = cardData.addressLine1;
      }
      
      if (cardData.addressLine2) {
        pmData['billing_details[address][line2]'] = cardData.addressLine2;
      }
      
      if (cardData.city) {
        pmData['billing_details[address][city]'] = cardData.city;
      }
      
      if (cardData.state) {
        pmData['billing_details[address][state]'] = cardData.state;
      }
      
      if (cardData.postalCode) {
        pmData['billing_details[address][postal_code]'] = cardData.postalCode;
      }
      
      if (cardData.country) {
        pmData['billing_details[address][country]'] = cardData.country;
      }
      
      const response = await this.makeRequest<StripePaymentMethod>(
        'POST',
        '/payment_methods',
        pmData
      );
      
      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error?.message || 'Card tokenization failed',
          errorCode: response.error?.code || 'TOKENIZATION_FAILED',
        };
      }
      
      const pm = response.data;
      
      // Detect card type from card number
      const cardType = this.detectCardType(cardData.number);
      
      return {
        success: true,
        token: pm.id,
        cardType: cardType || pm.card?.brand || 'unknown',
        last4: cardData.number.slice(-4),
        expMonth: cardData.expMonth,
        expYear: cardData.expYear,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'INTERNAL_ERROR',
      };
    }
  }
  
  /**
   * Get transaction status from Stripe
   */
  async getTransactionStatus(gatewayRef: string): Promise<TransactionStatusResult> {
    try {
      const response = await this.makeRequest<StripePaymentIntent>(
        'GET',
        `/payment_intents/${gatewayRef}`
      );
      
      if (!response.success || !response.data) {
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
      
      const intent = response.data;
      
      // Map Stripe status to our status
      const statusMap: Record<string, TransactionStatusResult['status']> = {
        'succeeded': 'settled',
        'processing': 'pending',
        'requires_payment_method': 'failed',
        'requires_confirmation': 'pending',
        'requires_action': 'pending',
        'canceled': 'cancelled',
        'requires_capture': 'authorized',
      };
      
      return {
        success: true,
        transactionId: intent.id,
        gatewayRef: intent.id,
        status: statusMap[intent.status] || 'pending',
        amount: intent.amount / 100,
        currency: intent.currency.toUpperCase(),
        createdAt: new Date(intent.created * 1000),
        metadata: intent.metadata,
      };
    } catch (error) {
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
      // Simple health check - retrieve account details
      const response = await this.makeRequest<{ id: string }>(
        'GET',
        '/account'
      );
      
      this.config.healthStatus = response.success ? 'healthy' : 'unhealthy';
      this.config.lastHealthCheck = new Date();
      
      return response.success;
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
    
    // Update base URL if mode changed
    if (config.mode) {
      this.baseUrl = config.mode === 'live' 
        ? 'https://api.stripe.com/v1' 
        : 'https://api.stripe.com/v1';
    }
  }
  
  /**
   * Validate configuration
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!this.config.apiKey) {
      errors.push('API key is required');
    }
    
    if (this.config.apiKey && !this.config.apiKey.startsWith('sk_')) {
      errors.push('Invalid Stripe API key format');
    }
    
    if (this.config.feePercentage < 0) {
      errors.push('Fee percentage cannot be negative');
    }
    
    if (this.config.feeFixed < 0) {
      errors.push('Fixed fee cannot be negative');
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
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string, timestamp?: number): boolean {
    if (!this.config.webhookSecret) {
      console.warn('[Stripe] Webhook secret not configured');
      return false;
    }
    
    try {
      // Parse Stripe signature header: t=<timestamp>,v1=<signature>
      const elements = signature.split(',');
      let sigTimestamp = '';
      let sigValue = '';
      
      for (const element of elements) {
        const [key, value] = element.split('=');
        if (key === 't') sigTimestamp = value;
        if (key === 'v1') sigValue = value;
      }
      
      if (!sigTimestamp || !sigValue) return false;
      
      // Check timestamp freshness (5 minutes)
      const ts = parseInt(sigTimestamp, 10);
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - ts) > 300) {
        console.warn('[Stripe] Webhook timestamp too old');
        return false;
      }
      
      // Compute expected signature
      const signedPayload = `${sigTimestamp}.${payload}`;
      const expectedSig = crypto.createHmac('sha256', this.config.webhookSecret)
        .update(signedPayload)
        .digest('hex');
      
      // Timing-safe comparison
      return crypto.timingSafeEqual(
        Buffer.from(sigValue, 'hex'),
        Buffer.from(expectedSig, 'hex')
      );
    } catch (error) {
      console.error('[Stripe] Webhook signature verification error:', error);
      return false;
    }
  }
  
  /**
   * Parse webhook event
   */
  parseWebhookEvent(payload: string): Record<string, unknown> {
    try {
      return JSON.parse(payload);
    } catch {
      return {};
    }
  }
  
  // ============================================
  // Private Methods
  // ============================================
  
  /**
   * Make authenticated request to Stripe API
   */
  private async makeRequest<T>(
    method: 'GET' | 'POST' | 'DELETE',
    endpoint: string,
    data?: Record<string, string>
  ): Promise<StripeResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': '2023-10-16',
      };
      
      let body: string | undefined;
      let finalUrl = url;
      
      if (method === 'GET' && data) {
        const params = new URLSearchParams(data).toString();
        finalUrl = `${url}?${params}`;
      } else if (data) {
        body = new URLSearchParams(data).toString();
      }
      
      const response = await fetch(finalUrl, {
        method,
        headers,
        body,
      });
      
      const responseData = await response.json();
      
      if (!response.ok) {
        const error = responseData.error as StripeError;
        return {
          success: false,
          error,
        };
      }
      
      return {
        success: true,
        data: responseData as T,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          type: 'api_error',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        },
      };
    }
  }
  
  /**
   * Calculate gateway fee for a transaction
   */
  private calculateGatewayFee(amount: number): number {
    const percentageFee = (amount * this.config.feePercentage) / 100;
    return percentageFee + this.config.feeFixed;
  }
  
  /**
   * Detect card type from card number
   */
  private detectCardType(cardNumber: string): string {
    const patterns: Record<string, RegExp> = {
      visa: /^4/,
      mastercard: /^5[1-5]/,
      amex: /^3[47]/,
      discover: /^6(?:011|5)/,
      diners: /^3(?:0[0-5]|[68])/,
      jcb: /^(?:2131|1800|35)/,
    };
    
    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(cardNumber)) {
        return type;
      }
    }
    
    return 'unknown';
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
    
    // Update average processing time
    if (this.config.avgProcessingTime) {
      this.config.avgProcessingTime = (this.config.avgProcessingTime + processingTime) / 2;
    } else {
      this.config.avgProcessingTime = processingTime;
    }
    
    // Update health status based on failures
    if (this.config.consecutiveFailures >= 5) {
      this.config.healthStatus = 'unhealthy';
    } else if (this.config.consecutiveFailures >= 3) {
      this.config.healthStatus = 'degraded';
    }
  }
}

/**
 * Create a configured Stripe gateway instance
 */
export function createStripeGateway(config: Partial<GatewayConfig>): StripeGateway {
  const defaultConfig: GatewayConfig = {
    id: config.id || 'stripe-default',
    name: 'Stripe',
    type: 'stripe',
    priority: 1,
    isActive: true,
    isPrimary: true,
    mode: 'test',
    apiKey: config.apiKey || '',
    secretKey: config.secretKey,
    webhookSecret: config.webhookSecret,
    feePercentage: config.feePercentage ?? 2.9,
    feeFixed: config.feeFixed ?? 0.30,
    supportedCurrencies: config.supportedCurrencies || ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
    supportedCardTypes: ['visa', 'mastercard', 'amex', 'discover'],
    supportsRefunds: true,
    supportsPartialRefunds: true,
    supportsTokenization: true,
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
  
  return new StripeGateway(defaultConfig);
}
