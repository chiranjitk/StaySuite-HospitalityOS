/**
 * Payment Gateway Types and Interfaces
 * Multi-Gateway Routing & Failover Payment System
 */

// ============================================
// Gateway Types
// ============================================

export type GatewayType = 'stripe' | 'paypal' | 'square' | 'manual';

export type PaymentStatus = 
  | 'pending' 
  | 'processing' 
  | 'completed' 
  | 'failed' 
  | 'refunded' 
  | 'partially_refunded'
  | 'cancelled';

export type TransactionStatus = 
  | 'pending'
  | 'authorized'
  | 'captured'
  | 'settled'
  | 'failed'
  | 'refunded'
  | 'partially_refunded'
  | 'cancelled'
  | 'disputed';

// ============================================
// Card Data Types
// ============================================

export interface CardData {
  number: string;
  expMonth: number;
  expYear: number;
  cvc: string;
  cardholderName?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface TokenResult {
  success: boolean;
  token?: string;
  cardType?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  error?: string;
  errorCode?: string;
}

// ============================================
// Payment Request/Result Types
// ============================================

export interface PaymentRequest {
  amount: number;
  currency: string;
  description?: string;
  token?: string;
  cardData?: CardData;
  customerId?: string;
  guestId?: string;
  folioId: string;
  bookingId?: string;
  metadata?: Record<string, string>;
  idempotencyKey?: string;
  captureMethod?: 'automatic' | 'manual';
  statementDescriptor?: string;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  gatewayRef?: string;
  amount?: number;
  currency?: string;
  status: PaymentStatus;
  cardType?: string;
  last4?: string;
  errorCode?: string;
  errorMessage?: string;
  gatewayFee?: number;
  processedAt?: Date;
  metadata?: Record<string, string>;
}

export interface RefundRequest {
  transactionId: string;
  gatewayRef: string;
  amount?: number;
  reason?: string;
  idempotencyKey?: string;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  amount?: number;
  status?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface TransactionStatusResult {
  success: boolean;
  transactionId: string;
  gatewayRef: string;
  status: TransactionStatus;
  amount: number;
  currency: string;
  refundedAmount?: number;
  createdAt: Date;
  updatedAt?: Date;
  metadata?: Record<string, string>;
}

// ============================================
// Gateway Configuration Types
// ============================================

export interface GatewayConfig {
  id: string;
  name: string;
  type: GatewayType;
  priority: number;
  isActive: boolean;
  isPrimary: boolean;
  mode: 'live' | 'test';
  
  // API Credentials
  apiKey: string;
  secretKey?: string;
  merchantId?: string;
  webhookSecret?: string;
  
  // Fee Configuration
  feePercentage: number;
  feeFixed: number;
  
  // Supported Features
  supportedCurrencies: string[];
  supportedCardTypes: string[];
  supportsRefunds: boolean;
  supportsPartialRefunds: boolean;
  supportsTokenization: boolean;
  supportsRecurring: boolean;
  
  // Routing Rules
  minAmount?: number;
  maxAmount?: number;
  routingRules?: RoutingRule[];
  
  // Health Check
  lastHealthCheck?: Date;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  consecutiveFailures: number;
  
  // Stats
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  totalVolume: number;
  avgProcessingTime?: number;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface RoutingRule {
  field: 'currency' | 'amount' | 'card_type' | 'country';
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: string | number | string[];
  targetGateway?: string;
  priority: number;
}

// ============================================
// Gateway Health Types
// ============================================

export interface GatewayHealth {
  gatewayId: string;
  gatewayType: GatewayType;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  latency: number;
  lastCheck: Date;
  uptime: number;
  errorRate: number;
  recentErrors: HealthError[];
}

export interface HealthError {
  timestamp: Date;
  errorCode: string;
  errorMessage: string;
  endpoint?: string;
}

// ============================================
// Routing Decision Types
// ============================================

export interface RoutingDecision {
  primaryGateway: GatewayType;
  fallbackGateways: GatewayType[];
  reason: string;
  appliedRules?: string[];
}

export interface RoutingContext {
  amount: number;
  currency: string;
  cardType?: string;
  country?: string;
  customerId?: string;
  guestId?: string;
  previousFailures?: GatewayType[];
}

// ============================================
// Failover Types
// ============================================

export interface FailoverConfig {
  enabled: boolean;
  maxRetries: number;
  retryDelayMs: number;
  exponentialBackoff: boolean;
  maxRetryDelayMs: number;
  failoverOnErrors: string[];
  healthCheckIntervalMs: number;
  consecutiveFailureThreshold: number;
}

export interface RetryAttempt {
  attempt: number;
  gateway: GatewayType;
  timestamp: Date;
  error?: string;
  success: boolean;
  processingTime?: number;
}

// ============================================
// Payment Gateway Interface
// ============================================

export interface PaymentGateway {
  readonly name: string;
  readonly type: GatewayType;
  
  // Core Payment Operations
  processPayment(request: PaymentRequest): Promise<PaymentResult>;
  refundPayment(request: RefundRequest): Promise<RefundResult>;
  
  // Card Operations
  tokenizeCard(cardData: CardData): Promise<TokenResult>;
  
  // Status Operations
  getTransactionStatus(gatewayRef: string): Promise<TransactionStatusResult>;
  isHealthy(): Promise<boolean>;
  
  // Configuration
  getConfig(): GatewayConfig;
  updateConfig(config: Partial<GatewayConfig>): void;
  
  // Validation
  validateConfig(): { valid: boolean; errors: string[] };
  supportsCurrency(currency: string): boolean;
  supportsAmount(amount: number, currency: string): boolean;
}

// ============================================
// Transaction Log Types
// ============================================

export interface PaymentTransactionLog {
  id: string;
  tenantId: string;
  paymentId?: string;
  
  // Gateway Information
  gateway: GatewayType;
  gatewayRef?: string;
  
  // Transaction Details
  operation: 'payment' | 'refund' | 'tokenize' | 'status_check' | 'health_check';
  amount?: number;
  currency?: string;
  
  // Status
  status: 'pending' | 'success' | 'failed';
  errorCode?: string;
  errorMessage?: string;
  
  // Timing
  requestTimestamp: Date;
  responseTimestamp?: Date;
  processingTimeMs?: number;
  
  // Retry Information
  retryCount: number;
  failoverFrom?: GatewayType;
  
  // Request/Response (masked)
  requestData?: string;
  responseData?: string;
  
  // Metadata
  idempotencyKey?: string;
  correlationId?: string;
  
  createdAt: Date;
}

// ============================================
// Webhook Types
// ============================================

export interface PaymentWebhookEvent {
  id: string;
  gateway: GatewayType;
  eventType: string;
  gatewayRef: string;
  payload: Record<string, unknown>;
  signature?: string;
  processed: boolean;
  processedAt?: Date;
  createdAt: Date;
}

export interface WebhookHandler {
  gateway: GatewayType;
  verifySignature(payload: string, signature: string): boolean;
  parseEvent(payload: string): PaymentWebhookEvent;
  handleEvent(event: PaymentWebhookEvent): Promise<void>;
}
